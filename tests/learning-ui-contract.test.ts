import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboard = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.tsx'), 'utf8');
const globalCss = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
const copyProtection = readFileSync(resolve(process.cwd(), 'src/components/copy-protection.tsx'), 'utf8');

test('daily-goal ring and progress use measured study seconds', () => {
  assert.match(dashboard, /rawStudiedSeconds/);
  assert.match(dashboard, /studiedSeconds\s*\/\s*\(goal\s*\*\s*60\)/);
  assert.match(dashboard, /conic-gradient\(#c7695e 0 \$\{goalPercent\}%/);
  assert.match(dashboard, /aria-label=\{\`\$\{goalPercent\}% of the daily study goal completed\`\}/);
});

test('copy restrictions are mounted globally and preserve editable fields', () => {
  assert.match(globalCss, /body, body \*\s*\{[\s\S]*?user-select:\s*none/);
  assert.match(globalCss, /input, textarea, select, \[contenteditable="true"\][^{]*\{[\s\S]*?user-select:\s*text/);
  assert.match(layout, /<CopyProtection \/>/);
  assert.match(copyProtection, /addEventListener\('copy'/);
  assert.match(copyProtection, /addEventListener\('cut'/);
  assert.match(copyProtection, /event\.preventDefault\(\)/);
  assert.match(copyProtection, /target\.closest\(editableSelector\)/);
});

test('heartbeat retries retain an immutable eight-day batch and preserve newer queued time on expiry', () => {
  const activityApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/activity/route.ts'), 'utf8');
  assert.match(dashboard, /requestCreatedAt/);
  assert.match(dashboard, /requestSeconds/);
  assert.match(dashboard, /body: JSON\.stringify\(\{ seconds: requestedSeconds, requestId, requestCreatedAt \}\)/);
  assert.match(dashboard, /HEARTBEAT_REQUEST_EXPIRED/);
  assert.match(dashboard, /expiredBatchMilliseconds/);
  assert.match(dashboard, /milliseconds: current\.milliseconds - expiredBatchMilliseconds/);
  assert.match(activityApi, /requestCreatedAt: z\.string\(\)\.datetime/);
  assert.match(activityApi, /_request_created_at: requestCreatedAt/);
  assert.match(activityApi, /HEARTBEAT_REQUEST_EXPIRED/);
});


test('global search is backed by published learning content and opens the matching study area', () => {
  const searchApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/search/route.ts'), 'utf8');
  const features = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-features.tsx'), 'utf8');
  assert.match(dashboard, /api\\/learning\\/search/);
  assert.match(dashboard, /searchResults\.map/);
  assert.match(dashboard, /metaKey \|\| event\.ctrlKey/);
  assert.match(searchApi, /from\('vocabulary_entries'\)/);
  assert.match(searchApi, /from\('grammar_points'\)/);
  assert.match(searchApi, /from\('kanji_entries'\)/);
  assert.match(searchApi, /from\('lessons'\)/);
  assert.match(features, /filteredGrammarItems/);
  assert.match(features, /setQuery\(search\)/);
});

test('JLPT progress switches to the selected level and uses its own tracked data', () => {
  const levelApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/level-progress/route.ts'), 'utf8');
  const settingsApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/settings/route.ts'), 'utf8');
  const validation = readFileSync(resolve(process.cwd(), 'src/lib/nihongo/server/validation.ts'), 'utf8');
  assert.match(dashboard, /\$\{level\} learning progress/);
  assert.doesNotMatch(dashboard, /label="N5 readiness"/);
  assert.match(dashboard, /preferredJlptLevel: level/);
  assert.match(levelApi, /from\('user_grammar_progress'\)/);
  assert.match(levelApi, /from\('user_vocabulary_progress'\)/);
  assert.match(levelApi, /from\('kanji_review_state'\)/);
  assert.match(levelApi, /from\('lesson_progress'\)/);
  assert.match(levelApi, /const readiness = categories\.length/);
  assert.match(settingsApi, /preferencePatch\.preferred_jlpt_level/);
  assert.match(validation, /preferredJlptLevel: z\.enum\(\['N5', 'N4'\]\)/);
});

test('the same single-line Nihongo Labs logo is shared across key site surfaces', () => {
  const brand = readFileSync(resolve(process.cwd(), 'src/components/nihongo/brand.tsx'), 'utf8');
  const auth = readFileSync(resolve(process.cwd(), 'src/components/nihongo/auth-form.tsx'), 'utf8');
  const landing = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8');
  const pricing = readFileSync(resolve(process.cwd(), 'src/app/pricing/page.tsx'), 'utf8');
  const workspace = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.tsx'), 'utf8');
  assert.match(brand, /Nihongo Labs/);
  assert.match(brand, /styles\.name/);
  assert.match(auth, /<Brand href="\/learn"/);
  assert.match(landing, /<Brand href="\/"/);
  assert.match(pricing, /<Brand href="\/"/);
  assert.match(workspace, /<Brand href="\/learn" tone="dark"/);
});

test('sentence builder keeps progress inside the exercise instead of stacking duplicate panels', () => {
  const sentence = readFileSync(resolve(process.cwd(), 'src/components/nihongo/sentence-construction.tsx'), 'utf8');
  assert.match(sentence, /sentenceCardMeta/);
  assert.match(sentence, /sentenceSessionNote/);
  assert.doesNotMatch(sentence, /sentenceHero/);
  assert.doesNotMatch(sentence, /sentenceBottomRow/);
});
