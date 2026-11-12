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
