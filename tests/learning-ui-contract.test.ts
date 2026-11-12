import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboard = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.tsx'), 'utf8');
const globalCss = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
const copyProtection = readFileSync(resolve(process.cwd(), 'src/components/copy-protection.tsx'), 'utf8');

test('copy restrictions are mounted globally and preserve editable fields', () => {
  assert.match(globalCss, /body, body \*\s*\{[\s\S]*?user-select:\s*none/);
  assert.match(globalCss, /input, textarea, select, \[contenteditable="true"\][^{]*\{[\s\S]*?user-select:\s*text/);
  assert.match(layout, /<CopyProtection \/>/);
  assert.match(copyProtection, /addEventListener\('copy'/);
  assert.match(copyProtection, /addEventListener\('cut'/);
  assert.match(copyProtection, /event\.preventDefault\(\)/);
  assert.match(copyProtection, /target\.closest\(editableSelector\)/);
});

test('study timer, clock display and Quick Revision are absent from learner surfaces', () => {
  const rootLayout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
  assert.doesNotMatch(dashboard, /studyTimerRef|activityTrackingNotice|QuickRevisionStats|Study ·|study_seconds|dailyGoal|totalStudySeconds/);
  assert.doesNotMatch(dashboard, /toLocaleTimeString|setInterval/);
  assert.doesNotMatch(rootLayout, /GlobalQuickRevision/);
  assert.equal(existsSync(resolve(process.cwd(), 'src/components/nihongo/global-quick-revision.tsx')), false);
  assert.equal(existsSync(resolve(process.cwd(), 'src/components/nihongo/quick-revision.tsx')), false);
  assert.equal(existsSync(resolve(process.cwd(), 'src/app/api/learning/quick-revision/route.ts')), false);
  assert.equal(existsSync(resolve(process.cwd(), 'src/app/api/learning/activity/route.ts')), false);
});

test('global search is backed by published learning content and opens the matching study area', () => {
  const searchApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/search/route.ts'), 'utf8');
  const features = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-features.tsx'), 'utf8');
  const kanjiStudio = readFileSync(resolve(process.cwd(), 'src/components/nihongo/kanji-studio.tsx'), 'utf8');
  assert.ok(dashboard.includes('api/learning/search'));
  assert.match(dashboard, /searchResults\.map/);
  assert.match(dashboard, /metaKey \|\| event\.ctrlKey/);
  assert.match(searchApi, /from\('vocabulary_entries'\)/);
  assert.match(searchApi, /from\('grammar_points'\)/);
  assert.match(searchApi, /from\('kanji_entries'\)/);
  assert.match(searchApi, /from\('lessons'\)/);
  assert.match(features, /filteredGrammarItems/);
  assert.match(kanjiStudio, /useState\(search\)/);
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


test('sentence reset confirmation is rendered in a body portal and uses a prominent destructive action', () => {
  const sentence = readFileSync(resolve(process.cwd(), 'src/components/nihongo/sentence-construction.tsx'), 'utf8');
  const learningStyles = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.module.css'), 'utf8');

  assert.ok(sentence.includes('createPortal('));
  assert.ok(sentence.includes('document.body'));
  assert.ok(sentence.includes('resetCancelRef'));
  assert.ok(sentence.includes('resetConfirmRef'));
  assert.ok(sentence.includes('disabled={!progressLoaded || saving || resetting}'));
  assert.ok(learningStyles.includes('.sentenceResetOverlay{position:fixed;inset:0;z-index:1600'));
  assert.ok(learningStyles.includes('.sentenceResetButton{display:inline-flex;align-items:center;gap:7px;border:1px solid #a84840;background:#a84840;color:#fff'));
});


test('the official Nihongo Labs emblem is shared across app surfaces, email and browser icons', () => {
  const brand = readFileSync(resolve(process.cwd(), 'src/components/nihongo/brand.tsx'), 'utf8');
  const admin = readFileSync(resolve(process.cwd(), 'src/components/nihongo/admin/admin-shell.tsx'), 'utf8');
  const auth = readFileSync(resolve(process.cwd(), 'src/components/nihongo/auth-form.tsx'), 'utf8');
  const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
  const email = readFileSync(resolve(process.cwd(), 'supabase/templates/confirmation.html'), 'utf8');

  assert.ok(brand.includes('src="/nihongo-labs-logo.png"'));
  assert.match(brand, /export function BrandMark/);
  assert.match(admin, /BrandMark size=\{37\}/);
  assert.match(auth, /BrandMark size=\{34\}/);
  assert.match(layout, /icon: \[\{ url: '\/nihongo-labs-logo\.png'/);
  assert.match(layout, /apple: \[\{ url: '\/nihongo-labs-logo\.png'/);
  assert.ok(email.includes('{{ .SiteURL }}/nihongo-labs-logo.png'));
  assert.ok(existsSync(resolve(process.cwd(), 'public/nihongo-labs-logo.png')));
});


test('grammar catalogue is fetched in ten-set pages and learned sets have their own server-side view', () => {
  const grammarApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/content/route.ts'), 'utf8');
  const grammarLoader = readFileSync(resolve(process.cwd(), 'src/lib/nihongo/data.ts'), 'utf8');
  const features = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-features.tsx'), 'utf8');

  assert.match(grammarApi, /kind === 'grammar'/);
  assert.match(grammarApi, /\.range\(offset, offset \+ limit\)/);
  assert.match(grammarApi, /select\(grammarFields, \{ count: 'exact' \}\)/);
  assert.match(grammarApi, /view === 'learned'/);
  assert.match(grammarApi, /requireUser\(\)/);
  assert.match(grammarApi, /from\('user_grammar_progress'\)/);
  assert.match(grammarApi, /hasMore, nextOffset: offset \+ items\.length, total:/);
  assert.match(grammarLoader, /const limit = options\.limit \?\? 10/);
  assert.match(features, /limit: 10/);
  assert.match(features, /role="tab"/);
  assert.match(features, /All sets/);
  assert.match(features, /Learned/);
  assert.match(features, /Load 10 more sets/);
  assert.match(features, /view,/);

  const learningStyles = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.module.css'), 'utf8');
  const n5ExamplesMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112130000_expand_n5_grammar_examples.sql'), 'utf8');
  assert.match(grammarApi, /learner\.supabase\s+\.from\('user_grammar_progress'\)/);
  assert.ok(grammarApi.includes("query = query.not('id', 'in', `(${learnedIds.join(',')})`)"));
  assert.ok(grammarApi.includes("'Cache-Control': learner.ok ? 'private, no-store'"));
  assert.match(features, /view === 'all' && !isLearned/);
  assert.match(features, /aria-busy=\{loadingMore\}/);
  assert.match(features, /aria-label=\{view === 'learned'/);
  assert.ok(learningStyles.includes('height:clamp(280px,68vh,720px);min-height:0;overflow-y:auto;overscroll-behavior-y:contain;'));
  assert.ok(learningStyles.includes('@media(max-width:780px){.lessonList{height:clamp(260px,55vh,520px)}}'));
  assert.ok(n5ExamplesMigration.includes('grammar.jlpt_level::text = item.jlpt_level'));
});
