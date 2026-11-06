import { connection, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { listPlans } from '@/lib/nihongo/server/services/billing';
import { jsonError } from '@/lib/nihongo/server/http';

export async function GET() {
    await connection();
  try {
    const supabase = await createServerSupabase();
    return NextResponse.json({ plans: await listPlans(supabase) }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch (error) { return jsonError(error); }
}
