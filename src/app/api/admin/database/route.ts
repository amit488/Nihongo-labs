import { connection, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { jsonError } from '@/lib/nihongo/server/http';

type DatabaseTable = {
  schema: string;
  name: string;
  estimated_rows: number;
  total_bytes: number;
  data_bytes: number;
  index_bytes: number;
};

type CronRun = {
  run_id: number;
  status: string;
  started_at_ist: string | null;
  ended_at_ist: string | null;
  duration_ms: number | null;
  deleted_rows: number | null;
  deleted_rows_state: 'recorded' | 'rolled_back' | 'pending' | 'not_recorded';
  error_message: string | null;
};

type CronJob = {
  job_id: number;
  job_name: string;
  schedule_ist: string;
  schedule_expression: string;
  active: boolean;
  runs: CronRun[];
};

type CronMonitoring = {
  display_timezone: string;
  cron_timezone: string;
  jobs: CronJob[];
};

type DatabaseHealth = {
  database_name: string;
  database_size_bytes: number;
  table_count: number;
  empty_table_count: number;
  populated_table_count: number;
  estimated_row_count: number;
  tables: DatabaseTable[];
};

export async function GET() {
  await connection();
  try {
    await requireAdminApi();
    const admin = createAdminSupabase();
    const [healthResult, cronResult] = await Promise.all([
      admin.rpc('get_admin_database_health'),
      admin.rpc('get_admin_cron_monitoring'),
    ]);
    if (healthResult.error) throw healthResult.error;
    if (cronResult.error) throw cronResult.error;

    const health = healthResult.data as DatabaseHealth;
    const cronMonitoring = cronResult.data as CronMonitoring;
    const configuredLimit = Number(process.env.SUPABASE_DATABASE_STORAGE_LIMIT_BYTES ?? 0);
    return NextResponse.json({
      ...health,
      cron_monitoring: cronMonitoring,
      storage_limit_bytes: Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : null,
      storage_limit_source: configuredLimit > 0 ? 'environment' : 'not_configured',
      generated_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
