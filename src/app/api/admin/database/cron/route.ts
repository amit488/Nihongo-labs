import { connection, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { jsonError } from '@/lib/nihongo/server/http';

const ALLOWED_LIMITS = new Set(['10', '25', '50', 'all']);

export async function GET(request: Request) {
  await connection();
  try {
    await requireAdminApi();
    const requestedLimit = new URL(request.url).searchParams.get('limit') ?? '10';
    const selectedLimit = ALLOWED_LIMITS.has(requestedLimit) ? requestedLimit : '10';
    const databaseLimit = selectedLimit === 'all' ? 0 : Number(selectedLimit);

    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc('get_admin_cron_monitoring', {
      p_limit: databaseLimit,
    });
    if (error) throw error;

    return NextResponse.json({
      cron_monitoring: data,
      generated_at: new Date().toISOString(),
      selected_limit: selectedLimit,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
