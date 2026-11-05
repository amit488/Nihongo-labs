import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';
import { getBillingStatus } from '@/lib/nihongo/server/services/billing';


export async function GET() {
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    return NextResponse.json(await getBillingStatus(context.supabase, context.user.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
