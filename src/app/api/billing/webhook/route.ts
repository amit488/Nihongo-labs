import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';
import { verifyWebhookSignature } from '@/lib/nihongo/server/services/razorpay';
import {
  activateLifetimeOrder,
  syncPaymentFailure,
  syncSubscriptionEvent,
} from '@/lib/nihongo/server/services/billing';

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

    let payload: any;
    try { payload = JSON.parse(rawBody); }
    catch { throw new HttpError(400, 'Webhook body must be valid JSON.'); }

    const event = String(payload?.event || 'unknown').slice(0, 160);
    const eventId = (request.headers.get('x-razorpay-event-id') || createHash('sha256').update(rawBody).digest('hex')).slice(0, 255);
    const admin = createAdminSupabase();

    let { data: prior, error: priorError } = await admin.from('payment_webhook_events')
      .select('id,status,retry_count,received_at')
      .eq('provider', 'razorpay').eq('provider_event_id', eventId).maybeSingle();
    if (priorError) throw new HttpError(500, 'Could not inspect webhook idempotency record.', priorError.message);
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

    const markProcessing = await admin.from('payment_webhook_events').update({
      status: 'processing', retry_count: Number(prior?.retry_count ?? 0) + 1,
      received_at: new Date().toISOString(), processing_error: null,
    }).eq('provider', 'razorpay').eq('provider_event_id', eventId);
    if (markProcessing.error) throw new HttpError(500, 'Could not mark webhook as processing.', markProcessing.error.message);

    try {
      const paymentEntity = payload?.payload?.payment?.entity;
      const subscriptionEntity = payload?.payload?.subscription?.entity;

      if (event === 'payment.captured' && paymentEntity?.order_id) {
        const { data: order, error } = await admin.from('payment_orders').select('id')
          .eq('provider', 'razorpay').eq('provider_order_id', paymentEntity.order_id).maybeSingle();
        if (error) throw new HttpError(500, 'Could not find local payment order.', error.message);
        if (order) await activateLifetimeOrder(admin, order.id, paymentEntity);
      } else if (event.startsWith('subscription.') && subscriptionEntity) {
        await syncSubscriptionEvent(admin, event, subscriptionEntity, paymentEntity);
      } else if (event === 'payment.failed' && paymentEntity?.id) {
        await syncPaymentFailure(admin, paymentEntity);
      } else if ((event === 'refund.processed' || event === 'refund.failed') && payload?.payload?.refund?.entity) {
        const refund = payload.payload.refund.entity;
        const { data: payment, error } = await admin.from('payments').select('id')
          .eq('provider', 'razorpay').eq('provider_payment_id', refund.payment_id).maybeSingle();
        if (error) throw new HttpError(500, 'Could not find local payment for refund.', error.message);
        if (payment && event === 'refund.processed') {
          const { error: refundError } = await admin.rpc('record_payment_refund', {
            _payment_id: payment.id,
            _provider_refund_id: refund.id ?? null,
            _amount_minor: Number(refund.amount ?? 0),
            _reason: refund.notes?.reason || refund.acquirer_data?.arn || null,
          });
          if (refundError) throw new HttpError(500, 'Could not atomically record payment refund. Run sql/011_backend_rpc.sql first.', refundError.message);
        } else if (payment && refund.id) {
          const { error: failedRefundError } = await admin.from('payment_refunds').update({ status: 'failed' })
            .eq('payment_id', payment.id).eq('provider_refund_id', refund.id).neq('status', 'processed');
          if (failedRefundError) throw new HttpError(500, 'Could not record failed refund event.', failedRefundError.message);
        }
      }

      const markProcessed = await admin.from('payment_webhook_events').update({
        status: 'processed', processed_at: new Date().toISOString(), processing_error: null,
      }).eq('provider', 'razorpay').eq('provider_event_id', eventId);
      if (markProcessed.error) throw new HttpError(500, 'Payment event completed but its receipt could not be finalized.', markProcessed.error.message);
      return NextResponse.json({ received: true, processed: true });
    } catch (processingError) {
      const markFailed = await admin.from('payment_webhook_events').update({
        status: 'failed', processing_error: processingError instanceof Error ? processingError.message.slice(0, 2000) : 'Unknown processing error',
      }).eq('provider', 'razorpay').eq('provider_event_id', eventId);
      if (markFailed.error) console.error('[Nihongo Labs webhook] Could not record failed event.', markFailed.error);
      throw processingError;
    }
  } catch (error) { return jsonError(error); }
}
