import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('browser roles cannot author verified learner progress or graded attempt state', () => {
  const migration = read('supabase/migrations/20261112123000_security_integrity_performance.sql');
  for (const table of [
    'lesson_progress',
    'vocabulary_review_state',
    'kanji_review_state',
    'quiz_attempts',
    'quiz_responses',
    'sentence_construction_attempts',
  ]) {
    assert.ok(migration.includes(`from authenticated`) && migration.includes(`on public.${table} from authenticated`), table);
  }
  assert.ok(migration.includes('grant all privileges on public.lesson_progress, public.vocabulary_review_state,'));
  assert.ok(migration.includes('to service_role;'));
  const sentence = read('src/app/api/learning/sentence-construction/route.ts');
  const kanji = read('src/app/api/kanji/review/route.ts');
  assert.ok(sentence.includes("createAdminSupabase().from('sentence_construction_attempts').insert"));
  assert.ok(kanji.includes("createAdminSupabase().from('kanji_review_state').upsert"));
});

test('subscription and payment state transitions reject stale or regressive webhooks', () => {
  const migration = read('supabase/migrations/20261112123000_security_integrity_performance.sql');
  const billing = read('src/lib/nihongo/server/services/billing-provider-events.ts');
  assert.ok(migration.includes('provider_event_created_at'));
  assert.ok(migration.includes('_event_at < v_last_event_at'));
  assert.ok(migration.includes("v_current_status in ('canceled', 'expired')"));
  assert.ok(migration.includes("public.payments.status in ('captured', 'partially_refunded', 'refunded')"));
  assert.ok(billing.includes('unknown_provider_status'));
  assert.ok(billing.includes('apply_subscription_provider_event'));
  assert.ok(billing.includes('record_subscription_payment_monotonic'));
  assert.ok(billing.includes('payment_already_captured'));
  assert.ok(billing.includes(".in('status', ['created', 'pending', 'authorized'])"));
});

test('contact endpoint uses a database-backed per-address throttle and bounded request parsing', () => {
  const contact = read('src/app/api/contact/route.ts');
  const http = read('src/lib/nihongo/server/http.ts');
  assert.ok(contact.includes('createHmac'));
  assert.ok(contact.includes('consume_api_rate_limit'));
  assert.ok(contact.includes('_max_hits: 5'));
  assert.ok(http.includes('getReader()'));
  assert.ok(http.includes('totalBytes > maxBytes'));
  assert.ok(!http.includes('await request.text()'));
});

test('admin dashboards use batched auth lookup and SQL aggregation without mixed-currency summation', () => {
  const payments = read('src/app/api/admin/payments/route.ts');
  const overview = read('src/app/api/admin/overview/route.ts');
  const migration = read('supabase/migrations/20261112123000_security_integrity_performance.sql');
  assert.ok(payments.includes('admin_user_emails'));
  assert.ok(overview.includes('admin_user_emails'));
  assert.ok(overview.includes('admin_get_dashboard_aggregates'));
  assert.ok(!payments.includes('getUserById') && !overview.includes('getUserById'));
  assert.ok(migration.includes('group by currency'));
  assert.ok(migration.includes('activeLearnersSevenDays'));
});

test('learner settings and vocabulary queue execute single database-side operations', () => {
  const settings = read('src/app/api/learning/settings/route.ts');
  const due = read('src/app/api/learning/vocabulary-due/route.ts');
  const migration = read('supabase/migrations/20261112123000_security_integrity_performance.sql');
  assert.ok(settings.includes("rpc('update_learning_settings'"));
  const patchStart = settings.indexOf('export async function PATCH');
  assert.ok(patchStart >= 0, 'settings PATCH handler is present');
  const settingsPatch = settings.slice(patchStart);
  assert.ok(!settingsPatch.includes('Promise.all'));
  assert.ok(settingsPatch.includes("rpc('update_learning_settings'"));
  assert.ok(due.includes("rpc('get_due_vocabulary'"));
  assert.ok(!due.includes('.limit(1000)') && !due.includes('.limit(5000)'));
  assert.ok(migration.includes('security invoker') && migration.includes('get_due_vocabulary'));
});

test('signup responses do not disclose whether an email is already registered', () => {
  const auth = read('src/app/actions/auth.ts');
  const authForm = read('src/components/nihongo/auth-form.tsx');
  assert.ok(!auth.includes('alreadyRegistered'));
  assert.ok(!authForm.includes('accountAlreadyExists') && !authForm.includes('Go to sign in'));
  const userFacingMessages = [...auth.matchAll(/message:\s*'([^']*)'/g)].map((match) => match[1].toLowerCase());
  assert.ok(userFacingMessages.every((message) => !message.includes('already exists') && !message.includes('already registered')));
  assert.ok(auth.includes('If this address can be registered'));
  assert.ok(auth.includes('If this address has a pending signup'));
  // Keep provider error matching server-side while returning generic client text.
  assert.ok(auth.includes('/already registered|already exists/i'));
});

