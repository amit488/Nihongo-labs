import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http';
import { unixToIso, type RazorpayResponse } from './razorpay';
import { issueInvoiceForPayment, syncPlanEntitlements } from './billing';

type BillingOwnerRef = { id: string; user_id: string | null };

export type ProviderSubscriptionStatus =
  | 'incomplete' | 'trialing' | 'active' | 'past_due' | 'paused'
  | 'canceled' | 'unpaid' | 'expired';

const PROVIDER_SUBSCRIPTION_STATUS: Record<string, ProviderSubscriptionStatus> = {
  created: 'incomplete',
  pending: 'incomplete',
  authenticated: 'trialing',
  active: 'active',
  paused: 'paused',
  halted: 'unpaid',
  cancelled: 'canceled',
  canceled: 'canceled',
  completed: 'expired',
};

/** Allowlist provider states; never default an unrecognized state to active. */
export function mapRazorpaySubscriptionStatus(
  event: string,
  providerStatus: string,
): ProviderSubscriptionStatus | null {
  if (event === 'subscription.activated' || event === 'subscription.charged') {
    if (providerStatus && !(providerStatus in PROVIDER_SUBSCRIPTION_STATUS)) return null;
    return ['paused', 'halted', 'cancelled', 'canceled', 'completed'].includes(providerStatus)
      ? PROVIDER_SUBSCRIPTION_STATUS[providerStatus]
      : 'active';
  }
  if (event === 'subscription.updated') return PROVIDER_SUBSCRIPTION_STATUS[providerStatus] ?? null;
  if (event === 'subscription.cancelled') return 'canceled';
  if (event === 'subscription.halted') return 'unpaid';
  if (event === 'subscription.completed') return 'expired';
  return null;
}

export function isPaymentCaptureFinal(status: string): boolean {
  return ['captured', 'partially_refunded', 'refunded'].includes(status);
}

