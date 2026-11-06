import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';



export async function GET() {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const { data, error } = await context.supabase.from('invoices')
      .select('id,invoice_number,status,currency,subtotal_minor,tax_minor,discount_minor,total_minor,line_items,issued_at,paid_at')
      .eq('user_id', context.user.id).order('issued_at', { ascending: false }).limit(100);
    if (error) throw new HttpError(500, 'Could not load invoices.', error.message);
    return NextResponse.json({ invoices: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
