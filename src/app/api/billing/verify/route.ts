import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { verifyPaymentSchema } from '@/lib/nihongo/server/validation';
import { verifyCheckoutSignature, razorpayRequest } from '@/lib/nihongo/server/services/razorpay';
import { activateLifetimeOrder } from '@/lib/nihongo/server/services/billing';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, verifyPaymentSchema);
    if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) throw new HttpError(400, 'Payment signature verification failed.');
    const admin = createAdminSupabase();
    const { data: order, error } = await admin.from('payment_orders').select('id,user_id,provider_order_id')
      .eq('provider_order_id', input.orderId).eq('user_id', context.user.id).maybeSingle();
    if (error || !order) throw new HttpError(404, 'Payment order not found for this account.');
    const payment = await razorpayRequest(`/payments/${input.paymentId}`, 'GET');
    const result = await activateLifetimeOrder(admin, order.id, payment);
    return NextResponse.json({ verified: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
