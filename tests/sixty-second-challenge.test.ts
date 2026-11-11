import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import testCase from 'node:test';

testCase('60-second challenge uses learned quick-revision content and a fixed one-minute timer', async () => {
  const component = await readFile(new URL('../src/components/nihongo/sixty-second-challenge.tsx', import.meta.url), 'utf8');
  assert.match(component, /CHALLENGE_MS = 60_000/);
  assert.match(component, /\/api\/learning\/quick-revision\?view=question/);
  assert.match(component, /contentType: question\.contentType/);
  assert.match(component, /nihongo:quick-revision-updated/);
  assert.match(component, /AUTO_MIN_MS/);
  assert.match(component, /document\.visibilityState !== 'visible'/);
  assert.match(component, /vocabulary' \| 'kanji' \| 'grammar'/);
});

testCase('60-second challenge follows the existing workspace theme and is mounted beside Quick Revision', async () => {
  const component = await readFile(new URL('../src/components/nihongo/sixty-second-challenge.module.css', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/components/nihongo/learning-app.tsx', import.meta.url), 'utf8');
  assert.match(component, /#232c37/);
  assert.match(component, /#c7695e/);
  assert.match(app, /SixtySecondChallenge/);
});
