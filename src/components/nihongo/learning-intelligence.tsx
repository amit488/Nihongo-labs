'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './learning-intelligence.module.css';

type GrammarTopic = {
  tag: string; label: string; attempts: number; misses: number;
  accuracy: number; weak: boolean; recommendation: string;
};
type GrammarStats = { totalAttempts: number; accuracy: number; weakTopicCount: number; topics: GrammarTopic[] };
type VocabularyItem = {
  id: string; word: string; kana: string; romaji: string | null; meaning: string;
  example: string | null; exampleReading: string | null; exampleMeaning: string | null;
  dueAt: string; repetitions: number; lastRating: number | null; due: boolean; atRisk: boolean; mastered: boolean;
};
type VocabularyStats = { learnedCount: number; trackedCount: number; dueCount: number; atRiskCount: number; masteredCount: number; items: VocabularyItem[] };

export default function LearningIntelligence({ signedIn }: { signedIn: boolean }) {
  const [level, setLevel] = useState<'N5'|'N4'>('N5');
  const [grammar, setGrammar] = useState<GrammarStats | null>(null);
  const [vocabulary, setVocabulary] = useState<VocabularyStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    Promise.all([
      fetch('/api/learning/grammar-intelligence', { credentials:'same-origin', cache:'no-store' }).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error||'Grammar insights unavailable');return b as GrammarStats;}),
      fetch('/api/learning/vocabulary-intelligence?level='+level, { credentials:'same-origin', cache:'no-store' }).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error||'Vocabulary insights unavailable');return b as VocabularyStats;}),
    ]).then(([g,v])=>{if(active){setGrammar(g);setVocabulary(v);}})
      .catch((e)=>{if(active)setError(e instanceof Error?e.message:'Learning insights are temporarily unavailable.');});
    return ()=>{active=false;};
  }, [signedIn, level]);

  if (!signedIn) return <section className={styles.wrapper}><p>Sign in to see personalised grammar and vocabulary intelligence.</p></section>;

  return <section className={styles.wrapper}>
    <div className={styles.heading}><div><span>LEARNING INTELLIGENCE</span><h2>Know what needs attention.</h2><p>Insights from your answers and vocabulary revision history.</p></div><div className={styles.headingActions}><select aria-label="Vocabulary insight JLPT level" value={level} onChange={(event)=>setLevel(event.target.value as "N5"|"N4")}><option value="N5">N5 vocabulary</option><option value="N4">N4 vocabulary</option></select><Link href="/learn/sensei">Ask Japanese Sensei →</Link></div></div>
    {error?<p className={styles.error}>{error}</p>:null}
    <div className={styles.metrics}>
      <article><span>Grammar accuracy</span><strong>{grammar?grammar.accuracy+'%':'—'}</strong><small>{grammar?.totalAttempts??0} tagged question attempts</small></article>
      <article><span>Grammar weak spots</span><strong>{grammar?.weakTopicCount??'—'}</strong><small>Concepts to revisit</small></article>
      <article><span>Vocabulary due</span><strong>{vocabulary?.dueCount??'—'}</strong><small>{vocabulary?.atRiskCount??0} words at risk</small></article>
      <article><span>Words mastered</span><strong>{vocabulary?.masteredCount??'—'}</strong><small>{vocabulary?.learnedCount??0} words marked learned</small></article>
    </div>
    <div className={styles.columns}>
      <div className={styles.panel}>
        <div className={styles.panelTitle}><h3>Grammar mistake patterns</h3><span>FROM QUIZ RESULTS</span></div>
        {!grammar?.topics.length?<p className={styles.empty}>No grammar mistake patterns yet. Complete grammar practice to start building your profile. For detailed reports, tag quiz questions with skill labels.</p>:
          grammar.topics.slice(0,5).map(topic=><article className={styles.topic} key={topic.tag}>
            <div><strong>{topic.label}</strong><small>{topic.misses} missed · {topic.attempts} attempts</small></div>
            <div className={styles.progress}><i style={{width:topic.accuracy+'%'}}/></div><b>{topic.accuracy}%</b>
            {topic.weak?<p>{topic.recommendation}</p>:null}
          </article>)}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTitle}><h3>Vocabulary needs attention</h3><span>SM-2 + QUICK REVISION</span></div>
        {!vocabulary?.items.length?<p className={styles.empty}>No reviewed vocabulary is at risk yet. Rate words in your vocabulary cards to build a revision history.</p>:
          vocabulary.items.slice(0,6).map(item=><article className={styles.word} key={item.id}>
            <div><strong>{item.word}</strong><small>{item.kana} · {item.meaning}</small></div>
            <span className={item.atRisk?styles.risk:styles.due}>{item.atRisk?'At risk':item.due?'Due':'Review'}</span>
            <Link href={'/learn/sensei?topic='+encodeURIComponent('Explain the Japanese word '+item.word+' ('+item.kana+'), its natural usage, and this example: '+(item.example||item.meaning))}>Ask Sensei</Link>
            {item.example?<p>{item.example}<br/>{item.exampleMeaning}</p>:null}
          </article>)}
      </div>
    </div>
  </section>;
}
