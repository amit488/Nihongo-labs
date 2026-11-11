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
  assert.ok(dashboard.includes('api/learning/search'));
  assert.match(dashboard, /searchResults\.map/);
  assert.match(dashboard, /metaKey \|\| event\.ctrlKey/);
  assert.match(searchApi, /from\('vocabulary_entries'\)/);
  assert.match(searchApi, /from\('grammar_points'\)/);
  assert.match(searchApi, /from\('kanji_entries'\)/);
  assert.match(searchApi, /from\('lessons'\)/);
  assert.match(features, /filteredGrammarItems/);
  assert.match(features, /useState\(search\)/);
});

test('JLPT progress switches to the selected level and uses its own tracked data', () => {
  const levelApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/level-progress/route.ts'), 'utf8');
  const settingsApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/settings/route.ts'), 'utf8');
  const validation = readFileSync(resolve(process.cwd(), 'src/lib/nihongo/server/validation.ts'), 'utf8');
  const optimizationSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261110170000_medium_priority_optimizations.sql'), 'utf8');
  assert.match(dashboard, /\$\{level\} learning progress/);
  assert.doesNotMatch(dashboard, /label="N5 readiness"/);
  assert.match(dashboard, /preferredJlptLevel: level/);
  assert.match(levelApi, /rpc\('get_level_progress', \{ _level: level \}\)/);
  assert.match(optimizationSql, /create or replace function public\.get_level_progress\(_level text\)[\s\S]*?vocabulary_entries[\s\S]*?user_vocabulary_progress[\s\S]*?kanji_review_state[\s\S]*?user_grammar_progress[\s\S]*?lesson_progress/i);
  assert.match(optimizationSql, /'readiness',[\s\S]*?categories\.completed::numeric[\s\S]*?categories\.total/i);
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


test('sentence construction reset confirms the full scope and clears only the signed-in learner history', () => {
  const sentencePath = resolve(process.cwd(), 'src/components/nihongo/sentence-construction.tsx');
  const sentence = readFileSync(sentencePath, 'utf8');
  const sentenceApiPath = resolve(process.cwd(), 'src/app/api/learning/sentence-construction/route.ts');
  const sentenceApi = readFileSync(sentenceApiPath, 'utf8');
  const learningStyles = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.module.css'), 'utf8');

  assert.match(sentence, /Reset all sentence progress\?/);
  assert.match(sentence, /for both N5 and N4/);
  assert.match(sentence, /My Progress and Learning Intelligence/);
  assert.match(sentence, /method: 'DELETE'/);
  assert.match(sentenceApi, /export async function DELETE\(request: NextRequest\)/);
  assert.match(sentenceApi, /createAdminSupabase\(\)[\s\S]*?from\('sentence_construction_attempts'\)[\s\S]*?\.delete\([\s\S]*?\.eq\('user_id', context\.user\.id\)/);
  assert.match(learningStyles, /\.sentenceResetOverlay/);
  assert.match(learningStyles, /\.sentenceResetDialog/);
});


test('Quick Revision can be launched manually and visible-time scheduling works without a focus-state dependency', () => {
  const quickRevision = readFileSync(resolve(process.cwd(), 'src/components/nihongo/quick-revision.tsx'), 'utf8');
  const quickStyles = readFileSync(resolve(process.cwd(), 'src/components/nihongo/quick-revision.module.css'), 'utf8');

  assert.match(quickRevision, /Start Quick Revision now/);
  assert.match(quickRevision, /loadQuestionRef\\.current/);
  assert.match(quickRevision, /document\\.visibilityState === 'visible'/);
  assert.doesNotMatch(quickRevision, /document\\.hasFocus\\(\\)/);
  assert.match(quickStyles, /\\.quickRevisionDock/);
  assert.match(quickStyles, /\\.launcher/);
});

test('sentence reset confirmation is rendered in a body portal and uses a prominent destructive action', () => {
  const sentence = readFileSync(resolve(process.cwd(), 'src/components/nihongo/sentence-construction.tsx'), 'utf8');
  const learningStyles = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.module.css'), 'utf8');

  assert.match(sentence, /createPortal\\([\\s\\S]*?document\\.body/);
  assert.match(sentence, /resetCancelRef/);
  assert.match(sentence, /resetConfirmRef/);
  assert.match(learningStyles, /\\.sentenceResetOverlay\\{position:fixed;inset:0;z-index:1600/);
  assert.match(learningStyles, /\\.sentenceResetButton\\{[^}]*background:#a84840[^}]*color:#fff/);
});
