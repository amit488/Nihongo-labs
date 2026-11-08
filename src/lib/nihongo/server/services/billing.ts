import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http';
import { razorpayRequest, unixToIso, type RazorpayResponse } from './razorpay';

type Plan = {
  id: string; code: string; name: string; description: string | null; plan_kind: string;
  amount_minor: number; currency: string; billing_interval: 'month' | 'year' | 'lifetime';
  interval_count: number; provider_price_id: string | null; is_active: boolean;
};

type PlanFeatureRow = { feature_key: string; feature_value: unknown };
type PlanRow = {
  id: string; code: string; name: string; description: string | null; plan_kind: string;
  amount_minor: number; currency: string; billing_interval: 'month' | 'year' | 'lifetime';
  interval_count: number; plan_features: PlanFeatureRow[] | null;
};
type BillingOwnerRef = { id: string; user_id: string | null };
type EntitlementRow = { feature_key: string };
type PlanFeature = { key: string; value: unknown };
type PlanSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  planKind: string;
  amountMinor: number;
  currency: string;
  billingInterval: 'month' | 'year' | 'lifetime';
  intervalCount: number;
  features: PlanFeature[];
};

function isEnabledFeature(value: unknown): boolean {
  if (value === true || value === 1 || value === 'true') return true;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return record.enabled === true || record.value === true;
  }
  return false;
}

/** Grant only the feature entitlements included in the purchased plan. */
async function syncPlanEntitlements(
  admin: SupabaseClient,
  input: { userId: string; planId: string; subscriptionId: string; paymentId?: string | null; startsAt: string; endsAt: string | null; lifetime?: boolean },
) {
  const { data: features, error: featureError } = await admin.from('plan_features')
    .select('feature_key,feature_value').eq('plan_id', input.planId);
  if (featureError) throw new HttpError(500, 'Could not load purchased plan features.', featureError.message);

  const featureRows = (features ?? []) as PlanFeatureRow[];
  const enabled = featureRows.filter((feature) => isEnabledFeature(feature.feature_value));
  for (const feature of enabled) {
    let lookup = admin.from('user_entitlements').select('id')
      .eq('user_id', input.userId).eq('feature_key', feature.feature_key)
      .eq('source_subscription_id', input.subscriptionId);
    if (input.lifetime && input.paymentId) lookup = lookup.eq('source_payment_id', input.paymentId);
    else lookup = lookup.eq('starts_at', input.startsAt);
    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw new HttpError(500, 'Could not check existing plan entitlement.', lookupError.message);
    if (existing) continue;
    const { error: insertError } = await admin.from('user_entitlements').insert({
      user_id: input.userId,
      feature_key: feature.feature_key,
      source_subscription_id: input.subscriptionId,
      source_payment_id: input.paymentId ?? null,
      status: 'active',
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    });
    if (insertError?.code === '23505') continue; // another identical webhook created the entitlement first
    if (insertError) throw new HttpError(500, `Could not activate ${feature.feature_key} entitlement.`, insertError.message);
  }
  return enabled.map((feature) => feature.feature_key);
}

export async function listPlans(supabase: SupabaseClient): Promise<PlanSummary[]> {
  const { data: plans, error } = await supabase.from('subscription_plans')
    .select('id,code,name,description,plan_kind,amount_minor,currency,billing_interval,interval_count,is_active,display_order,plan_features(feature_key,feature_value)')
    .eq('is_active', true).order('display_order');
  if (error) throw new HttpError(500, 'Could not load subscription plans.', error.message);
  const planRows = (plans ?? []) as PlanRow[];
  return planRows.map((plan) => ({
    id: plan.id, code: plan.code, name: plan.name, description: plan.description,
    planKind: plan.plan_kind, amountMinor: Number(plan.amount_minor), currency: plan.currency,
    billingInterval: plan.billing_interval, intervalCount: plan.interval_count,
    features: (plan.plan_features ?? []).map((item) => ({ key: item.feature_key, value: item.feature_value })),
  }));
}

