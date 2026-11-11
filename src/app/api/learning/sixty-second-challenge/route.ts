import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSentenceConstructionItems } from '@/lib/nihongo/sentence-construction-bank';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';

type Kind = 'vocabulary' | 'verb' | 'kana-word' | 'kanji' | 'grammar' | 'hiragana' | 'katakana' | 'sentence';
type Question = { id: string; kind: Kind; level: string; prompt: string; question: string; options: string[]; answer: string; explanation: string };
const kanaRows = [
  ['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],['や','ya'],['ゆ','yu'],['よ','yo'],['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'],['わ','wa'],['を','wo'],['ん','n'],
] as const;
const shuffle = <T,>(items: T[]) => { const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
const pick = <T,>(items:T[],count:number) => shuffle(items).slice(0,count);
const makeOptions = (answer:string,pool:string[]) => shuffle([answer,...pick([...new Set(pool.filter(v=>v && v!==answer))],3)]);
const finishSchema = z.object({ answers: z.array(z.object({ questionId:z.string().min(1).max(100), selectedOption:z.string().min(1).max(500) }).strict()).max(200), durationSeconds:z.number().int().min(0).max(60) }).strict();

export async function GET() {
  await connection();
  try {
    const context=await requireUser();
    if(!context.ok) throw new HttpError(401,context.error);
    const db=context.supabase;
    const [vocab,kanji,grammar]=await Promise.all([
      db.from('user_vocabulary_progress').select('vocabulary_entries!inner(id,word,kana,meaning,part_of_speech,jlpt_level,publication_status)').eq('user_id',context.user.id).eq('vocabulary_entries.publication_status','published').limit(1000),
      db.from('kanji_review_state').select('kanji_entries!inner(id,character,meaning,jlpt_level,publication_status)').eq('user_id',context.user.id).eq('status','known').eq('kanji_entries.publication_status','published').limit(1000),
      db.from('user_grammar_progress').select('grammar_points!inner(id,title,pattern,explanation,jlpt_level,publication_status)').eq('user_id',context.user.id).eq('grammar_points.publication_status','published').limit(1000),
    ]);
    const err=vocab.error||kanji.error||grammar.error;
    if(err) throw new HttpError(500,'Could not load your learned challenge content.',err.message);
    const rel=<T,>(value:T|T[]|null):T|null=>Array.isArray(value)?value[0]??null:value;
    const questions:Question[]=[];
    const v=(vocab.data??[]).flatMap(row=>{const x=rel(row.vocabulary_entries as never) as {id:string;word:string;kana:string;meaning:string;part_of_speech:string|null;jlpt_level:string;publication_status:string}|null;return x?[x]:[];});
    const k=(kanji.data??[]).flatMap(row=>{const x=rel(row.kanji_entries as never) as {id:string;character:string;meaning:string;jlpt_level:string;publication_status:string}|null;return x?[x]:[];});
    const g=(grammar.data??[]).flatMap(row=>{const x=rel(row.grammar_points as never) as {id:string;title:string;pattern:string;explanation:string;jlpt_level:string;publication_status:string}|null;return x?[x]:[];});
    for(const x of pick(v,30)) {
      const isVerb=x.part_of_speech?.toLowerCase()==='verb';
      const kind=isVerb?'verb':'vocabulary';
      questions.push({id:kind+':'+x.id,kind,level:x.jlpt_level,prompt:x.word+(x.kana?'（'+x.kana+'）':''),question:isVerb?'What does this Japanese verb mean?':'Choose the meaning of this word.',options:makeOptions(x.meaning,v.map(y=>y.meaning)),answer:x.meaning,explanation:x.word+' means '+x.meaning+'.'});
      if(x.kana) questions.push({id:'kana-word:'+x.id,kind:'kana-word',level:x.jlpt_level,prompt:x.word,question:'Choose the kana reading of this word.',options:makeOptions(x.kana,v.map(y=>y.kana)),answer:x.kana,explanation:x.word+' is read '+x.kana+'.'});
    }
    for(const x of pick(k,20)) questions.push({id:'kanji:'+x.id,kind:'kanji',level:x.jlpt_level,prompt:x.character,question:'Choose the meaning of this kanji.',options:makeOptions(x.meaning,k.map(y=>y.meaning)),answer:x.meaning,explanation:x.character+' means '+x.meaning+'.'});
    for(const x of pick(g,20)) questions.push({id:'grammar:'+x.id,kind:'grammar',level:x.jlpt_level,prompt:x.explanation,question:'Which grammar pattern matches this explanation?',options:makeOptions(x.pattern,g.map(y=>y.pattern)),answer:x.pattern,explanation:x.pattern+' — '+x.explanation});
    const hiragana=pick([...kanaRows],24);
    const katakana=pick([...kanaRows],24);
    for(const [character,reading] of hiragana) questions.push({id:'hiragana:'+character,kind:'hiragana',level:'N5',prompt:character,question:'Recognise this Hiragana character.',options:makeOptions(reading,kanaRows.map(x=>x[1])),answer:reading,explanation:character+' is read '+reading+'.'});
    for(const [character,reading] of katakana) { const katakanaChar=String.fromCharCode(character.charCodeAt(0)+0x60); questions.push({id:'katakana:'+katakanaChar,kind:'katakana',level:'N5',prompt:katakanaChar,question:'Recognise this Katakana character.',options:makeOptions(reading,kanaRows.map(x=>x[1])),answer:reading,explanation:katakanaChar+' is read '+reading+'.'}); }
    for(const item of pick(getSentenceConstructionItems('N5').concat(getSentenceConstructionItems('N4')),30)) {
      const correct=item.tokens.join(' ');
      const alternatives=pick(getSentenceConstructionItems(item.level).filter(x=>x.id!==item.id),3).map(x=>x.tokens.join(' '));
      questions.push({id:'sentence:'+item.id,kind:'sentence',level:item.level,prompt:item.meaning,question:'Choose the correctly ordered Japanese sentence for this meaning.',options:shuffle([correct,...alternatives]),answer:correct,explanation:item.sentence+' — '+item.meaning+' '+item.tip});
    }
    return NextResponse.json({questions:shuffle(questions).map(q=>({id:q.id,kind:q.kind,level:q.level,prompt:q.prompt,question:q.question,options:q.options}))}, {headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return jsonError(error); }
}

export async function POST(request:NextRequest) {
  try {
    assertSameOrigin(request);
    const context=await requireUser();
    if(!context.ok) throw new HttpError(401,context.error);
    const input=await readJson(request,finishSchema);
    const db=context.supabase;
    const ids=[...new Set(input.answers.map(a=>a.questionId))];
    if(ids.length!==input.answers.length) throw new HttpError(400,'Duplicate challenge questions are not allowed.');
    const categories:Record<Kind,{answered:number;correct:number}>={vocabulary:{answered:0,correct:0},verb:{answered:0,correct:0},'kana-word':{answered:0,correct:0},kanji:{answered:0,correct:0},grammar:{answered:0,correct:0},hiragana:{answered:0,correct:0},katakana:{answered:0,correct:0},sentence:{answered:0,correct:0}};
    const review=[];
    for(const answer of input.answers) {
      const [kind,id]=answer.questionId.split(':') as [Kind,string];
      if(!kind||!id||!['vocabulary','verb','kana-word','kanji','grammar','hiragana','katakana','sentence'].includes(kind)) continue;
      let correctAnswer='',prompt='',question='',level='N5',explanation='';
      if(kind==='sentence') {
        const item=getSentenceConstructionItems('N5').concat(getSentenceConstructionItems('N4')).find(x=>x.id===id);
        if(!item) continue;
        correctAnswer=item.tokens.join(' '); prompt=item.meaning; question='Choose the correctly ordered Japanese sentence.'; level=item.level; explanation=item.tip;
      } else if(kind==='hiragana'||kind==='katakana') {
        const char=kind==='katakana'?String.fromCharCode(id.charCodeAt(0)-0x60):id;
        const row=kanaRows.find(x=>x[0]===char);
        if(!row) continue;
        correctAnswer=row[1]; prompt=id; question='Recognise this '+(kind==='hiragana'?'Hiragana':'Katakana')+' character.'; explanation=id+' is read '+correctAnswer+'.';
      } else if(kind==='vocabulary'||kind==='verb'||kind==='kana-word') {
        const {data}=await db.from('user_vocabulary_progress').select('vocabulary_entries!inner(word,kana,meaning,jlpt_level,publication_status,part_of_speech)').eq('user_id',context.user.id).eq('vocabulary_id',id).eq('vocabulary_entries.publication_status','published').maybeSingle();
        const item=Array.isArray(data?.vocabulary_entries)?data?.vocabulary_entries[0]:data?.vocabulary_entries;
        if(!item) continue;
        const row=item as {word:string;kana:string;meaning:string;jlpt_level:string};
        const verb=(row as typeof row & {part_of_speech?:string}).part_of_speech?.toLowerCase()==='verb';
        if(kind==='verb'&&!verb) continue;
        correctAnswer=kind==='kana-word'?row.kana:row.meaning; prompt=row.word+'（'+row.kana+'）'; question=kind==='kana-word'?'Choose the kana reading of this word.':kind==='verb'?'What does this Japanese verb mean?':'Choose the meaning of this vocabulary item.'; level=row.jlpt_level; explanation=kind==='kana-word'?row.word+' is read '+row.kana+'.':prompt+' means '+row.meaning+'.';
      } else if(kind==='kanji') {
        const {data}=await db.from('kanji_review_state').select('kanji_entries!inner(character,meaning,jlpt_level,publication_status)').eq('user_id',context.user.id).eq('kanji_id',id).eq('status','known').eq('kanji_entries.publication_status','published').maybeSingle();
        const item=Array.isArray(data?.kanji_entries)?data?.kanji_entries[0]:data?.kanji_entries;
        if(!item) continue;
        const row=item as {character:string;meaning:string;jlpt_level:string};
        correctAnswer=row.meaning; prompt=row.character; question='Choose the meaning of this kanji.'; level=row.jlpt_level; explanation=row.character+' means '+correctAnswer+'.';
      } else {
        const {data}=await db.from('user_grammar_progress').select('grammar_points!inner(title,pattern,explanation,jlpt_level,publication_status)').eq('user_id',context.user.id).eq('grammar_id',id).eq('grammar_points.publication_status','published').maybeSingle();
        const item=Array.isArray(data?.grammar_points)?data?.grammar_points[0]:data?.grammar_points;
        if(!item) continue;
        const row=item as {title:string;pattern:string;explanation:string;jlpt_level:string};
        correctAnswer=row.pattern; prompt=row.explanation; question='Which grammar pattern matches this explanation?'; level=row.jlpt_level; explanation=row.pattern+' — '+row.explanation;
      }
      const correct=answer.selectedOption===correctAnswer;
      const bucket=categories[kind]; bucket.answered++; if(correct) bucket.correct++;
      review.push({kind,level,question,prompt,selected:answer.selectedOption,correctAnswer,correct,explanation});
    }
    const total=review.length, score=total?Math.round(review.filter(x=>x.correct).length/total*100):0;
    const {data:attempt,error}=await db.from('sixty_second_challenge_attempts').insert({user_id:context.user.id,score_percentage:score,total_answered:total,total_correct:review.filter(x=>x.correct).length,duration_seconds:input.durationSeconds,category_scores:categories,answer_review:review}).select('id,created_at').single();
    if(error) throw new HttpError(500,'Could not save your challenge scorecard. Apply the 60-second challenge migration first.',error.message);
    return NextResponse.json({attempt:{...attempt,scorePercentage:score,totalAnswered:total,totalCorrect:review.filter(x=>x.correct).length,categories,review}}, {headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return jsonError(error); }
}
