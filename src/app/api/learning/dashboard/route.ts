import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { getDashboard } from '@/lib/nihongo/server/services/progress';
import { jsonError, HttpError } from '@/lib/nihongo/server/http';

export async function GET() {
  try {
    await connection();
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const dashboard = await getDashboard(context.supabase, context.user.id);
    return NextResponse.json(dashboard, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
