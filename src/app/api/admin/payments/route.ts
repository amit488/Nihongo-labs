import { connection, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { jsonError } from '@/lib/nihongo/server/http';

export async function GET() {
  await connection();
  try {
    await requireAdminApi();
    const admin = createAdminSupabase();
    const { data, error } = await admin.from('payments')
      .select('id,user_id,order_id,subscription_id,provider,provider_payment_id,amount_minor,refunded_amount_minor,currency,status,payment_method,captured_at,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const ids = Array.from(new Set((data ?? []).map((row) => row.user_id).filter(Boolean)));
    const emails = new Map<string, string>();
    await Promise.all(ids.map(async (id) => {
      const { data: result } = await admin.auth.admin.getUserById(String(id));
      if (result.user?.email) emails.set(String(id), result.user.email);
    }));

    return NextResponse.json({
      payments: (data ?? []).map((row) => ({
        id: row.id,
        email: row.user_id ? emails.get(String(row.user_id)) ?? '—' : 'Deleted account',
        provider: row.provider,
        providerPaymentId: row.provider_payment_id,
        amountMinor: Number(row.amount_minor ?? 0),
        refundedMinor: Number(row.refunded_amount_minor ?? 0),
        currency: row.currency,
        status: row.status,
        method: row.payment_method,
        capturedAt: row.captured_at,
        createdAt: row.created_at,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