test('admin inbox status and audit writes share one database transaction', () => {
  const route = read('src/app/api/admin/messages/route.ts');
  const migration = read('supabase/migrations/20261112123000_security_integrity_performance.sql');
  assert.ok(route.includes('admin_update_inbox_status_with_audit'));
  assert.ok(!route.includes('auditError'));
  assert.ok(migration.includes('admin_update_inbox_status_with_audit'));
  assert.ok(migration.includes('insert into public.audit_logs'));
});

test('mandatory flashcard schema and RPCs are also applied by the ordered migration history', () => {
  const flashcards = read('supabase/migrations/20261108035000_flashcards_prerequisite.sql');
  const rpc = read('supabase/migrations/20261112122000_trusted_backend_rpc.sql');
  assert.ok(flashcards.includes('create table if not exists public.flashcard_decks'));
  assert.ok(flashcards.includes('create table if not exists public.flashcard_review_state'));
  for (const name of ['reserve_quiz_attempt', 'finalize_quiz_attempt', 'persist_lesson_progress', 'persist_flashcard_review', 'persist_vocabulary_review', 'record_payment_refund']) {
    assert.ok(rpc.includes(`create or replace function public.${name}`), name);
  }
});

test('authenticated learners never receive demo catalog rows after a database content failure', () => {
  const data = read('src/lib/nihongo/data.ts');
  assert.ok(!data.includes('return { items: fallback'));
  assert.ok(!data.includes("return level === 'N5' ? kanji : []"));
  assert.ok(!data.includes("return level === 'N5' ? grammar : []"));
});

test('reading studio and the reading content API use the same curated N5/N4 corpus', () => {
  const reader = read('src/components/nihongo/reading-studio.tsx');
  const api = read('src/app/api/learning/content/route.ts');
  const corpus = read('src/lib/nihongo/reading-content.ts');
  assert.ok(reader.includes('getPassagesForLevel'));
  assert.ok(api.includes('getPassagesForLevel'));
  assert.ok(api.includes('passages.slice(offset, offset + limit)'));
  assert.ok(corpus.includes('export function getPassagesForLevel'));
  assert.ok(!api.includes('from(\'courses\').select(\'id,course_units'));
});

test('Kanji Studio is isolated and never masks database errors with demo N5 content', () => {
  const features = read('src/components/nihongo/learning-features.tsx');
  const studio = read('src/components/nihongo/kanji-studio.tsx');
  assert.ok(features.includes("import KanjiStudio from './kanji-studio'"));
  assert.ok(features.includes('<KanjiStudio search={props.search}'));
  assert.ok(studio.includes("kind=kanji&level="));
  assert.ok(studio.includes('setDeckItems([])'));
  assert.ok(!studio.includes("setDeckItems(level === 'N5'"));
  assert.ok(!features.includes('kanjiItems'));
});

test('admin monthly collection is rendered as a currency-separated breakdown', () => {
  const overview = read('src/app/api/admin/overview/route.ts');
  const workspace = read('src/components/nihongo/admin/admin-workspace.tsx');
  assert.ok(overview.includes('monthlyPaymentsByCurrency'));
  assert.ok(overview.includes("find((row) => row.currency === 'INR')"));
  assert.ok(workspace.includes('monthlyPaymentsByCurrency'));
  assert.ok(workspace.includes('money(row.netMinor, row.currency)'));
});

test('database content loaders propagate failures to the learning section instead of silently returning demo data', () => {
  const data = read('src/lib/nihongo/data.ts');
  const app = read('src/components/nihongo/learning-app.tsx');
  const features = read('src/components/nihongo/learning-features.tsx');
  for (const name of ['getPublishedVocabulary', 'getPublishedKanji', 'getPublishedGrammar', 'getPublishedFlashcards', 'getReadingPassages']) {
    const start = data.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, name);
    const next = data.indexOf('\nexport ', start + 10);
    const block = data.slice(start, next < 0 ? data.length : next);
    assert.doesNotMatch(block, /catch\s*\(/, `${name} must not swallow request failures`);
  }
  assert.match(features, /console\.error\('\[Nihongo Labs grammar content\]'/);
  assert.match(features, /setListError\('Grammar content could not be loaded/);
  assert.match(app, /flashcard content bootstrap.*error/);
  assert.doesNotMatch(data, /apiGet<BillingStatusResponse>\([^\n]+\)\.catch/);
});
