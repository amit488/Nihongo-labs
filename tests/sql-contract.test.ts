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

test('My Progress dashboard uses saved grammar, learned vocabulary and full graded Kana/Reading history', () => {
  const path = resolve(process.cwd(), 'supabase', 'migrations', '20261110110000_fix_my_progress_sources.sql');
  assert.equal(existsSync(path), true, 'My Progress source migration is missing');
  const migration = readFileSync(path, 'utf8');

  assert.match(migration, /public\.user_grammar_progress/i);
  assert.match(migration, /public\.user_vocabulary_progress/i);
  assert.match(migration, /public\.vocabulary_review_state/i);
  assert.match(migration, /s\.repetitions >= 3/i);
  assert.match(migration, /mastery_attempt_summary as/i);
  assert.match(migration, /a\.status = 'graded'/i);
  assert.match(migration, /coalesce\(round\(a\.kana_score\)::integer, b\.kana_unit_percentage\)/i);
  assert.match(migration, /coalesce\(round\(a\.reading_score\)::integer, b\.reading_unit_percentage\)/i);
  assert.match(migration, /c\.slug = 'nihongo-n5-foundations'/i);
  assert.match(migration, /exists \([\s\S]*?from public\.quizzes q[\s\S]*?q\.lesson_id = l\.id/i);
});

test('graded quiz submissions update their linked lesson progress', () => {
  const servicePath = resolve(process.cwd(), 'src', 'lib', 'nihongo', 'server', 'services', 'practice.ts');
  const service = readFileSync(servicePath, 'utf8');
  assert.match(service, /select\('id,slug,title,lesson_id,pass_percentage/);
  assert.match(service, /persist_lesson_progress/);
  assert.match(service, /const lessonStatus = passed \? 'completed' : 'in_progress'/);
  assert.match(service, /\.eq\('slug', 'katakana'\)/);
});

test('My Progress UI shows source counters and refreshes after saved learner actions', () => {
  const appPath = resolve(process.cwd(), 'src', 'components', 'nihongo', 'learning-app.tsx');
  const featuresPath = resolve(process.cwd(), 'src', 'components', 'nihongo', 'learning-features.tsx');
  const app = readFileSync(appPath, 'utf8');
  const features = readFileSync(featuresPath, 'utf8');
  assert.match(app, /snapshot\.grammarUnderstood/);
  assert.match(app, /snapshot\.vocabularyMastered/);
  assert.match(app, /snapshot\.readingAttempts/);
  assert.match(app, /snapshot\.kanaAttempts/);
  assert.match(app, /snapshot\.lessonsTotal/);
  assert.match(features, /await onProgressSaved\(\)/);
  assert.match(features, /void onProgressSaved\(\)/);
});

test('N5 quizzes are linked to their matching curriculum lessons in starter content', () => {
  const seed = readSql('010_n5_content_and_plans_seed.sql');
  const daily = seed.split(/\r?\n/).find((line) => line.includes("'n5-daily-practice'"));
  const grammar = seed.split(/\r?\n/).find((line) => line.includes("'n5-grammar-particles'"));
  const reading = seed.split(/\r?\n/).find((line) => line.includes("'n5-reading-check'"));
  const mock = seed.split(/\r?\n/).find((line) => line.includes("'n5-mock-exam-01'"));

  assert.ok(daily?.includes("u.slug='practice'") && daily.includes("l.slug='daily-practice'"));
  assert.ok(grammar?.includes("u.slug='grammar'") && grammar.includes("l.slug='particles'"));
  assert.ok(reading?.includes("u.slug='reading'") && reading.includes("l.slug='short-passages'"));
  assert.ok(mock?.includes("u.slug='exams'") && mock.includes("l.slug='mock-exam-one'"));
});


test('medium-priority optimization migration indexes existing substring searches', () => {
  const path = resolve(process.cwd(), 'supabase', 'migrations', '20261110170000_medium_priority_optimizations.sql');
  assert.equal(existsSync(path), true, 'medium-priority optimization migration is missing');
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /create extension if not exists pg_trgm/i);
  for (const indexName of [
    'vocabulary_entries_word_trgm_idx',
    'vocabulary_entries_kana_trgm_idx',
    'vocabulary_entries_meaning_trgm_idx',
    'vocabulary_entries_romaji_trgm_idx',
    'grammar_points_title_trgm_idx',
    'grammar_points_pattern_trgm_idx',
    'grammar_points_explanation_trgm_idx',
    'kanji_entries_character_trgm_idx',
    'kanji_entries_meaning_trgm_idx',
    'lessons_title_trgm_idx',
    'lessons_summary_trgm_idx',
    'courses_title_trgm_idx',
    'courses_subtitle_trgm_idx',
    'courses_description_trgm_idx',
    'quizzes_slug_trgm_idx',
    'quick_revision_attempts_user_type_created_idx',
    'sentence_construction_attempts_user_created_idx',
  ]) assert.match(migration, new RegExp(indexName, 'i'), indexName);
  assert.match(migration, /using gin \([\s\S]*?gin_trgm_ops/i);
  assert.ok(migration.includes("where tag ~* '^[a-z0-9:_-]{2,80}
});

test('progress and intelligence routes use database-side aggregation', () => {
  const levelRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'learning', 'level-progress', 'route.ts'), 'utf8');
  const vocabularyRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'learning', 'vocabulary-intelligence', 'route.ts'), 'utf8');
  const grammarRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'learning', 'grammar-intelligence', 'route.ts'), 'utf8');
  const kanjiRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'kanji', 'progress', 'route.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'supabase', 'migrations', '20261110170000_medium_priority_optimizations.sql'), 'utf8');

  assert.match(levelRoute, /rpc\('get_level_progress'/i);
  assert.match(vocabularyRoute, /rpc\('get_vocabulary_intelligence'/i);
  assert.match(grammarRoute, /rpc\('get_grammar_intelligence'/i);
  assert.match(kanjiRoute, /kanji_review_state[\s\S]*?kanji_entries!inner/i);
  assert.doesNotMatch(kanjiRoute, /const ids = \(kanjiRows/);
  for (const functionName of ['get_level_progress', 'get_vocabulary_intelligence', 'get_grammar_intelligence']) {
    assert.match(migration, new RegExp('create or replace function public\\.' + functionName + '[\\s\\S]*?security invoker', 'i'), functionName);
  }
  assert.match(migration, /grant execute on function public\.get_level_progress\(text\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.get_vocabulary_intelligence\(text\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.get_grammar_intelligence\(\) to authenticated/i);
});

test('manual dashboard RPC matches the canonical My Progress migration', () => {
  const canonical = readFileSync(resolve(process.cwd(), 'supabase', 'migrations', '20261110110000_fix_my_progress_sources.sql'), 'utf8');
  const manual = readSql('011_backend_rpc.sql');
  const extract = (source: string) => source.match(/create or replace function public\.get_learning_dashboard\(\)[\s\S]*?\$\$;/i)?.[0]?.replace(/\s+/g, ' ').trim();
  assert.ok(extract(canonical), 'canonical dashboard function is missing');
  assert.equal(extract(manual), extract(canonical), 'manual backend SQL has drifted from the canonical dashboard function');
});
"), 'grammar tag regex must be closed');
  assert.equal((migration.match(/create or replace function public\.get_grammar_intelligence/g) ?? []).length, 1);
  assert.ok(migration.trimEnd().endsWith('commit;'), 'migration must not contain statements after COMMIT');
});

test('progress and intelligence routes use database-side aggregation', () => {
  const levelRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'learning', 'level-progress', 'route.ts'), 'utf8');
  const vocabularyRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'learning', 'vocabulary-intelligence', 'route.ts'), 'utf8');
  const grammarRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'learning', 'grammar-intelligence', 'route.ts'), 'utf8');
  const kanjiRoute = readFileSync(resolve(process.cwd(), 'src', 'app', 'api', 'kanji', 'progress', 'route.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'supabase', 'migrations', '20261110170000_medium_priority_optimizations.sql'), 'utf8');

  assert.match(levelRoute, /rpc\('get_level_progress'/i);
  assert.match(vocabularyRoute, /rpc\('get_vocabulary_intelligence'/i);
  assert.match(grammarRoute, /rpc\('get_grammar_intelligence'/i);
  assert.match(kanjiRoute, /kanji_review_state[\s\S]*?kanji_entries!inner/i);
  assert.doesNotMatch(kanjiRoute, /const ids = \(kanjiRows/);
  for (const functionName of ['get_level_progress', 'get_vocabulary_intelligence', 'get_grammar_intelligence']) {
    assert.match(migration, new RegExp('create or replace function public\\.' + functionName + '[\\s\\S]*?security invoker', 'i'), functionName);
  }
  assert.match(migration, /grant execute on function public\.get_level_progress\(text\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.get_vocabulary_intelligence\(text\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.get_grammar_intelligence\(\) to authenticated/i);
});

test('manual dashboard RPC matches the canonical My Progress migration', () => {
  const canonical = readFileSync(resolve(process.cwd(), 'supabase', 'migrations', '20261110110000_fix_my_progress_sources.sql'), 'utf8');
  const manual = readSql('011_backend_rpc.sql');
  const extract = (source: string) => source.match(/create or replace function public\.get_learning_dashboard\(\)[\s\S]*?\$\$;/i)?.[0]?.replace(/\s+/g, ' ').trim();
  assert.ok(extract(canonical), 'canonical dashboard function is missing');
  assert.equal(extract(manual), extract(canonical), 'manual backend SQL has drifted from the canonical dashboard function');
});
