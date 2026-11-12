import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261112120000_expand_grammar_curriculum_and_progress.sql'),
  'utf8',
);
const grammarUi = readFileSync(
  resolve(process.cwd(), 'src/components/nihongo/learning-features.tsx'),
  'utf8',
);
const grammarData = readFileSync(resolve(process.cwd(), 'src/lib/nihongo/data.ts'), 'utf8');
const progressRoute = readFileSync(
  resolve(process.cwd(), 'src/app/api/learning/grammar-progress/route.ts'),
  'utf8',
);
const contentRoute = readFileSync(
  resolve(process.cwd(), 'src/app/api/learning/content/route.ts'),
  'utf8',
);

function readCurriculum() {
  const match = migration.match(/jsonb_array_elements\(\$curriculum\$([\s\S]*?)\$curriculum\$::jsonb\)/);
  assert.ok(match, 'migration must contain the embedded, reviewable grammar curriculum');
  return JSON.parse(match[1]) as Array<{
    jlpt_level: string;
    sort_order: number;
    title: string;
    pattern: string;
    explanation: string;
    formation: string;
    category: string;
    difficulty: string;
    examples: Array<{ japanese: string; romaji: string; meaning: string }>;
    common_mistakes: string[];
  }>;
}

test('grammar migration publishes an extensive ordered N5-to-N4 curriculum', () => {
  const rows = readCurriculum();
  const n5 = rows.filter((row) => row.jlpt_level === 'N5');
  const n4 = rows.filter((row) => row.jlpt_level === 'N4');
  assert.equal(rows.length, 104);
  assert.equal(n5.length, 40);
  assert.equal(n4.length, 64);
  for (const levelRows of [n5, n4]) {
    assert.deepEqual(
      levelRows.map((row) => row.sort_order),
      [...levelRows].map((row) => row.sort_order).sort((a, b) => a - b),
    );
    assert.equal(new Set(levelRows.map((row) => row.pattern)).size, levelRows.length);
    const difficultyRank = { Beginner: 0, Core: 1, Challenge: 2 };
    for (let index = 1; index < levelRows.length; index += 1) {
      assert.ok(
        difficultyRank[levelRows[index - 1].difficulty as keyof typeof difficultyRank]
          <= difficultyRank[levelRows[index].difficulty as keyof typeof difficultyRank],
        'grammar lessons must progress from beginner to core to challenge',
      );
    }
  }
  for (const row of rows) {
    assert.ok(row.title.trim().length > 0);
    assert.ok(row.explanation.trim().length > 60);
    assert.ok(row.formation.trim().length > 0);
    assert.ok(row.category.trim().length > 0);
    assert.ok(['Beginner', 'Core', 'Challenge'].includes(row.difficulty));
    assert.ok(row.examples.length >= 2, `${row.title} should have multiple examples`);
    assert.ok(row.common_mistakes.length >= 2, `${row.title} should teach common pitfalls`);
    for (const example of row.examples) {
      assert.ok(example.japanese.trim().length > 0);
      assert.ok(example.romaji.trim().length > 0);
      assert.ok(example.meaning.trim().length > 0);
    }
  }
});

test('grammar migration creates owner-scoped progress with published-content checks', () => {
  assert.match(migration, /create table if not exists public\.user_grammar_progress/);
  assert.match(migration, /primary key \(user_id, grammar_id\)/);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /references public\.grammar_points\(id\) on delete cascade/);
  assert.match(migration, /alter table public\.user_grammar_progress enable row level security/);
  assert.match(migration, /grammar_progress_insert_published[\s\S]*?publication_status = 'published'/);
  assert.match(migration, /on conflict \(jlpt_level, pattern\) do update/);
});

test('grammar progress writes are idempotent and tied to the authenticated learner', () => {
  assert.match(progressRoute, /z\.object\(\{ grammarId: z\.string\(\)\.uuid\(\) \}\)\.strict\(\)/);
  assert.match(progressRoute, /\.upsert\([\s\S]*?onConflict: 'user_id,grammar_id'/);
  assert.match(progressRoute, /\.eq\('user_id', context\.user\.id\)/);
  assert.match(progressRoute, /\.eq\('grammar_id', input\.grammarId\)/);
});

test('grammar actions use database IDs and keep pending and feedback state per grammar point', () => {
  assert.match(grammarUi, /GRAMMAR_UUID_PATTERN/);
  assert.match(grammarUi, /\[savingLearnedIds, setSavingLearnedIds\] = useState<Set<string>>/);
  assert.match(grammarUi, /\[savingBookmarkIds, setSavingBookmarkIds\] = useState<Set<string>>/);
  assert.match(grammarUi, /\[notices, setNotices\] = useState<Record<string, string>>/);
  assert.match(grammarUi, /notices\[item\.id\]/);
  assert.match(grammarUi, /commonMistakes\?\.length/);
  assert.match(grammarData, /commonMistakes: Array\.isArray\(row\.common_mistakes\)/);
  assert.match(grammarData, /return \(items \?\? \[\]\)\.map/);
  assert.match(grammarData, /category: row\.category \|\| 'Grammar'/);
  assert.match(contentRoute, /sort_order', \{ ascending: true \}\)/);
  assert.match(contentRoute, /difficulty,sort_order/);
});
