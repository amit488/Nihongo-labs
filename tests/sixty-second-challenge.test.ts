import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import testCase from 'node:test';

testCase('60-second challenge mixes learned content, both kana scripts and sentence ordering', async () => {
  const component = await readFile(new URL('../src/components/nihongo/sixty-second-challenge.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/app/api/learning/sixty-second-challenge/route.ts', import.meta.url), 'utf8');
  assert.match(component, /CHALLENGE_MS=60_000/);
  assert.match(component, /\/api\/learning\/sixty-second-challenge/);
  assert.match(component, /durationSeconds/);
  assert.match(route, /type Kind = 'vocabulary'.*'sentence'/);
  assert.match(route, /getSentenceConstructionItems/);
  assert.match(route, /part_of_speech/);
  assert.match(route, /kana-word/);
  assert.match(route, /kind==='verb'/);
  assert.match(route, /Recognise this Hiragana/);
  assert.match(route, /Recognise this Katakana/);
  assert.match(route, /Choose the correctly ordered Japanese sentence/);
  assert.match(route, /sixty_second_challenge_attempts/);
});

testCase('challenge history is persisted and rendered in My Progress', async () => {
  const app = await readFile(new URL('../src/components/nihongo/learning-app.tsx', import.meta.url), 'utf8');
  const historyRoute = await readFile(new URL('../src/app/api/learning/sixty-second-challenge/history/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20261111130000_sixty_second_challenge_attempts.sql', import.meta.url), 'utf8');
  assert.match(app, /Your rapid-revision scorecards/);
  assert.match(app, /challengeHistory/);
  assert.match(app, /answer_review/);
  assert.match(historyRoute, /totalAttempts/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /user_id/);
});

testCase('challenge follows the NIHONGO Labs theme and is mounted beside Quick Revision', async () => {
  const component = await readFile(new URL('../src/components/nihongo/sixty-second-challenge.module.css', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/components/nihongo/learning-app.tsx', import.meta.url), 'utf8');
  assert.match(component, /#232c37/);
  assert.match(component, /#c7695e/);
  assert.match(app, /SixtySecondChallenge/);
});