export async function syncSubscriptionEvent(
  admin: SupabaseClient,
  event: string,
  entity: RazorpayResponse,
  paymentEntity?: RazorpayResponse,
  eventCreatedAt?: number,
) {
  const providerSubscriptionId = entity?.id || entity?.subscription_id || paymentEntity?.subscription_id;
  if (!providerSubscriptionId) return { ignored: true, reason: 'missing_subscription_id' as const };
  const { data: subscription, error } = await admin.from('subscriptions')
    .select('id,user_id,plan_id,status,current_period_end,metadata')
    .eq('provider', 'razorpay').eq('provider_subscription_id', providerSubscriptionId).maybeSingle();
  if (error || !subscription) return { ignored: true, reason: 'subscription_not_found' as const };

  const providerStatus = String(entity.status ?? '').toLowerCase();
  const supportedEvent = [
    'subscription.activated', 'subscription.charged', 'subscription.updated',
    'subscription.cancelled', 'subscription.halted', 'subscription.completed',
  ].includes(event);
  if (!supportedEvent) return { ignored: true, reason: 'unsupported_subscription_event' as const };
  const mappedStatus = mapRazorpaySubscriptionStatus(event, providerStatus);
  if (!mappedStatus) return { ignored: true, reason: 'unknown_provider_status' as const };

  const periodStart = unixToIso(entity.current_start ?? entity.current_start_at ?? entity.start_at);
  const periodEnd = unixToIso(entity.current_end ?? entity.current_end_at ?? entity.end_at);
  const occurredAt = unixToIso(eventCreatedAt)
    ?? unixToIso(entity.updated_at)
    ?? unixToIso(entity.created_at)
    ?? new Date().toISOString();
  const { data: statusApplied, error: statusError } = await admin.rpc('apply_subscription_provider_event', {
    _subscription_id: subscription.id,
    _new_status: mappedStatus,
    _event: event,
    _provider_status: providerStatus || event,
    _event_at: occurredAt,
  });
  if (statusError) throw new HttpError(500, 'Could not safely apply subscription event.', statusError.message);

  if (statusApplied === true) {
    const { error: periodError } = await admin.from('subscriptions').update({
      current_period_start: periodStart ?? undefined,
      current_period_end: periodEnd ?? undefined,
      cancel_at_period_end: Boolean(entity.charge_at_cycle_end),
    }).eq('id', subscription.id);
    if (periodError) throw new HttpError(500, 'Could not update subscription period.', periodError.message);
  }

  let paymentId: string | null = null;
  const paymentCaptured = Boolean(paymentEntity?.id)
    && (paymentEntity?.status === 'captured' || paymentEntity?.captured === true);
  if (paymentEntity?.id && subscription.user_id) {
    const { data: recordedPaymentId, error: paymentError } = await admin.rpc('record_subscription_payment_monotonic', {
      _user_id: subscription.user_id,
      _subscription_id: subscription.id,
      _provider_payment_id: paymentEntity.id,
      _amount_minor: Number(paymentEntity.amount ?? 0),
      _currency: paymentEntity.currency || 'INR',
      _status: paymentCaptured ? 'captured' : 'authorized',
      _payment_method: paymentEntity.method ?? null,
      _captured_at: paymentCaptured ? unixToIso(paymentEntity.created_at) : null,
      _metadata: { invoice_id: paymentEntity.invoice_id ?? null, provider_subscription_id: providerSubscriptionId },
    });
    if (paymentError) throw new HttpError(500, 'Could not safely save subscription payment.', paymentError.message);
    paymentId = typeof recordedPaymentId === 'string' ? recordedPaymentId : null;
    if (paymentId && paymentCaptured) {
      const { data: planRow } = await admin.from('subscription_plans')
        .select('name').eq('id', subscription.plan_id).maybeSingle();
      await issueInvoiceForPayment(admin, {
        userId: subscription.user_id,
        subscriptionId: subscription.id,
        paymentId,
        amountMinor: Number(paymentEntity.amount ?? 0),
        currency: paymentEntity.currency || 'INR',
        planName: planRow?.name || 'Nihongo Labs subscription',
        providerInvoiceId: paymentEntity.invoice_id,
      });
    }
  }

  if (statusApplied === true && (event === 'subscription.activated' || event === 'subscription.charged') && subscription.user_id) {
    await syncPlanEntitlements(admin, {
      userId: subscription.user_id,
      planId: subscription.plan_id,
      subscriptionId: subscription.id,
      paymentId,
      startsAt: periodStart ?? occurredAt,
      endsAt: periodEnd,
    });
  }

  if (statusApplied === true && event === 'subscription.cancelled') {
    const accessEndsAt = periodEnd ?? subscription.current_period_end ?? occurredAt;
    const { error: entitlementError } = await admin.from('user_entitlements')
      .update({ ends_at: accessEndsAt, status: new Date(accessEndsAt).getTime() <= Date.now() ? 'expired' : 'active' })
      .eq('source_subscription_id', subscription.id).eq('status', 'active');
    if (entitlementError) throw new HttpError(500, 'Could not update entitlement end date.', entitlementError.message);
    const { error: cancelFieldsError } = await admin.from('subscriptions')
      .update({ canceled_at: occurredAt, ended_at: accessEndsAt, current_period_end: accessEndsAt })
      .eq('id', subscription.id);
    if (cancelFieldsError) throw new HttpError(500, 'Could not save subscription cancellation dates.', cancelFieldsError.message);
  }
  if (statusApplied === true && event === 'subscription.completed') {
    const { error: entitlementError } = await admin.from('user_entitlements')
      .update({ status: 'expired' }).eq('source_subscription_id', subscription.id);
    if (entitlementError) throw new HttpError(500, 'Could not expire subscription entitlements.', entitlementError.message);
    const { error: endedError } = await admin.from('subscriptions')
      .update({ ended_at: occurredAt }).eq('id', subscription.id);
    if (endedError) throw new HttpError(500, 'Could not save subscription completion date.', endedError.message);
  }
  return { subscriptionId: subscription.id, paymentId, statusApplied: statusApplied === true };
}

