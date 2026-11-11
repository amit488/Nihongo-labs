'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './sixty-second-challenge.module.css';

type ChallengeQuestion = { id:string; kind:'vocabulary'|'verb'|'kana-word'|'kanji'|'grammar'|'hiragana'|'katakana'|'sentence'; level:string; prompt:string; question:string; options:string[] };
type Answer = { questionId:string; selectedOption:string };
type Scorecard = { id:string; created_at:string; scorePercentage:number; totalAnswered:number; totalCorrect:number; categories:Record<string,{answered:number;correct:number}>; review:Array<{kind:string;level:string;question:string;prompt:string;selected:string;correctAnswer:string;correct:boolean;explanation:string}> };
const CHALLENGE_MS=60_000, AUTO_MIN_MS=7*60_000, AUTO_RANGE_MS=6*60_000;
const nextAutoDelay=()=>AUTO_MIN_MS+Math.floor(Math.random()*AUTO_RANGE_MS);

export function SixtySecondChallenge({signedIn,disabled=false}:{signedIn:boolean;disabled?:boolean}) {
  const [open,setOpen]=useState(false),[questions,setQuestions]=useState<ChallengeQuestion[]>([]),[index,setIndex]=useState(0),[secondsLeft,setSecondsLeft]=useState(60),[answers,setAnswers]=useState<Answer[]>([]),[scorecard,setScorecard]=useState<Scorecard|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const deadlineRef=useRef(0),targetAutoRef=useRef(nextAutoDelay()),activeTimeRef=useRef(0),busyRef=useRef(false),openRef=useRef(false),startRef=useRef<()=>void>(()=>undefined),finishRef=useRef<()=>void>(()=>undefined),answersRef=useRef<Answer[]>([]);
  useEffect(()=>{openRef.current=open;},[open]);
  const finish=useCallback(async()=>{
    if(!openRef.current||busyRef.current)return;
    openRef.current=false;setOpen(false);setLoading(true);
    const finalAnswers=answersRef.current;
    if(finalAnswers.length){
      try{
        const response=await fetch('/api/learning/sixty-second-challenge',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:finalAnswers,durationSeconds:Math.min(60,Math.max(0,Math.round((Date.now()-(deadlineRef.current-CHALLENGE_MS))/1000)))})});
        const body=await response.json();
        if(!response.ok)throw new Error(body.error||'Could not save your scorecard.');
        setScorecard(body.attempt as Scorecard);
      }catch(cause){setError(cause instanceof Error?cause.message:'Could not save your scorecard.');}
    }
    setLoading(false);setQuestions([]);activeTimeRef.current=0;targetAutoRef.current=nextAutoDelay();
  },[]);
  useEffect(()=>{finishRef.current=()=>{void finish();};},[finish]);
  const start=useCallback(async()=>{
    if(!signedIn||disabled||busyRef.current||openRef.current)return;
    busyRef.current=true;setLoading(true);setError('');setScorecard(null);setAnswers([]);answersRef.current=[];setIndex(0);setSecondsLeft(60);
    try{
      const response=await fetch('/api/learning/sixty-second-challenge',{credentials:'same-origin',cache:'no-store'});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not load challenge questions.');
      const list=(body.questions??[]) as ChallengeQuestion[];
      if(!list.length)throw new Error('Start learning vocabulary, kanji and grammar to unlock your challenge. Kana and sentence practice will also appear as you study.');
      setQuestions(list);deadlineRef.current=Date.now()+CHALLENGE_MS;setOpen(true);openRef.current=true;activeTimeRef.current=0;
    }catch(cause){setError(cause instanceof Error?cause.message:'The challenge is unavailable.');}
    finally{busyRef.current=false;setLoading(false);}
  },[signedIn,disabled]);
  useEffect(()=>{
    startRef.current=()=>{void start();};
  },[start]);
  useEffect(()=>{
    if(!signedIn||disabled)return;
    let last=performance.now();
    const timer=window.setInterval(()=>{
      const now=performance.now(),elapsed=Math.min(1500,Math.max(0,now-last));last=now;
      if(document.visibilityState!=='visible'||!document.hasFocus())return;
      if(openRef.current){const remaining=Math.max(0,deadlineRef.current-Date.now());setSecondsLeft(Math.ceil(remaining/1000));if(remaining<=0)finishRef.current();return;}
      if(document.querySelector('[role="dialog"]'))return;
      activeTimeRef.current+=elapsed;
      if(activeTimeRef.current>=targetAutoRef.current){activeTimeRef.current=0;targetAutoRef.current=nextAutoDelay();startRef.current();}
    },250);
    return()=>window.clearInterval(timer);
  },[signedIn,disabled]);
  const choose=(option:string)=>{
    if(!questions[index]||loading||secondsLeft<=0)return;
    const answer={questionId:questions[index].id,selectedOption:option};
    const next=[...answersRef.current,answer];answersRef.current=next;setAnswers(next);
    if(index+1>=questions.length){void finish();return;}
    setIndex(index+1);
  };
  const current=questions[index];
  if(!signedIn||disabled)return null;
  return <>
    <button type="button" className={styles.launcher} onClick={()=>void start()} disabled={loading||open}><span aria-hidden="true">◷</span> 60-second challenge</button>
    {error&&!open?<p className={styles.toast} role="status">{error}</p>:null}
    {scorecard&&!open?<div className={styles.resultToast} role="status"><strong>{scorecard.scorePercentage}% · {scorecard.totalCorrect}/{scorecard.totalAnswered} correct</strong><span>Scorecard saved in My Progress.</span><button type="button" onClick={()=>setScorecard(null)}>Dismiss</button></div>:null}
    {open&&current?<div className={styles.backdrop}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sixty-title">
      <header className={styles.header}><div><span className={styles.eyebrow}>NIHONGO LABS · MIXED-SKILL REVISION</span><h2 id="sixty-title">60-second challenge</h2></div><div className={styles.timer}>{secondsLeft}<small>SEC</small></div></header>
      <div className={styles.progressTrack}><span style={{width:(secondsLeft/60*100)+'%'}}/></div>
      <div className={styles.scoreRow}><span>{current.level} · {current.kind}</span><strong>{answers.length} answered <i>·</i> move quickly</strong></div>
      <h3>{current.question}</h3><div className={styles.prompt}>{current.prompt}</div>
      <div className={styles.options}>{current.options.map((option,i)=><button type="button" key={i} onClick={()=>choose(option)} disabled={loading}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div>
      <footer className={styles.actions}><span>Question {index+1} · {questions.length} in this round</span><button type="button" onClick={()=>void finish()}>Finish now</button></footer>
    </section></div>:null}
  </>;
}
