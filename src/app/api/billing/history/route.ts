import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';



export async function GET() {
    await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const [payments, orders] = await Promise.all([
      context.supabase.from('payments').select('id,provider_payment_id,amount_minor,refunded_amount_minor,currency,status,payment_method,captured_at,failed_at,created_at').eq('user_id', context.user.id).order('created_at', { ascending: false }).limit(100),
      context.supabase.from('payment_orders').select('id,provider_order_id,amount_minor,currency,status,created_at,paid_at,subscription_plans(name,code)').eq('user_id', context.user.id).order('created_at', { ascending: false }).limit(100),
    ]);
    const error = payments.error || orders.error;
    if (error) throw new HttpError(500, 'Could not load payment history.', error.message);
    return NextResponse.json({ payments: payments.data ?? [], orders: orders.data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
