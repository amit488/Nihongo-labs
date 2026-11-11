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
    const { data, error } = await admin.rpc('get_admin_database_health');
    if (error) throw error;

    const health = data as DatabaseHealth;
    const configuredLimit = Number(process.env.SUPABASE_DATABASE_STORAGE_LIMIT_BYTES ?? 0);
    return NextResponse.json({
      ...health,
      storage_limit_bytes: Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : null,
      storage_limit_source: configuredLimit > 0 ? 'environment' : 'not_configured',
      generated_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
