import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20261112120000_n5_n4_grammar_curriculum.sql'),'utf8');
const block=sql.match(/\$n5_json\$([\s\S]*?)\$n5_json\$::jsonb/);
test('N5 curriculum has 100 unique grammar sets with four drills each',()=>{
 assert.ok(block);
 const rows=JSON.parse(block[1]);
 assert.equal(rows.length,100);
 assert.equal(new Set(rows.map((r:{pattern:string})=>r.pattern)).size,100);
 for(const row of rows){
  assert.ok(row.title&&row.pattern&&row.meaning&&row.explanation&&row.formation);
  assert.ok(row.examples[0]?.japanese&&row.examples[0]?.romaji&&row.examples[0]?.meaning);
  assert.equal(row.practice_questions.length,4);
  for(const q of row.practice_questions){assert.equal(q.options.length,4);assert.ok(q.options.includes(q.answer));}
 }
});
test('grammar attempts are protected by row-level security',()=>{
 assert.match(sql,/user_grammar_practice_attempts enable row level security/i);
 assert.match(sql,/auth\.uid\(\)/i);
});
