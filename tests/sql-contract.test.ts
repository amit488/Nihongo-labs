import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSql(name: string): string {
  const candidates = [
    resolve(process.cwd(), 'sql', name),
    resolve(process.cwd(), 'nihongo-labs-backend', 'sql', name),
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error(`Could not find ${name}; run tests from the repository root or backend source folder.`);
  return readFileSync(path, 'utf8');
}
const sql = readSql('011_backend_rpc.sql');
const seed = readSql('010_n5_content_and_plans_seed.sql');

test('quiz answer keys stay private and backend RPC is service-role-only', () => {
  assert.match(seed, /insert\s+into\s+private\.quiz_answer_keys/i);
  assert.doesNotMatch(seed, /insert\s+into\s+public\.quiz_answer_keys/i);
  assert.match(sql, /create or replace function public\.get_quiz_answer_keys/i);
  assert.match(sql, /revoke all on function public\.get_quiz_answer_keys\(uuid\[\]\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_quiz_answer_keys\(uuid\[\]\) to service_role/i);
});

test('atomic writes exist for quizzes, lessons, flashcards, vocabulary and refunds', () => {
  for (const fn of ['reserve_quiz_attempt', 'finalize_quiz_attempt', 'persist_lesson_progress', 'persist_flashcard_review', 'persist_vocabulary_review', 'record_payment_refund']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`, 'i'), `${fn} RPC missing`);
  }
});

test('FSRS review writes enforce daily new/review quotas under an activity-row lock', () => {
  assert.match(sql, /_daily_new_limit integer/i);
  assert.match(sql, /_daily_review_limit integer/i);
  assert.match(sql, /for update;/i);
  assert.match(sql, /Daily new-card limit reached/i);
  assert.match(sql, /Daily review limit reached/i);
});

test('trusted heartbeat table is blocked from browser roles', () => {
  assert.match(sql, /revoke all on public\.user_activity_heartbeat from public, anon, authenticated/i);
  assert.match(sql, /grant all privileges on public\.user_activity_heartbeat to service_role/i);
});


test('refund ledger supports local idempotency before provider submission', () => {
  assert.match(sql, /add column if not exists idempotency_key text/i);
  assert.match(sql, /payment_refunds_idempotency_uidx/i);
  assert.match(sql, /record_payment_refund/i);
});

test('study-time migration installs a protected heartbeat and atomic activity increments', () => {
  const migrationPath = resolve(process.cwd(), 'supabase', 'migrations', '20261108010000_study_time_tracking.sql');
  assert.equal(existsSync(migrationPath), true, 'study-time migration is missing');
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /create table if not exists public\.user_activity_heartbeat/i);
  assert.match(migration, /for update;/i);
  assert.match(migration, /interval '58 seconds'/i);
  assert.match(migration, /jsonb_build_object\('study_seconds', 60\)/i);
  assert.match(migration, /revoke all on function public\.record_user_heartbeat\(uuid, date\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_user_heartbeat\(uuid, date\) to service_role/i);
});


test('accurate study-time heartbeat accepts partial batches and caps them to server elapsed time', () => {
  const migrationPath = resolve(process.cwd(), 'supabase', 'migrations', '20261108020000_accurate_study_time_tracking.sql');
  assert.equal(existsSync(migrationPath), true, 'accurate study-time migration is missing');
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /create table if not exists public\.user_activity_heartbeat_requests/i);
  assert.match(migration, /record_user_heartbeat\([\s\S]*?_observed_seconds integer[\s\S]*?_request_id uuid[\s\S]*?returns integer/i);
  assert.match(migration, /for update;/i);
  assert.match(migration, /least\(_observed_seconds, v_elapsed_seconds\)/i);
  assert.match(migration, /least\(_observed_seconds, 30\)/i);
  assert.match(migration, /jsonb_build_object\('study_seconds', v_credited_seconds\)/i);
  assert.match(migration, /revoke all on function public\.record_user_heartbeat\(uuid, date, integer, uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_user_heartbeat\(uuid, date, integer, uuid\) to service_role/i);
  assert.match(migration, /select user_id, credited_seconds[\s\S]*?where request_id = _request_id/i);
});

test('study-time client persists partial seconds and coordinates active tabs', () => {
  const componentPath = resolve(process.cwd(), 'src', 'components', 'nihongo', 'learning-app.tsx');
  const component = readFileSync(componentPath, 'utf8');
  assert.match(component, /localStorage\.setItem\(storageKey/);
  assert.match(component, /navigator as unknown as \{ locks\?: BrowserLockManager \}/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /pagehide/);
  assert.match(component, /sendPendingTime\(true\)/);
  assert.match(component, /crypto\.randomUUID\(\)/);
  assert.match(component, /inactivityLimitMilliseconds = 5 \* 60 \* 1000/);
  assert.match(component, /studyTimerRef = useRef<HTMLSpanElement>\(null\)/);
  assert.match(component, /studyTimerRef\.current\.textContent = `Study · \$\{minutes\}:/);
  assert.match(component, /<span ref=\{studyTimerRef\} className=/);
  assert.doesNotMatch(component, /setLiveStudySeconds/);
});


test('heartbeat idempotency records expire after eight days without deleting daily learner aggregates', () => {
  const migrationPath = resolve(process.cwd(), 'supabase', 'migrations', '20261108030000_heartbeat_request_retention.sql');
  assert.equal(existsSync(migrationPath), true, 'heartbeat retention migration is missing');
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /_request_created_at timestamptz/i);
  assert.match(migration, /_request_created_at < clock_timestamp\(\) - interval '8 days'/i);
  assert.match(migration, /HEARTBEAT_REQUEST_EXPIRED/);
  assert.match(migration, /select user_id, credited_seconds[\s\S]*?where request_id = _request_id[\s\S]*?return v_prior_credited_seconds/i);
  assert.match(migration, /delete from public\.user_activity_heartbeat_requests[\s\S]*?created_at < clock_timestamp\(\) - interval '8 days'/i);
  assert.match(migration, /cron\.schedule\([\s\S]*?'15 \* \* \* \*'/i);
  assert.match(migration, /delete from cron\.job_run_details[\s\S]*?interval '8 days'/i);
  assert.doesNotMatch(migration, /delete from public\.user_daily_activity/i);
});


test('dashboard and flashcard queue use RLS-respecting database RPCs', () => {
  const path = resolve(process.cwd(), 'supabase', 'migrations', '20261108040000_learning_dashboard_queue_and_billing_rpcs.sql');
  assert.equal(existsSync(path), true, 'dashboard/queue migration is missing');
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /create or replace function public\.get_learning_dashboard\(\)[\s\S]*?security invoker/i);
  assert.match(migration, /grant execute on function public\.get_learning_dashboard\(\) to authenticated/i);
  assert.match(migration, /create or replace function public\.get_due_flashcards\([\s\S]*?security invoker/i);
  assert.match(migration, /s\.scheduler_state <> 'new'/i);
  assert.match(migration, /s\.scheduler_state = 'new' and s\.suspended_at is null/i);
  assert.match(migration, /s\.suspended_at is null/i);
  assert.match(migration, /s\.buried_until is null or s\.buried_until <= now\(\)/i);
  assert.match(migration, /order by s\.due_at, c\.sort_order/i);
  assert.match(migration, /limit v_review_remaining/i);
  assert.match(migration, /limit v_new_remaining/i);
});
test('entitlement synchronization is bulk, idempotent and service-role-only', () => {
  const path = resolve(process.cwd(), 'supabase', 'migrations', '20261108040000_learning_dashboard_queue_and_billing_rpcs.sql');
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /create or replace function public\.sync_plan_entitlements\(/i);
  assert.match(migration, /security definer[\s\S]*?pg_advisory_xact_lock/i);
  assert.match(migration, /insert into public\.user_entitlements[\s\S]*?not exists/i);
  assert.match(migration, /revoke all on function public\.sync_plan_entitlements[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.sync_plan_entitlements[\s\S]*?to service_role/i);
});
test('legacy heartbeat overloads are dropped and bootstrap keeps only the active signature', () => {
  const path = resolve(process.cwd(), 'supabase', 'migrations', '20261108040000_learning_dashboard_queue_and_billing_rpcs.sql');
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /drop function if exists public\.record_user_heartbeat\(uuid, date\)/i);
  assert.match(migration, /drop function if exists public\.record_user_heartbeat\(uuid, date, integer\)/i);
  assert.match(migration, /drop function if exists public\.record_user_heartbeat\(uuid, date, integer, uuid\)/i);
  const bootstrap = readSql('011_backend_rpc.sql');
  const definitions = bootstrap.match(/create or replace function public\.record_user_heartbeat\(/gi) ?? [];
  assert.equal(definitions.length, 1);
  assert.match(bootstrap, /record_user_heartbeat\(uuid, date, integer, uuid, timestamptz\)/i);
});