async function issueInvoiceForPayment(
  admin: SupabaseClient,
  input: { userId: string; subscriptionId: string | null; paymentId: string; amountMinor: number; currency: string; planName: string; providerInvoiceId?: string | null },
) {
  const { data: existing } = await admin.from('invoices').select('id').eq('payment_id', input.paymentId).maybeSingle();
  if (existing) return existing.id;
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const invoiceNumber = `NG-${date}-${input.paymentId.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  const { data, error } = await admin.from('invoices').insert({
    user_id: input.userId,
    subscription_id: input.subscriptionId,
    payment_id: input.paymentId,
    invoice_number: invoiceNumber,
    status: 'paid',
    currency: input.currency,
    subtotal_minor: input.amountMinor,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: input.amountMinor,
    line_items: [{ description: input.planName, quantity: 1, amount_minor: input.amountMinor }],
    billing_snapshot: { source: 'razorpay', provider_invoice_id: input.providerInvoiceId ?? null },
    paid_at: new Date().toISOString(),
  }).select('id').single();
  if (error?.code === '23505') {
    const { data: raced } = await admin.from('invoices').select('id').eq('payment_id', input.paymentId).maybeSingle();
    if (raced) return raced.id;
  }
  if (error) throw new HttpError(500, 'Payment captured but invoice creation failed.', error.message);
  return data.id;
}

export async function createCheckout(admin: SupabaseClient, userId: string, planCode: string, idempotencyKey: string) {
  const { data: plan, error } = await admin.from('subscription_plans').select('*').eq('code', planCode).eq('is_active', true).maybeSingle();
  if (error || !plan) throw new HttpError(404, 'Subscription plan not found or inactive.');
  if (plan.plan_kind === 'free' || Number(plan.amount_minor) <= 0) throw new HttpError(400, 'The Free plan does not require checkout.');

  const existing = await admin.from('payment_orders').select('id,provider_order_id,checkout_url,amount_minor,currency,status')
    .eq('user_id', userId).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing.data?.provider_order_id) {
    return { mode: 'order', paymentOrderId: existing.data.id, orderId: existing.data.provider_order_id, checkoutUrl: existing.data.checkout_url, amountMinor: Number(existing.data.amount_minor), currency: existing.data.currency, keyId: process.env.RAZORPAY_KEY_ID };
  }
  if (existing.data) throw new HttpError(409, 'A checkout with this idempotency key is already being prepared or needs reconciliation. Retry with a new key after checking payment status.');

  // Monthly/yearly plans use Razorpay Subscriptions (recurring mandates), and must
  // have a Plan ID configured in subscription_plans.provider_price_id.
  if (plan.billing_interval === 'month' || plan.billing_interval === 'year') {
    if (!plan.provider_price_id) throw new HttpError(503, `Recurring checkout is not configured for ${plan.name}. Add the Razorpay Plan ID to subscription_plans.provider_price_id.`);

    // Reserve the idempotency key locally before creating the remote mandate. This
    // prevents two concurrent requests from creating two Razorpay subscriptions.
    const { data: localSubscription, error: reserveError } = await admin.from('subscriptions').insert({
      user_id: userId,
      plan_id: plan.id,
      provider: 'razorpay',
      status: 'incomplete',
      metadata: { client_idempotency_key: idempotencyKey, checkout_state: 'creating' },
    }).select('id').single();
    if (reserveError || !localSubscription) {
      if (reserveError?.code === '23505') {
        const prior = await admin.from('subscriptions').select('id,provider_subscription_id,metadata,status')
          .eq('user_id', userId).eq('provider', 'razorpay').contains('metadata', { client_idempotency_key: idempotencyKey }).maybeSingle();
        if (prior.data?.provider_subscription_id && prior.data?.metadata?.checkout_url) {
          return { mode: 'subscription', subscriptionId: prior.data.id, providerSubscriptionId: prior.data.provider_subscription_id, checkoutUrl: prior.data.metadata.checkout_url, planName: plan.name, amountMinor: Number(plan.amount_minor), currency: plan.currency, resumed: true };
        }
        throw new HttpError(409, 'A checkout with this idempotency key is already being prepared. Check the subscription status before retrying.');
      }
      throw new HttpError(500, 'Could not reserve this subscription checkout.', reserveError?.message);
    }

    try {
      const providerSubscription = await razorpayRequest('/subscriptions', 'POST', {
        plan_id: plan.provider_price_id,
        total_count: plan.billing_interval === 'month' ? 120 : 10,
        customer_notify: 1,
        notes: { user_id: userId, plan_id: plan.id, plan_code: plan.code, local_subscription_id: localSubscription.id },
      });
      const { error: linkError } = await admin.from('subscriptions').update({
        provider_subscription_id: providerSubscription.id,
        metadata: { client_idempotency_key: idempotencyKey, checkout_url: providerSubscription.short_url, provider_status: providerSubscription.status, checkout_state: 'ready' },
      }).eq('id', localSubscription.id);
      if (linkError) {
        throw new HttpError(500, `Razorpay subscription ${providerSubscription.id} was created but could not be linked locally. Reconcile it in the provider dashboard.`, linkError.message);
      }
      return {
        mode: 'subscription', subscriptionId: localSubscription.id,
        providerSubscriptionId: providerSubscription.id,
        checkoutUrl: providerSubscription.short_url,
        planName: plan.name,
        amountMinor: Number(plan.amount_minor), currency: plan.currency,
      };
    } catch (error) {
      await admin.from('subscriptions').update({ metadata: { client_idempotency_key: idempotencyKey, checkout_state: 'provider_error', checkout_error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown provider error' } }).eq('id', localSubscription.id);
      throw error;
    }
  }

  // Lifetime products use a one-time order.
  const { data: localOrder, error: orderInsertError } = await admin.from('payment_orders').insert({
    user_id: userId,
    plan_id: plan.id,
    provider: 'razorpay',
    idempotency_key: idempotencyKey,
    amount_minor: Number(plan.amount_minor),
    currency: plan.currency,
    status: 'created',
  }).select('id').single();
  if (orderInsertError || !localOrder) throw new HttpError(500, 'Could not create checkout order.', orderInsertError?.message);

  try {
    const providerOrder = await razorpayRequest('/orders', 'POST', {
      amount: Number(plan.amount_minor), currency: plan.currency,
      receipt: `ng-${localOrder.id.replaceAll('-', '').slice(0, 32)}`,
      notes: { user_id: userId, plan_id: plan.id, local_order_id: localOrder.id },
    });
    const { error: orderLinkError } = await admin.from('payment_orders').update({ provider_order_id: providerOrder.id, checkout_url: providerOrder.short_url ?? null }).eq('id', localOrder.id);
    if (orderLinkError) throw new HttpError(500, `Razorpay order ${providerOrder.id} was created but could not be linked locally. Reconcile it in the provider dashboard.`, orderLinkError.message);
    return { mode: 'order', paymentOrderId: localOrder.id, orderId: providerOrder.id, amountMinor: Number(plan.amount_minor), currency: plan.currency, keyId: process.env.RAZORPAY_KEY_ID, planName: plan.name };
  } catch (error) {
    await admin.from('payment_orders').update({ status: 'failed' }).eq('id', localOrder.id);
    throw error;
  }
}

export async function activateLifetimeOrder(admin: SupabaseClient, localOrderId: string, providerPayment: RazorpayResponse) {
  const { data: order, error } = await admin.from('payment_orders').select('*,subscription_plans(*)').eq('id', localOrderId).maybeSingle();
  if (error || !order) throw new HttpError(404, 'Local payment order not found.');
  if (!order.user_id || !order.plan_id || !order.subscription_plans) throw new HttpError(409, 'This order no longer has a valid learner or plan association.');
  const wasPaid = order.status === 'paid';
  if (providerPayment.order_id !== order.provider_order_id || Number(providerPayment.amount) !== Number(order.amount_minor) || providerPayment.currency !== order.currency || providerPayment.status !== 'captured') {
    throw new HttpError(400, 'Payment details do not match the order or the payment is not captured.');
  }

  const plan = order.subscription_plans as Plan;
  const { data: previousPayment } = await admin.from('payments').select('id,subscription_id')
    .eq('provider', 'razorpay').eq('provider_payment_id', providerPayment.id).maybeSingle();
  let subscriptionId = previousPayment?.subscription_id as string | null;
  if (!subscriptionId) {
    const providerSubId = `lifetime:${order.provider_order_id}`;
    const { data: existingSub } = await admin.from('subscriptions').select('id').eq('provider', 'razorpay').eq('provider_subscription_id', providerSubId).maybeSingle();
    if (existingSub) subscriptionId = existingSub.id;
    else {
      const { data: inserted, error: subError } = await admin.from('subscriptions').insert({
        user_id: order.user_id, plan_id: order.plan_id, provider: 'razorpay',
        provider_subscription_id: providerSubId, status: 'active', current_period_start: new Date().toISOString(),
        current_period_end: null, metadata: { billing_mode: 'lifetime_purchase', local_order_id: localOrderId },
      }).select('id').single();
      if (subError?.code === '23505') {
        const { data: raced } = await admin.from('subscriptions').select('id').eq('provider', 'razorpay').eq('provider_subscription_id', providerSubId).maybeSingle();
        if (!raced) throw new HttpError(500, 'Lifetime subscription was created concurrently but could not be read back.', subError.message);
        subscriptionId = raced.id;
      } else if (subError || !inserted) {
        throw new HttpError(500, 'Could not activate lifetime subscription.', subError?.message);
      } else subscriptionId = inserted.id;
    }
  }

  // A lifetime payment must be linked to the local subscription created or found above.
  // Keep this invariant explicit before writing the payment ledger row.
  if (!subscriptionId) {
    throw new HttpError(500, 'Could not resolve a local subscription for this lifetime payment.');
  }

  const { data: payment, error: paymentError } = await admin.from('payments').upsert({
    user_id: order.user_id,
    order_id: order.id,
    subscription_id: subscriptionId,
    provider: 'razorpay',
    provider_payment_id: providerPayment.id,
    amount_minor: Number(providerPayment.amount),
    currency: providerPayment.currency,
    status: 'captured',
    payment_method: providerPayment.method ?? null,
    captured_at: unixToIso(providerPayment.created_at) ?? new Date().toISOString(),
    metadata: { invoice_id: providerPayment.invoice_id ?? null },
  }, { onConflict: 'provider,provider_payment_id' }).select('id').single();
  if (paymentError || !payment) throw new HttpError(500, 'Could not record captured payment.', paymentError?.message);
  const startsAt = unixToIso(providerPayment.created_at) ?? new Date().toISOString();
  const { error: orderUpdateError } = await admin.from('payment_orders')
    .update({ status: 'paid', paid_at: startsAt }).eq('id', order.id);
  if (orderUpdateError) throw new HttpError(500, 'Payment was captured but the local order status could not be updated.', orderUpdateError.message);
  const grantedFeatures = await syncPlanEntitlements(admin, {
    userId: order.user_id, planId: order.plan_id, subscriptionId,
    paymentId: payment.id, startsAt, endsAt: null, lifetime: true,
  });
  await issueInvoiceForPayment(admin, { userId: order.user_id, subscriptionId, paymentId: payment.id, amountMinor: Number(providerPayment.amount ?? 0), currency: providerPayment.currency ?? order.currency, planName: plan.name, providerInvoiceId: providerPayment.invoice_id ?? null });
  return { alreadyProcessed: Boolean(wasPaid), subscriptionId, paymentId: payment.id, grantedFeatures };
}

export async function syncSubscriptionEvent(admin: SupabaseClient, event: string, entity: RazorpayResponse, paymentEntity?: RazorpayResponse) {
  const providerSubscriptionId = entity?.id || entity?.subscription_id || paymentEntity?.subscription_id;
  if (!providerSubscriptionId) return { ignored: true };
  const { data: subscription, error } = await admin.from('subscriptions').select('id,user_id,plan_id,status,current_period_end,metadata')
    .eq('provider', 'razorpay').eq('provider_subscription_id', providerSubscriptionId).maybeSingle();
  if (error || !subscription) return { ignored: true };

  const periodStart = unixToIso(entity.current_start ?? entity.current_start_at ?? entity.start_at);
  const periodEnd = unixToIso(entity.current_end ?? entity.current_end_at ?? entity.end_at);
  if (event === 'subscription.activated' || event === 'subscription.charged' || event === 'subscription.updated') {
    const mappedStatus = event === 'subscription.updated'
      ? (entity.status === 'paused' ? 'paused' : entity.status === 'halted' ? 'unpaid' : entity.status === 'cancelled' ? 'canceled' : 'active')
      : 'active';
    const { error: subscriptionUpdateError } = await admin.from('subscriptions').update({
      status: mappedStatus,
      current_period_start: periodStart ?? undefined,
      current_period_end: periodEnd ?? undefined,
      cancel_at_period_end: Boolean(entity.charge_at_cycle_end),
      metadata: { ...(subscription.metadata ?? {}), provider_status: entity.status, provider_event: event },
    }).eq('id', subscription.id);
    if (subscriptionUpdateError) throw new HttpError(500, 'Could not update subscription status.', subscriptionUpdateError.message);
  }

  let paymentId: string | null = null;
  if (paymentEntity?.id && subscription.user_id) {
    const { data: payment, error: paymentError } = await admin.from('payments').upsert({
      user_id: subscription.user_id, subscription_id: subscription.id, provider: 'razorpay',
      provider_payment_id: paymentEntity.id, amount_minor: Number(paymentEntity.amount ?? 0),
      currency: paymentEntity.currency || 'INR',
      status: paymentEntity.status === 'captured' || paymentEntity.captured ? 'captured' : 'authorized',
      payment_method: paymentEntity.method ?? null,
      captured_at: unixToIso(paymentEntity.created_at),
      metadata: { invoice_id: paymentEntity.invoice_id ?? null, provider_subscription_id: providerSubscriptionId },
    }, { onConflict: 'provider,provider_payment_id' }).select('id').single();
    if (paymentError) throw new HttpError(500, 'Could not save subscription payment.', paymentError.message);
    paymentId = payment?.id ?? null;
    if (paymentId && (paymentEntity.status === 'captured' || paymentEntity.captured)) {
      const { data: planRow } = await admin.from('subscription_plans').select('name').eq('id', subscription.plan_id).maybeSingle();
      await issueInvoiceForPayment(admin, { userId: subscription.user_id, subscriptionId: subscription.id, paymentId, amountMinor: Number(paymentEntity.amount ?? 0), currency: paymentEntity.currency || 'INR', planName: planRow?.name || 'Nihongo Labs subscription', providerInvoiceId: paymentEntity.invoice_id });
    }
  }

  if ((event === 'subscription.activated' || event === 'subscription.charged') && subscription.user_id) {
    await syncPlanEntitlements(admin, {
      userId: subscription.user_id,
      planId: subscription.plan_id,
      subscriptionId: subscription.id,
      paymentId,
      startsAt: periodStart ?? new Date().toISOString(),
      endsAt: periodEnd,
    });
  }

  if (event === 'subscription.cancelled') {
    const accessEndsAt = periodEnd ?? subscription.current_period_end ?? new Date().toISOString();
    const { error: cancelError } = await admin.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString(), ended_at: accessEndsAt, current_period_end: accessEndsAt }).eq('id', subscription.id);
    if (cancelError) throw new HttpError(500, 'Could not save subscription cancellation.', cancelError.message);
    const { error: entitlementError } = await admin.from('user_entitlements').update({ ends_at: accessEndsAt, status: new Date(accessEndsAt).getTime() <= Date.now() ? 'expired' : 'active' }).eq('source_subscription_id', subscription.id).eq('status', 'active');
    if (entitlementError) throw new HttpError(500, 'Could not update entitlement end date.', entitlementError.message);
  }
  if (event === 'subscription.halted') {
    const { error: haltedError } = await admin.from('subscriptions').update({ status: 'unpaid' }).eq('id', subscription.id);
    if (haltedError) throw new HttpError(500, 'Could not save subscription payment status.', haltedError.message);
  }
  if (event === 'subscription.completed') {
    const { error: completedError } = await admin.from('subscriptions').update({ status: 'expired', ended_at: new Date().toISOString() }).eq('id', subscription.id);
    if (completedError) throw new HttpError(500, 'Could not expire subscription.', completedError.message);
    const { error: entitlementError } = await admin.from('user_entitlements').update({ status: 'expired' }).eq('source_subscription_id', subscription.id);
    if (entitlementError) throw new HttpError(500, 'Could not expire subscription entitlements.', entitlementError.message);
  }
  return { subscriptionId: subscription.id, paymentId };
}

export async function syncPaymentFailure(admin: SupabaseClient, paymentEntity: RazorpayResponse) {
  if (!paymentEntity?.id) return { ignored: true };
  const { data: existing } = await admin.from('payments').select('id,subscription_id,order_id')
    .eq('provider', 'razorpay').eq('provider_payment_id', paymentEntity.id).maybeSingle();
  if (existing) {
    const paymentUpdate = await admin.from('payments').update({ status: 'failed', failed_at: new Date().toISOString(), failure_code: paymentEntity.error_code ?? null, failure_message: paymentEntity.error_description ?? null }).eq('id', existing.id);
    if (paymentUpdate.error) throw new HttpError(500, 'Could not update failed payment.', paymentUpdate.error.message);
    if (existing.subscription_id) {
      const subscriptionUpdate = await admin.from('subscriptions').update({ status: 'past_due' }).eq('id', existing.subscription_id);
      if (subscriptionUpdate.error) throw new HttpError(500, 'Could not update subscription after failed payment.', subscriptionUpdate.error.message);
    }
    if (existing.order_id) {
      const orderUpdate = await admin.from('payment_orders').update({ status: 'failed' }).eq('id', existing.order_id).eq('status', 'created');
      if (orderUpdate.error) throw new HttpError(500, 'Could not update order after failed payment.', orderUpdate.error.message);
    }
    return { ignored: false, paymentId: existing.id };
  }

  let subscription: BillingOwnerRef | null = null;
  if (paymentEntity.subscription_id) {
    const lookup = await admin.from('subscriptions').select('id,user_id').eq('provider', 'razorpay').eq('provider_subscription_id', paymentEntity.subscription_id).maybeSingle();
    subscription = lookup.data as BillingOwnerRef | null;
    if (subscription) {
      const update = await admin.from('subscriptions').update({ status: 'past_due' }).eq('id', subscription.id);
      if (update.error) throw new HttpError(500, 'Could not update subscription after failed payment.', update.error.message);
    }
  }
  let order: BillingOwnerRef | null = null;
  if (paymentEntity.order_id) {
    const lookup = await admin.from('payment_orders').select('id,user_id').eq('provider', 'razorpay').eq('provider_order_id', paymentEntity.order_id).maybeSingle();
    order = lookup.data as BillingOwnerRef | null;
    if (order) {
      const update = await admin.from('payment_orders').update({ status: 'failed' }).eq('id', order.id).eq('status', 'created');
      if (update.error) throw new HttpError(500, 'Could not update order after failed payment.', update.error.message);
    }
  }
  const userId = subscription?.user_id ?? order?.user_id;
  if (userId) {
    const { data: payment, error } = await admin.from('payments').upsert({
      user_id: userId, order_id: order?.id ?? null, subscription_id: subscription?.id ?? null,
      provider: 'razorpay', provider_payment_id: paymentEntity.id,
      amount_minor: Number(paymentEntity.amount ?? 0), currency: paymentEntity.currency || 'INR',
      status: 'failed', payment_method: paymentEntity.method ?? null,
      failed_at: new Date().toISOString(), failure_code: paymentEntity.error_code ?? null,
      failure_message: paymentEntity.error_description ?? null,
      metadata: { provider_subscription_id: paymentEntity.subscription_id ?? null },
    }, { onConflict: 'provider,provider_payment_id' }).select('id').single();
    if (error) throw new HttpError(500, 'Could not record failed payment.', error.message);
    return { ignored: false, paymentId: payment?.id };
  }
  return { ignored: true };
}

export async function getBillingStatus(userClient: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const [{ data: subscriptions, error: subscriptionError }, { data: entitlements, error: entitlementError }] = await Promise.all([
    userClient.from('subscriptions').select('id,status,current_period_start,current_period_end,cancel_at_period_end,created_at,subscription_plans(name,code,billing_interval)').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    userClient.from('user_entitlements').select('feature_key,status,starts_at,ends_at').eq('user_id', userId).eq('status', 'active').lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`).limit(100),
  ]);
  if (subscriptionError || entitlementError) throw new HttpError(500, 'Could not load subscription status.');
  const entitlementRows = (entitlements ?? []) as EntitlementRow[];
  return {
    hasPremium: entitlementRows.some((item) => item.feature_key === 'premium_content'),
    activeFeatures: entitlementRows.map((item) => item.feature_key),
    subscriptions: subscriptions ?? [],
    entitlements: entitlements ?? [],
  };
}

