import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';
import { verifyWebhookSignature, type RazorpayResponse } from '@/lib/nihongo/server/services/razorpay';
import {
  activateLifetimeOrder,
  syncPaymentFailure,
  syncSubscriptionEvent,
} from '@/lib/nihongo/server/services/billing';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function asRazorpayEntity(value: unknown): RazorpayResponse | null {
  const record = asObject(value);
  return typeof record?.id === 'string' ? record as unknown as RazorpayResponse : null;
}

const MAX_WEBHOOK_BYTES = 1_000_000;
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) {
      throw new HttpError(413, 'Webhook payload is too large.');
    }

    const signature = request.headers.get('x-razorpay-signature') || '';
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      throw new HttpError(400, 'Invalid Razorpay webhook signature.');
    }

    const payload: JsonObject = (() => {
      try {
        const parsed: unknown = JSON.parse(rawBody);
        const parsedObject = asObject(parsed);
        if (!parsedObject) throw new Error('Expected a JSON object.');
        return parsedObject;
      } catch {
        throw new HttpError(400, 'Webhook body must be a JSON object.');
      }
    })();

    const event = (typeof payload.event === 'string' ? payload.event : 'unknown').slice(0, 160);
    const eventId = (request.headers.get('x-razorpay-event-id') || createHash('sha256').update(rawBody).digest('hex')).slice(0, 255);
    const admin = createAdminSupabase();

    const { data: initialPrior, error: priorError } = await admin.from('payment_webhook_events')
      .select('id,status,retry_count,received_at')
      .eq('provider', 'razorpay').eq('provider_event_id', eventId).maybeSingle();
    if (priorError) throw new HttpError(500, 'Could not inspect webhook idempotency record.', priorError.message);
    let prior = initialPrior;
    if (prior?.status === 'processed') return NextResponse.json({ received: true, duplicate: true });

    if (prior?.status === 'processing' && Date.now() - new Date(prior.received_at).getTime() < PROCESSING_LEASE_MS) {
      return NextResponse.json({ received: true, processing: true, duplicate: true });
    }

    if (!prior) {
      const inserted = await admin.from('payment_webhook_events').insert({
        provider: 'razorpay', provider_event_id: eventId, event_type: event,
        status: 'received', payload,
      }).select('id,status,retry_count,received_at').maybeSingle();
      if (inserted.error && inserted.error.code !== '23505') {
        throw new HttpError(500, 'Could not record webhook event.', inserted.error.message);
      }
      if (inserted.data) prior = inserted.data;
      else {
        const retry = await admin.from('payment_webhook_events').select('id,status,retry_count,received_at')
          .eq('provider', 'razorpay').eq('provider_event_id', eventId).maybeSingle();
        if (retry.error || !retry.data) throw new HttpError(500, 'Could not recover webhook idempotency record.', retry.error?.message);
        prior = retry.data;
        if (prior.status === 'processed') return NextResponse.json({ received: true, duplicate: true });
        if (prior.status === 'processing' && Date.now() - new Date(prior.received_at).getTime() < PROCESSING_LEASE_MS) {
          return NextResponse.json({ received: true, processing: true, duplicate: true });
        }
      }
    }

    const { data: processingToken, error: claimError } = await admin.rpc('claim_payment_webhook_event', {
      _provider: 'razorpay',
      _provider_event_id: eventId,
      _lease_seconds: PROCESSING_LEASE_MS / 1000,
    });
    if (claimError) throw new HttpError(500, 'Could not claim webhook event for processing.', claimError.message);
    if (typeof processingToken !== 'string') {
      const { data: latest, error: latestError } = await admin.from('payment_webhook_events')
        .select('status')
        .eq('provider', 'razorpay')
        .eq('provider_event_id', eventId)
        .maybeSingle();
      if (latestError) throw new HttpError(500, 'Could not inspect webhook processing status.', latestError.message);
      if (latest?.status === 'processed') return NextResponse.json({ received: true, duplicate: true });
      return NextResponse.json({ received: true, processing: true, duplicate: true });
    }

    try {
      const eventPayload = asObject(payload.payload);
      const paymentEntity = asRazorpayEntity(asObject(eventPayload?.payment)?.entity);
      const subscriptionEntity = asRazorpayEntity(asObject(eventPayload?.subscription)?.entity);
      const refund = asObject(asObject(eventPayload?.refund)?.entity);
      const paymentOrderId = typeof paymentEntity?.order_id === 'string' ? paymentEntity.order_id : null;

      if (event === 'payment.captured' && paymentOrderId && paymentEntity) {
        const { data: order, error } = await admin.from('payment_orders').select('id')
          .eq('provider', 'razorpay').eq('provider_order_id', paymentOrderId).maybeSingle();
        if (error) throw new HttpError(500, 'Could not find local payment order.', error.message);
        if (order) await activateLifetimeOrder(admin, order.id, paymentEntity);
      } else if (event.startsWith('subscription.') && subscriptionEntity) {
        await syncSubscriptionEvent(admin, event, subscriptionEntity, paymentEntity ?? undefined);
      } else if (event === 'payment.failed' && paymentEntity) {
        await syncPaymentFailure(admin, paymentEntity);
      } else if ((event === 'refund.processed' || event === 'refund.failed') && refund) {
        const refundPaymentId = typeof refund.payment_id === 'string' ? refund.payment_id : null;
        const refundId = typeof refund.id === 'string' ? refund.id : null;
        const refundNotes = asObject(refund.notes);
        const refundAcquirerData = asObject(refund.acquirer_data);
        if (!refundPaymentId) throw new HttpError(400, 'Refund webhook is missing its payment ID.');
        const { data: payment, error } = await admin.from('payments').select('id')
          .eq('provider', 'razorpay').eq('provider_payment_id', refundPaymentId).maybeSingle();
        if (error) throw new HttpError(500, 'Could not find local payment for refund.', error.message);
        if (payment && event === 'refund.processed') {
          const { error: refundError } = await admin.rpc('record_payment_refund', {
            _payment_id: payment.id,
            _provider_refund_id: refundId,
            _amount_minor: Number(refund.amount ?? 0),
            _reason: (typeof refundNotes?.reason === 'string' ? refundNotes.reason : null)
              || (typeof refundAcquirerData?.arn === 'string' ? refundAcquirerData.arn : null),
          });
          if (refundError) throw new HttpError(500, 'Could not atomically record payment refund. Run sql/011_backend_rpc.sql first.', refundError.message);
        } else if (payment && refundId) {
          const { error: failedRefundError } = await admin.from('payment_refunds').update({ status: 'failed' })
            .eq('payment_id', payment.id).eq('provider_refund_id', refundId).neq('status', 'processed');
          if (failedRefundError) throw new HttpError(500, 'Could not record failed refund event.', failedRefundError.message);
        }
      }

      const markProcessed = await admin.from('payment_webhook_events').update({
        status: 'processed', processed_at: new Date().toISOString(), processing_error: null, processing_token: null,
      }).eq('provider', 'razorpay').eq('provider_event_id', eventId)
        .eq('processing_token', processingToken).select('id').maybeSingle();
      if (markProcessed.error) throw new HttpError(500, 'Payment event completed but its receipt could not be finalized.', markProcessed.error.message);
      if (!markProcessed.data) return NextResponse.json({ received: true, processing: true, duplicate: true });
      return NextResponse.json({ received: true, processed: true });
    } catch (processingError) {
      const markFailed = await admin.from('payment_webhook_events').update({
        status: 'failed',
        processing_error: processingError instanceof Error ? processingError.message.slice(0, 2000) : 'Unknown processing error',
        processing_token: null,
      }).eq('provider', 'razorpay').eq('provider_event_id', eventId)
        .eq('processing_token', processingToken);
      if (markFailed.error) console.error('[Nihongo Labs webhook] Could not record failed event.', markFailed.error);
      throw processingError;
    }
  } catch (error) { return jsonError(error); }
}
