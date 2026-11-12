import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const n5sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20261112120000_n5_n4_grammar_curriculum.sql'),'utf8');
const n4sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20261112121000_n4_grammar_curriculum.sql'),'utf8');
function validate(sql:string,tag:string,level:string){
 const block=sql.match(new RegExp('\\\\$'+tag+'\\\\$([\\\\s\\\\S]*?)\\\\$'+tag+'\\\\$::jsonb'));
 assert.ok(block,level+' seed JSON is present');
 const rows=JSON.parse(block[1]);
 assert.equal(rows.length,100,level+' has exactly 100 sets');
 assert.equal(new Set(rows.map((r:{pattern:string})=>r.pattern)).size,100,level+' patterns are unique');
 for(const row of rows){
  assert.ok(row.title&&row.pattern&&row.meaning&&row.explanation&&row.formation);
  const ex=row.examples[0];assert.ok(ex?.japanese&&ex?.romaji&&ex?.meaning);
  assert.equal(row.practice_questions.length,4);
  for(const q of row.practice_questions){assert.equal(q.options.length,4);assert.ok(q.options.includes(q.answer));}
 }
}
test('N5 and N4 each contain 100 grammar sets with four drills per set',()=>{
 validate(n5sql,'n5_json','N5');validate(n4sql,'n4_json','N4');
});
test('grammar attempts are protected by learner-scoped row-level security',()=>{
 assert.match(n5sql,/user_grammar_practice_attempts enable row level security/i);
 assert.match(n5sql,/auth\\.uid\\(\\)/i);
});