export async function cancelSubscription(admin: SupabaseClient, userId: string, subscriptionId: string) {
  const { data: subscription, error } = await admin.from('subscriptions').select('id,provider_subscription_id,status')
    .eq('id', subscriptionId).eq('user_id', userId).maybeSingle();
  if (error || !subscription) throw new HttpError(404, 'Subscription not found.');
  if (!subscription.provider_subscription_id || subscription.provider_subscription_id.startsWith('lifetime:')) {
    throw new HttpError(400, 'This purchase does not have automatic renewal to cancel. Premium remains available for the recorded entitlement period.');
  }
  await razorpayRequest(`/subscriptions/${subscription.provider_subscription_id}/cancel`, 'POST', { cancel_at_cycle_end: 1 });
  const { error: updateError } = await admin.from('subscriptions').update({ cancel_at_period_end: true }).eq('id', subscription.id);
  if (updateError) throw new HttpError(500, 'Renewal cancellation was accepted by Razorpay but could not be saved locally. Refresh the subscription in the provider dashboard.', updateError.message);
  return { canceledAtPeriodEnd: true };
}


/** Create a reusable Razorpay Plan from the existing local catalog entry. */
export async function syncRazorpayPlan(admin: SupabaseClient, planId: string) {
  const { data: plan, error } = await admin.from('subscription_plans')
    .select('id,code,name,description,amount_minor,currency,billing_interval,interval_count,provider_price_id,is_active')
    .eq('id', planId).maybeSingle();
  if (error || !plan || !plan.is_active) throw new HttpError(404, 'Active subscription plan not found.');
  if (plan.billing_interval !== 'month' && plan.billing_interval !== 'year') {
    throw new HttpError(400, 'Only monthly and yearly plans can be linked to Razorpay Subscriptions.');
  }
  if (plan.provider_price_id) return { planId: plan.id, providerPlanId: plan.provider_price_id, alreadyConfigured: true };
  if (Number(plan.amount_minor) < 100) throw new HttpError(400, 'Razorpay recurring plans require at least ₹1.00 per billing cycle.');

  const remote = await razorpayRequest('/plans', 'POST', {
    period: plan.billing_interval === 'month' ? 'monthly' : 'yearly',
    interval: Number(plan.interval_count),
    item: {
      name: String(plan.name).slice(0, 255),
      amount: Number(plan.amount_minor),
      currency: plan.currency,
      description: String(plan.description ?? `Nihongo Labs ${plan.name}`).slice(0, 255),
    },
    notes: { app: 'nihongo-labs', plan_code: plan.code, local_plan_id: plan.id },
  });
  if (!remote?.id) throw new HttpError(502, 'Razorpay did not return a Plan ID.');

  const { data: updated, error: updateError } = await admin.from('subscription_plans')
    .update({ provider_price_id: remote.id, provider_product_id: remote.item?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', plan.id).is('provider_price_id', null).select('provider_price_id').maybeSingle();
  if (updateError) throw new HttpError(500, `Razorpay plan ${remote.id} was created but could not be linked locally.`, updateError.message);
  if (updated?.provider_price_id) return { planId: plan.id, providerPlanId: updated.provider_price_id, alreadyConfigured: false };

  // Another admin may have configured this plan concurrently; prefer the stored ID.
  const { data: latest, error: latestError } = await admin.from('subscription_plans').select('provider_price_id').eq('id', plan.id).single();
  if (latestError || !latest?.provider_price_id) throw new HttpError(500, 'Could not confirm the linked Razorpay Plan ID.', latestError?.message);
  return { planId: plan.id, providerPlanId: latest.provider_price_id, alreadyConfigured: true, unusedRemotePlanId: remote.id };
}

export async function getBillingProfile(userClient: SupabaseClient, userId: string) {
  const { data, error } = await userClient.from('billing_profiles')
    .select('billing_name,billing_email,phone,country_code,address,tax_id,updated_at')
    .eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, 'Could not load billing profile.', error.message);
  return data;
}

export async function saveBillingProfile(userClient: SupabaseClient, userId: string, input: {
  billingName?: string; billingEmail?: string; phone?: string; countryCode?: string;
  address?: Record<string, unknown>; taxId?: string;
}) {
  const patch: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (input.billingName !== undefined) patch.billing_name = input.billingName;
  if (input.billingEmail !== undefined) patch.billing_email = input.billingEmail;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.countryCode !== undefined) patch.country_code = input.countryCode.toUpperCase();
  if (input.address !== undefined) patch.address = input.address;
  if (input.taxId !== undefined) patch.tax_id = input.taxId;
  const { data, error } = await userClient.from('billing_profiles')
    .upsert(patch, { onConflict: 'user_id' })
    .select('billing_name,billing_email,phone,country_code,address,tax_id,updated_at').single();
  if (error) throw new HttpError(500, 'Could not save billing profile.', error.message);
  return data;
}


