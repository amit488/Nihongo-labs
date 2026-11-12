import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const n5Sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112120000_n5_n4_grammar_curriculum.sql'), 'utf8');
const n4Sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112121000_n4_grammar_curriculum.sql'), 'utf8');
const n5ExamplesSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112130000_expand_n5_grammar_examples.sql'), 'utf8');
const n4ExamplesSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112130100_expand_n4_grammar_examples.sql'), 'utf8');

function readSeed(sql: string, tag: string) {
  const opening = `$${tag}$`;
  const closing = `$${tag}$::jsonb`;
  const start = sql.indexOf(opening);
  assert.notEqual(start, -1, `Missing ${tag} seed block`);
  const jsonStart = start + opening.length;
  const end = sql.indexOf(closing, jsonStart);
  assert.notEqual(end, -1, `Missing ${tag} JSON terminator`);
  return JSON.parse(sql.slice(jsonStart, end)) as Array<{
    jlpt_level: string;
    title: string;
    pattern: string;
    meaning: string;
    explanation: string;
    formation: string;
    examples: Array<{ japanese: string; romaji: string; meaning: string }>;
    common_mistakes: string[];
    practice_questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      answer: string;
      explanation: string;
    }>;
  }>;
}

 
function readExpansion(sql: string, tag: string) {
  const opening = `${tag}import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const n5Sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112120000_n5_n4_grammar_curriculum.sql'), 'utf8');
const n4Sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112121000_n4_grammar_curriculum.sql'), 'utf8');
const n5ExamplesSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112130000_expand_n5_grammar_examples.sql'), 'utf8');
const n4ExamplesSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112130100_expand_n4_grammar_examples.sql'), 'utf8');

function readSeed(sql: string, tag: string) {
  const opening = `$${tag}$`;
  const closing = `$${tag}$::jsonb`;
  const start = sql.indexOf(opening);
  assert.notEqual(start, -1, `Missing ${tag} seed block`);
  const jsonStart = start + opening.length;
  const end = sql.indexOf(closing, jsonStart);
  assert.notEqual(end, -1, `Missing ${tag} JSON terminator`);
  return JSON.parse(sql.slice(jsonStart, end)) as Array<{
    jlpt_level: string;
    title: string;
    pattern: string;
    meaning: string;
    explanation: string;
    formation: string;
    examples: Array<{ japanese: string; romaji: string; meaning: string }>;
    common_mistakes: string[];
    practice_questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      answer: string;
      explanation: string;
    }>;
  }>;
}

;
  const closing = `${tag}$::jsonb`;
  const start = sql.indexOf(opening);
  assert.notEqual(start, -1, `Missing ${tag} expansion block`);
  const jsonStart = start + opening.length;
  const end = sql.indexOf(closing, jsonStart);
  assert.notEqual(end, -1, `Missing ${tag} JSON terminator`);
  return JSON.parse(sql.slice(jsonStart, end)) as Array<{
    jlpt_level: string;
    sort_order: number;
    additional_examples: Array<{ japanese: string; romaji: string; meaning: string }>;
  }>;
}

function validateFiveExamples(
  seedRows: ReturnType<typeof readSeed>,
  additions: ReturnType<typeof readExpansion>,
  level: string,
) {
  assert.equal(additions.length, 100, `${level} must add examples for all 100 grammar sets`);
  assert.equal(new Set(additions.map((row) => row.sort_order)).size, 100, `${level} expansion sort orders must be unique`);
  const additionsByOrder = new Map(additions.map((row) => [row.sort_order, row]));
  for (const row of seedRows) {
    const extra = additionsByOrder.get((row as typeof row & { sort_order: number }).sort_order);
    assert.ok(extra, `${level} ${row.pattern} must have additional examples`);
    assert.equal(extra.jlpt_level, level);
    assert.equal(extra.additional_examples.length, 4, `${level} ${row.pattern} must add four examples`);
    const examples = [...row.examples, ...extra.additional_examples];
    assert.equal(examples.length, 5, `${level} ${row.pattern} must have exactly five examples`);
    assert.equal(new Set(examples.map((example) => example.japanese)).size, 5, `${level} ${row.pattern} examples must be distinct`);
    for (const example of extra.additional_examples) {
      assert.ok(example.japanese && example.romaji && example.meaning, `${level} ${row.pattern} examples need Japanese, romaji and meaning`);
    }
  }
}

function validateLevel(rows: ReturnType<typeof readSeed>, level: string) {
  assert.equal(rows.length, 100, `${level} must have exactly 100 grammar sets`);
  assert.equal(new Set(rows.map((row) => row.pattern)).size, 100, `${level} patterns must be unique`);
  for (const row of rows) {
    assert.ok(row.title && row.pattern && row.meaning && row.explanation && row.formation);
    assert.ok(row.common_mistakes.length > 0);
    assert.ok(row.examples.length > 0);
    for (const example of row.examples) {
      assert.ok(example.japanese && example.romaji && example.meaning);
    }
    assert.equal(row.practice_questions.length, 4, `${level} ${row.pattern} must have four practice questions`);
    for (const question of row.practice_questions) {
      assert.ok(question.id && question.prompt && question.explanation);
      assert.equal(question.options.length, 4);
      assert.ok(question.options.includes(question.answer));
    }
  }
}

test('N5 and N4 each contain 100 complete grammar sets and four practice questions per set', () => {
  validateLevel(readSeed(n5Sql, 'n5_json'), 'N5');
  validateLevel(readSeed(n4Sql, 'n4_json'), 'N4');
});

test('grammar practice attempts are protected by learner-scoped row-level security', () => {
  assert.ok(n5Sql.includes('create table if not exists public.user_grammar_practice_attempts'));
  assert.ok(n5Sql.includes('enable row level security'));
  assert.ok(n5Sql.includes('auth.uid()'));
  assert.ok(n5Sql.includes('user_grammar_practice_attempts_insert_own'));
});


test('every N5 and N4 grammar set has five distinct Japanese examples with romaji and meanings', () => {
  validateFiveExamples(
    readSeed(n5Sql, 'n5_json'),
    readExpansion(n5ExamplesSql, 'n5_examples'),
    'N5',
  );
  validateFiveExamples(
    readSeed(n4Sql, 'n4_json'),
    readExpansion(n4ExamplesSql, 'n4_examples'),
    'N4',
  );
});
