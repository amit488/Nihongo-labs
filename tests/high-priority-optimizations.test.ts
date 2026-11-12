import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('overview avoids the grammar catalogue and Grammar Studio fetches only paginated sets', () => {
  const app = read('src/components/nihongo/learning-app.tsx');
  const features = read('src/components/nihongo/learning-features.tsx');
  const bootstrapStart = app.indexOf('const load = async () => {');
  const listenerStart = app.indexOf('const { data: listener }', bootstrapStart);
  assert.ok(bootstrapStart >= 0 && listenerStart > bootstrapStart);
  const bootstrap = app.slice(bootstrapStart, listenerStart);
  assert.ok(!bootstrap.includes('getPublishedGrammar'));
  assert.ok(!bootstrap.includes('getPublishedFlashcards'));
  assert.ok(!app.includes('getPublishedGrammar'));
  assert.ok(!app.includes('grammarContentLoaded'));
  assert.ok(features.includes('getPublishedGrammar(level, {'));
  assert.ok(features.includes('limit: 10'));
  assert.ok(app.includes("active === 'flashcards' && !flashcardContentLoaded.current"));
});

test('Reading Studio and Sentence Construction load as independent chunks', () => {
  const features = read('src/components/nihongo/learning-features.tsx');
  assert.ok(features.includes("lazy(() => import('./reading-studio'))"));
  assert.ok(features.includes("lazy(() => import('./sentence-construction'))"));
  assert.ok(!features.includes("import ReadingStudio from"));
  assert.ok(!features.includes("import SentenceConstruction from"));
});

test('server-side HTTP errors do not expose details for 5xx responses', () => {
  const http = read('src/lib/nihongo/server/http.ts');
  assert.ok(http.includes('error.status >= 500 ? undefined : error.details'));
  assert.ok(http.includes('details === undefined ? {} : { details }'));
});

test('Quick Revision reuses distractor pools within one question request', () => {
  const route = read('src/app/api/learning/quick-revision/route.ts');
  assert.ok(route.includes('type OptionPoolCache = Map<string, Promise<OptionPoolRow[]>>'));
  assert.ok(route.includes("candidate.contentType + ':' + candidate.level"));
  assert.ok(route.includes('cache.set(cacheKey, poolPromise)'));
  assert.ok(route.includes('getOptions(context.supabase, selected, optionPoolCache)'));
});

test('Razorpay webhook events are atomically claimed and finalized by lease token', () => {
  const route = read('src/app/api/billing/webhook/route.ts');
  const migration = read('supabase/migrations/20261110160000_atomic_payment_webhook_claim.sql');
  assert.ok(route.includes("rpc('claim_payment_webhook_event'"));
  assert.ok(route.includes(".eq('processing_token', processingToken)"));
  assert.ok(migration.includes('processing_token uuid'));
  assert.ok(migration.includes("status in ('received', 'failed')"));
  assert.ok(migration.includes('received_at < clock_timestamp()'));
  assert.ok(migration.includes('grant execute on function public.claim_payment_webhook_event'));
  assert.ok(migration.includes('to service_role'));
});