/**
 * Admin-initiated Razorpay refund. The pending ledger row and idempotency key are
 * persisted before the provider call so a timeout can be retried safely with the
 * exact same request body and X-Refund-Idempotency value.
 */
export async function createPaymentRefund(
  admin: SupabaseClient,
  input: { paymentId: string; amountMinor: number; idempotencyKey: string; reason?: string },
) {
  const { data: payment, error: paymentError } = await admin.from('payments')
    .select('id,user_id,provider,provider_payment_id,amount_minor,refunded_amount_minor,currency,status')
    .eq('id', input.paymentId).maybeSingle();
  if (paymentError) throw new HttpError(500, 'Could not load payment for refund.', paymentError.message);
  if (!payment) throw new HttpError(404, 'Payment not found.');
  if (payment.provider !== 'razorpay' || !payment.provider_payment_id) {
    throw new HttpError(400, 'Only captured Razorpay payments can be refunded through this endpoint.');
  }
  if (payment.status !== 'captured' && payment.status !== 'partially_refunded') {
    throw new HttpError(409, 'Only captured or partially refunded payments can be refunded.');
  }
  const remaining = Number(payment.amount_minor) - Number(payment.refunded_amount_minor ?? 0);
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > remaining) {
    throw new HttpError(400, 'Refund amount must be positive and cannot exceed the remaining captured amount.');
  }

  const { data: existingLedger, error: ledgerError } = await admin.from('payment_refunds')
    .select('id,amount_minor,status,provider_refund_id,reason')
    .eq('payment_id', payment.id).eq('idempotency_key', input.idempotencyKey).maybeSingle();
  if (ledgerError) throw new HttpError(500, 'Could not inspect refund idempotency record.', ledgerError.message);
  let ledger = existingLedger;

  if (ledger) {
    if (Number(ledger.amount_minor) !== input.amountMinor || String(ledger.reason ?? '') !== String(input.reason ?? '')) {
      throw new HttpError(409, 'This refund idempotency key was already used with a different amount or reason.');
    }
    if (ledger.status === 'processed') {
      return { refundId: ledger.provider_refund_id, status: 'processed', alreadyProcessed: true };
    }
    if (ledger.status === 'pending' && ledger.provider_refund_id) {
      return { refundId: ledger.provider_refund_id, status: 'pending', alreadySubmitted: true };
    }
    if (ledger.status === 'pending') {
      throw new HttpError(409, 'This refund request is already being submitted. Check Razorpay before retrying.');
    }
    // A failed/ambiguous request can be safely retried with the same key and exact body.
    const { error: resetError } = await admin.from('payment_refunds').update({ status: 'pending' })
      .eq('id', ledger.id).eq('status', 'failed');
    if (resetError) throw new HttpError(500, 'Could not reopen failed refund request.', resetError.message);
  } else {
    const { data: inserted, error: insertError } = await admin.from('payment_refunds').insert({
      payment_id: payment.id,
      user_id: payment.user_id,
      amount_minor: input.amountMinor,
      currency: payment.currency,
      status: 'pending',
      reason: input.reason ?? null,
      idempotency_key: input.idempotencyKey,
    }).select('id').single();
    if (insertError?.code === '23505') {
      const raced = await admin.from('payment_refunds').select('id,amount_minor,status,provider_refund_id,reason')
        .eq('payment_id', payment.id).eq('idempotency_key', input.idempotencyKey).maybeSingle();
      if (raced.error || !raced.data) throw new HttpError(409, 'A refund with this key is already being created.');
      if (Number(raced.data.amount_minor) !== input.amountMinor || String(raced.data.reason ?? '') !== String(input.reason ?? '')) {
        throw new HttpError(409, 'This refund idempotency key was already used with a different amount or reason.');
      }
      if (raced.data.provider_refund_id) return { refundId: raced.data.provider_refund_id, status: raced.data.status, alreadySubmitted: true };
      throw new HttpError(409, 'A refund with this key is already being submitted.');
    }
    if (insertError || !inserted) throw new HttpError(500, 'Could not reserve refund request.', insertError?.message);
    ledger = { id: inserted.id, amount_minor: input.amountMinor, status: 'pending', provider_refund_id: null, reason: input.reason ?? null };
  }

  let providerRefund: RazorpayResponse;
  try {
    providerRefund = await razorpayRequest(
      `/payments/${payment.provider_payment_id}/refund`,
      'POST',
      { amount: input.amountMinor, speed: 'normal', notes: { reason: (input.reason ?? 'Nihongo Labs refund').slice(0, 500) } },
      { 'X-Refund-Idempotency': input.idempotencyKey },
    );
  } catch (error) {
    await admin.from('payment_refunds').update({ status: 'failed' }).eq('id', ledger.id);
    throw error;
  }

  if (!providerRefund?.id) throw new HttpError(502, 'Razorpay did not return a refund identifier. Reconcile this request before retrying.');
  const providerStatus = String(providerRefund.status ?? 'pending');
  const { error: linkError } = await admin.from('payment_refunds').update({
    provider_refund_id: providerRefund.id,
    // Keep it pending until the processed webhook (or synchronous processed status)
    // runs the same atomic ledger/payment update function.
    status: 'pending',
  }).eq('id', ledger.id);
  if (linkError) throw new HttpError(500, `Razorpay refund ${providerRefund.id} was created but could not be linked locally. Reconcile it in Razorpay.`, linkError.message);

  if (providerStatus === 'processed') {
    const { error: finalizeError } = await admin.rpc('record_payment_refund', {
      _payment_id: payment.id,
      _provider_refund_id: providerRefund.id,
      _amount_minor: input.amountMinor,
      _reason: input.reason ?? null,
    });
    if (finalizeError) throw new HttpError(500, 'Razorpay processed the refund, but local finalization failed. The refund webhook will reconcile it.', finalizeError.message);
  }
  return { refundId: providerRefund.id, status: providerStatus, alreadyProcessed: false };
}