export async function syncPaymentFailure(
  admin: SupabaseClient,
  paymentEntity: RazorpayResponse,
  eventCreatedAt?: number,
) {
  if (!paymentEntity?.id) return { ignored: true, reason: 'missing_payment_id' as const };
  const occurredAt = unixToIso(eventCreatedAt)
    ?? unixToIso(paymentEntity.created_at)
    ?? new Date().toISOString();

  let existing = await admin.from('payments').select('id,subscription_id,order_id,status')
    .eq('provider', 'razorpay').eq('provider_payment_id', paymentEntity.id).maybeSingle();
  if (existing.error) throw new HttpError(500, 'Could not inspect payment state.', existing.error.message);

  let subscriptionId: string | null = existing.data?.subscription_id ?? null;
  let orderId: string | null = existing.data?.order_id ?? null;
  let paymentId: string | null = existing.data?.id ?? null;

  if (existing.data && isPaymentCaptureFinal(existing.data.status)) {
    return { ignored: true, reason: 'payment_already_captured' as const, paymentId };
  }

  if (!existing.data) {
    let subscription: BillingOwnerRef | null = null;
    if (paymentEntity.subscription_id) {
      const lookup = await admin.from('subscriptions').select('id,user_id')
        .eq('provider', 'razorpay').eq('provider_subscription_id', paymentEntity.subscription_id).maybeSingle();
      if (lookup.error) throw new HttpError(500, 'Could not find subscription for failed payment.', lookup.error.message);
      subscription = lookup.data as BillingOwnerRef | null;
    }
    let order: BillingOwnerRef | null = null;
    if (paymentEntity.order_id) {
      const lookup = await admin.from('payment_orders').select('id,user_id')
        .eq('provider', 'razorpay').eq('provider_order_id', paymentEntity.order_id).maybeSingle();
      if (lookup.error) throw new HttpError(500, 'Could not find order for failed payment.', lookup.error.message);
      order = lookup.data as BillingOwnerRef | null;
    }
    const userId = subscription?.user_id ?? order?.user_id;
    subscriptionId = subscription?.id ?? null;
    orderId = order?.id ?? null;
    if (!userId) return { ignored: true, reason: 'payment_owner_not_found' as const };

    const insert = await admin.from('payments').insert({
      user_id: userId,
      order_id: orderId,
      subscription_id: subscriptionId,
      provider: 'razorpay',
      provider_payment_id: paymentEntity.id,
      amount_minor: Number(paymentEntity.amount ?? 0),
      currency: paymentEntity.currency || 'INR',
      status: 'failed',
      payment_method: paymentEntity.method ?? null,
      failed_at: occurredAt,
      failure_code: paymentEntity.error_code ?? null,
      failure_message: paymentEntity.error_description ?? null,
      metadata: { provider_subscription_id: paymentEntity.subscription_id ?? null },
    }).select('id').maybeSingle();
    if (insert.error?.code === '23505') {
      existing = await admin.from('payments').select('id,subscription_id,order_id,status')
        .eq('provider', 'razorpay').eq('provider_payment_id', paymentEntity.id).maybeSingle();
      if (existing.error || !existing.data) throw new HttpError(500, 'Could not reconcile a concurrent payment update.', existing.error?.message);
      paymentId = existing.data.id;
      subscriptionId = existing.data.subscription_id;
      orderId = existing.data.order_id;
      if (isPaymentCaptureFinal(existing.data.status)) {
        return { ignored: true, reason: 'payment_captured_during_failure' as const, paymentId };
      }
      if (existing.data.status !== 'failed') {
        const conditional = await admin.from('payments').update({
          status: 'failed',
          failed_at: occurredAt,
          failure_code: paymentEntity.error_code ?? null,
          failure_message: paymentEntity.error_description ?? null,
        }).eq('id', paymentId).in('status', ['created', 'pending', 'authorized']).select('id').maybeSingle();
        if (conditional.error) throw new HttpError(500, 'Could not mark payment failed.', conditional.error.message);
        if (!conditional.data) return { ignored: true, reason: 'payment_state_advanced' as const, paymentId };
      }
    } else if (insert.error || !insert.data) {
      throw new HttpError(500, 'Could not record failed payment.', insert.error?.message);
    } else {
      paymentId = insert.data.id;
    }
  } else if (existing.data.status !== 'failed') {
    const conditional = await admin.from('payments').update({
      status: 'failed',
      failed_at: occurredAt,
      failure_code: paymentEntity.error_code ?? null,
      failure_message: paymentEntity.error_description ?? null,
    }).eq('id', paymentId).in('status', ['created', 'pending', 'authorized']).select('id').maybeSingle();
    if (conditional.error) throw new HttpError(500, 'Could not mark payment failed.', conditional.error.message);
    if (!conditional.data) return { ignored: true, reason: 'payment_state_advanced' as const, paymentId };
  }

  if (subscriptionId) {
    const { error } = await admin.rpc('apply_subscription_provider_event', {
      _subscription_id: subscriptionId,
      _new_status: 'past_due',
      _event: 'payment.failed',
      _provider_status: 'failed',
      _event_at: occurredAt,
    });
    if (error) throw new HttpError(500, 'Could not update subscription after failed payment.', error.message);
  }
  if (orderId) {
    const { error } = await admin.from('payment_orders').update({ status: 'failed' })
      .eq('id', orderId).eq('status', 'created');
    if (error) throw new HttpError(500, 'Could not update order after failed payment.', error.message);
  }
  return { ignored: false, paymentId };
}

