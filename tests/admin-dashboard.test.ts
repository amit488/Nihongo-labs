import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('admin pages are protected by database roles and reuse existing authentication', () => {
  const layout = read('src/app/admin/layout.tsx');
  const access = read('src/lib/nihongo/server/admin.ts');
  assert.match(layout, /requireAdmin\(\)/);
  assert.match(layout, /redirect\('\/login\?next=%2Fadmin'\)/);
  assert.match(access, /from\('user_roles'\)/);
  assert.match(access, /ADMIN_ROLES/);
  assert.match(access, /super_admin/);
  assert.match(access, /admin/);
  const authAction = read('src/app/actions/auth.ts');
  const authForm = read('src/components/nihongo/auth-form.tsx');
  assert.match(authAction, /redirectTo: administrator \? '\/admin' : '\/learn'/);
  assert.match(authForm, /router\.push\(result\.redirectTo/);
});

test('admin APIs verify roles on the server and disable caching for private data', () => {
  const overview = read('src/app/api/admin/overview/route.ts');
  const users = read('src/app/api/admin/users/route.ts');
  const payments = read('src/app/api/admin/payments/route.ts');
  const messages = read('src/app/api/admin/messages/route.ts');
  for (const route of [overview, users, payments, messages]) {
    assert.match(route, /requireAdminApi/);
    assert.match(route, /createAdminSupabase/);
  }
  assert.match(overview, /Cache-Control.*private, no-store/);
  assert.match(users, /Cache-Control.*private, no-store/);
  assert.match(messages, /assertSameOrigin/);
  assert.match(messages, /audit_logs/);
});

test('admin browser UI calls protected live endpoints and contains no service credentials', () => {
  const workspace = read('src/components/nihongo/admin/admin-workspace.tsx');
  const shell = read('src/components/nihongo/admin/admin-shell.tsx');
  assert.match(workspace, /api\/admin\/overview/);
  assert.match(workspace, /api\/admin\/users/);
  assert.match(workspace, /api\/admin\/payments/);
  assert.match(workspace, /api\/admin\/messages/);
  assert.match(shell, /Back to learning workspace/);
  assert.doesNotMatch(workspace + shell, /SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY/);
});

test('admin index migration is additive and idempotent', () => {
  const migration = read('supabase/migrations/20261110180000_admin_dashboard_indexes.sql');
  assert.ok(migration.includes('create index if not exists profiles_created_at_admin_idx'));
  assert.ok(migration.includes('create index if not exists payments_created_at_admin_idx'));
  assert.ok(migration.includes('create index if not exists user_daily_activity_date_admin_idx'));
});


test('database health API is protected and the inventory RPC is service-role-only', () => {
  const route = read('src/app/api/admin/database/route.ts');
  const migration = read('supabase/migrations/20261112090000_admin_database_health.sql');
  const workspace = read('src/components/nihongo/admin/admin-workspace.tsx');
  const shell = read('src/components/nihongo/admin/admin-shell.tsx');
  assert.match(route, /requireAdminApi/);
  assert.match(route, /createAdminSupabase/);
  assert.match(route, /get_admin_database_health/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.get_admin_database_health\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_database_health\(\) to service_role/);
  assert.match(workspace, /Database storage used/);
  assert.match(workspace, /estimated_rows/);
  assert.match(shell, /\/admin\/database/);
});


test('database health links to a separate, paginated Cron run history page', () => {
  const databaseRoute = read('src/app/api/admin/database/route.ts');
  const cronRoute = read('src/app/api/admin/database/cron/route.ts');
  const initialMigration = read('supabase/migrations/20261112100000_admin_cron_monitoring.sql');
  const historyMigration = read('supabase/migrations/20261112110000_admin_cron_monitoring_history_and_limit.sql');
  const workspace = read('src/components/nihongo/admin/admin-workspace.tsx');
  const cronPage = read('src/app/admin/database/cron/page.tsx');
  const styles = read('src/components/nihongo/admin/admin.module.css');

  assert.match(databaseRoute, /get_admin_database_health/);
  assert.doesNotMatch(databaseRoute, /get_admin_cron_monitoring/);
  assert.match(cronRoute, /requireAdminApi/);
  assert.match(cronRoute, /get_admin_cron_monitoring/);
  assert.match(cronRoute, /p_limit: databaseLimit/);
  assert.match(cronRoute, /Cache-Control.*private, no-store/);

  assert.match(initialMigration, /create table if not exists nihongo_admin_private\\.cron_job_run_audit/);
  assert.match(initialMigration, /get diagnostics v_deleted = row_count/);
  assert.match(initialMigration, /Every hour at minute 45 \\(IST\\)/);
  assert.match(historyMigration, /started_at - r\\.start_time/);
  assert.match(historyMigration, /create or replace function public\\.get_admin_cron_monitoring\\(p_limit integer\\)/);
  assert.match(historyMigration, /when p_limit = 0 then 1000/);
  assert.match(historyMigration, /r\\.return_message/);

  assert.match(workspace, /Cron job monitoring/);
  assert.match(workspace, /View job runs/);
  assert.match(workspace, /href="\\/admin\\/database\\/cron"/);
  assert.match(workspace, /id="cron-run-limit"/);
  assert.match(workspace, /Last 10/);
  assert.match(workspace, /Last 25/);
  assert.match(workspace, /Last 50/);
  assert.match(workspace, /All available/);
  assert.match(workspace, /Records deleted/);
  assert.match(workspace, /Error message/);
  assert.match(workspace, /timeZone: 'Asia\\/Kolkata'/);
  assert.match(cronPage, /section="cron"/);
  assert.match(styles, /cronToolbar/);
  assert.match(styles, /cronError/);
  assert.match(styles, /status_succeeded/);
});
