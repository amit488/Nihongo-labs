'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './learning-app.module.css';
import { getPublishedVocabulary, getReadingPassages, type LearnerFlashcard, type ReadingPassage } from '@/lib/nihongo/data';
import { kanaRows, katakanaRows, kanaRomajiRows, hiraganaVoicedRows, hiraganaVoicedRomajiRows, katakanaVoicedRows, katakanaVoicedRomajiRows } from '@/lib/nihongo/demo-content';
import type { GrammarItem, KanjiItem, VocabularyItem } from '@/lib/nihongo/demo-content';
import { EmptyState, ProgressBar, SectionHeading } from './learning-shared';

type FeatureSection = 'grammar' | 'practice' | 'vocabulary' | 'kanji' | 'kana' | 'flashcards' | 'reading' | 'exams' | 'subscription';
export type LearningFeatureProps = {
  active: FeatureSection; grammarItems: GrammarItem[]; vocabularyItems: VocabularyItem[]; kanjiItems: KanjiItem[];
  flashcardItems: LearnerFlashcard[]; signedIn: boolean; romaji: boolean; setRomaji: (value: boolean) => void; search: string;
  kanaMode: 'hiragana' | 'katakana'; setKanaMode: (value: 'hiragana' | 'katakana') => void;
  kanaQuiz: boolean; setKanaQuiz: (value: boolean) => void; onProgressSaved: () => Promise<void>;
};
type RazorpayPaymentResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string } };
type RazorpayCheckoutOptions = {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  theme: { color: string }; handler: (payment: RazorpayPaymentResult) => void | Promise<void>;
};
type RazorpayCheckout = { open: () => void; on: (event: 'payment.failed', callback: (payload: RazorpayFailure) => void) => void };
declare global { interface Window { Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckout; } }
type MembershipPlan = {
  id: string; code: string; name: string; description: string | null; planKind: string; amountMinor: number;
  currency: string; billingInterval: string; intervalCount: number; features: Array<{ key: string; value: unknown }>;
};
type MembershipSubscription = {
  id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean;
  subscription_plans: { name: string | null; billing_interval: string | null } | null;
};
type MembershipStatus = { hasPremium: boolean; subscriptions: MembershipSubscription[] };
type CheckoutResponse = { mode: 'subscription' | 'order'; checkoutUrl?: string; orderId?: string; keyId?: string; amountMinor?: number; currency?: string; planName?: string; error?: string };

function GrammarStudio({ items, romaji, setRomaji, signedIn }: { items: GrammarItem[]; romaji: boolean; setRomaji: (value: boolean) => void; signedIn: boolean }) {
  const [selected, setSelected] = useState(items[0]?.id || '');
  const [showExample, setShowExample] = useState(true);
  const [saved, setSaved] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const item = items.find((row) => row.id === selected) || items[0];
  async function toggleSave() {
    if (!item) return;
    if (!signedIn) {
      setNotice('Sign in to save grammar notes to your bookmarks.');
      return;
    }
    const isSaved = saved.includes(item.id);
    const response = await fetch('/api/learning/bookmarks', { method: isSaved ? 'DELETE' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resourceType: 'grammar', resourceId: item.id }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(body.error || 'Sign in to save grammar notes.'); return; }
    setSaved((current) => isSaved ? current.filter((id) => id !== item.id) : [...current, item.id]);
    setNotice(isSaved ? 'Removed from saved grammar.' : 'Grammar point saved to your bookmarks.');
  }
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch('/api/learning/bookmarks', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<unknown> : null)
      .then((body) => {
        if (!active) return;
        const items = asRecord(body)?.items;
        if (!Array.isArray(items)) return;
        const savedIds = items.flatMap((entry) => {
          const row = asRecord(entry);
          return row?.resource_type === 'grammar' && typeof row.resource_id === 'string' ? [row.resource_id] : [];
        });
        setSaved(savedIds);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [signedIn]);
  if (!item) return <EmptyState title="Grammar lessons are being prepared" description="Published grammar points will appear here once your content team adds them to the N5 curriculum." />;
  return <><SectionHeading eyebrow="BUILD YOUR FOUNDATION" title="Grammar, made clear." description="Understand the patterns behind everyday Japanese, one idea at a time." action={<button type="button" className={styles.ghostButton} onClick={()=>setRomaji(!romaji)}>{romaji?'Hide':'Show'} romaji</button>}/><div className={styles.splitLayout}><div className={styles.lessonList}>{items.map((row,i)=><button type="button" key={row.id} onClick={()=>{setSelected(row.id);setShowExample(true);}} className={`${styles.lessonRow} ${item.id===row.id?styles.lessonRowActive:''}`}><span className={styles.lessonNumber}>{String(i+1).padStart(2,'0')}</span><span className={styles.lessonDetails}><strong>{row.title}</strong><small>{row.category} · {row.difficulty}</small></span><span className={styles.lessonArrow}>→</span></button>)}</div><div className={styles.lessonDetail}><div className={styles.eyebrow}>GRAMMAR NOTE · JLPT N5</div><div className={styles.patternChip}>{item.pattern}</div><h2>{item.title}</h2><p>{item.explanation}</p><div className={styles.formationBox}><span>FORMATION</span><strong>{item.formation}</strong></div><div className={styles.exampleHeader}><strong>Examples in context</strong><button type="button" onClick={()=>setShowExample((v)=>!v)}>{showExample?'Hide':'Show'} examples</button></div>{showExample && item.examples.map((example,i)=><div className={styles.exampleCard} key={i}><strong className={styles.japaneseText}>{example.japanese}</strong>{romaji?<small>{example.romaji}</small>:null}<p>{example.meaning}</p></div>)}<button type="button" className={styles.primaryButton} onClick={()=>void toggleSave()}>{signedIn && saved.includes(item.id)?'Saved grammar note':'Save grammar note'} <span>{signedIn && saved.includes(item.id)?'★':'☆'}</span></button>{notice?<small className={styles.mutedMeta}>{notice}</small>:null}</div></div></>;
}

function Practice({ signedIn, romaji, setRomaji }: { signedIn: boolean; romaji: boolean; setRomaji: (value: boolean) => void }) {
  return <QuizRunner kind="practice" signedIn={signedIn} romaji={romaji} setRomaji={setRomaji} />;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type QuizChoice = { key: string; content: JsonValue };
type QuizQuestion = { id: string; type: string; prompt: JsonValue; points: number; options: QuizChoice[] };
type QuizFeedback = {
  questionId: string;
  correct: boolean;
  response: unknown;
  correctAnswer: unknown;
  explanation: string;
  detailedExplanation: JsonValue;
  pointsAwarded: number;
  points: number;
};
type QuizResult = {
  attemptId: string;
  scorePercentage: number;
  earnedPoints: number;
  totalPoints: number;
  passed: boolean;
  passPercentage: number;
  durationSeconds: number;
  feedback: QuizFeedback[];
  showResultsAfterSubmit: boolean;
};
type QuizRecord = { id: string; slug: string; title: string; description: string; timeLimitSeconds: number | null; passPercentage: number; accessLevel: string; questionCount: number };

function asJsonObject(value: JsonValue | undefined): JsonObject | null {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function jsonDisplayText(value: JsonValue | undefined, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return fallback;
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function QuizRunner({ kind, signedIn, romaji, setRomaji }: { kind: 'practice' | 'mock' | 'reading' | 'kana'; signedIn: boolean; romaji: boolean; setRomaji: (value: boolean) => void }) {
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizRecord | null>(null);
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const submitRef = useRef<() => Promise<void>>(async () => undefined);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const countdownRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const current = questions[index];
  const prompt: JsonObject = asJsonObject(current?.prompt) ?? { text: String(current?.prompt ?? '') };
  const savedResponse = current ? responses[current.id] : undefined;
  const typed = typeof savedResponse === 'string' ? savedResponse : '';
  const ordered = Array.isArray(savedResponse)
    ? savedResponse.filter((value): value is string => typeof value === 'string')
    : [];
  const optionLabel = (option: QuizChoice) => {
    if (typeof option.content === 'string') return option.content;
    const content = asJsonObject(option.content);
    return jsonDisplayText(content?.text ?? content?.label, JSON.stringify(option.content));
  };

  useEffect(() => {
    let alive = true;
    fetch(`/api/practice/quizzes?kind=${kind}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not load practice sets.'); return body; })
      .then((body) => { if (alive) setQuizzes(body.quizzes ?? []); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind]);

  async function begin(quiz: QuizRecord) {
    setError('');
    if (!signedIn) { setError('Sign in to save your attempts and personal learning progress.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/practice/start', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not start this practice set.');
      setActiveQuiz(quiz); setAttemptId(body.attemptId);
      setQuestions(body.quiz.questions ?? []); setResponses({}); setIndex(0); setResult(null);
      const timeLimit = Number(body.quiz.time_limit_seconds ?? quiz.timeLimitSeconds ?? 0);
      countdownRef.current = timeLimit;
      setRemaining(timeLimit);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start this practice set.'); }
    finally { setBusy(false); }
  }

  const submit = useCallback(async () => {
    if (!attemptId || busy || result) return;
    setBusy(true); setError('');
    try {
      const payload = { attemptId, responses: Object.entries(responses).map(([questionId, response]) => ({ questionId, response })) };
      const response = await fetch('/api/practice/submit', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not submit your answers.');
      setResult(body as QuizResult);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit your answers.'); }
    finally { setBusy(false); }
  }, [attemptId, busy, result, responses]);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    if (!attemptId || result || countdownRef.current <= 0) return;
    const timer = window.setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1);
      setRemaining(countdownRef.current);
      if (countdownRef.current === 0) {
        window.clearInterval(timer);
        void submitRef.current();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attemptId, result]);

  function choose(optionKey: string) {
    if (!current) return;
    if (current.type === 'multiple_choice') {
      const existing = Array.isArray(responses[current.id]) ? responses[current.id] as string[] : [];
      setResponses((state) => ({ ...state, [current.id]: existing.includes(optionKey) ? existing.filter((key) => key !== optionKey) : [...existing, optionKey] }));
    } else setResponses((state) => ({ ...state, [current.id]: optionKey }));
  }

  const formatTime = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  const feedbackById = new Map<string, QuizFeedback>(
    (result?.feedback ?? []).map((item): [string, QuizFeedback] => [item.questionId, item]),
  );
  const answersText = (item: QuizQuestion) => {
    const feedback = feedbackById.get(item.id);
    if (!feedback) return 'No answer feedback was returned.';
    const value = feedback.correctAnswer;
    if (Array.isArray(value)) {
      return value.map((entry) => {
        const key = String(entry);
        const option = item.options.find((row) => row.key === key);
        return option ? optionLabel(option) : key;
      }).join(' → ');
    }
    const answerObject = asRecord(value);
    if (answerObject) {
      const answerValue = answerObject.option_key ?? answerObject.value;
      return typeof answerValue === 'string' ? answerValue : JSON.stringify(value);
    }
    const option = item.options.find((row) => row.key === String(value));
    return option ? optionLabel(option) : String(value);
  };

  if (result) return <>
    <SectionHeading eyebrow={kind === 'mock' ? 'EXAMINATION RESULT' : kind === 'reading' ? 'READING RESULTS' : kind === 'kana' ? 'KANA RESULTS' : 'PRACTICE RESULTS'} title="Every attempt teaches you something." description="Your answers have been graded on the server and saved to your learning history." action={<span className={styles.counterPill}>{result.passed ? 'Passed' : 'Keep practising'}</span>} />
    <div className={styles.examResult}>
      <div className={styles.scoreCircle}><strong>{Math.round(result.scorePercentage)}%</strong><span>your score</span></div>
      <h2>{result.passed ? 'Well done — keep going!' : 'Good effort. Review the explanations.'}</h2>
      <p>{result.earnedPoints} of {result.totalPoints} points · {result.durationSeconds}s · pass target {result.passPercentage}%</p>
      <div className={styles.resultReview}>{questions.map((question) => {
        const feedback = feedbackById.get(question.id);
        const promptObject = asJsonObject(question.prompt);
        const text = jsonDisplayText(promptObject?.text ?? question.prompt);
        const explanationObject = asJsonObject(feedback?.detailedExplanation);
        const explanation = jsonDisplayText(explanationObject?.explanation) || feedback?.explanation || 'Review the related lesson and try again.';
        const example = jsonDisplayText(explanationObject?.example);
        const translation = jsonDisplayText(explanationObject?.translation);
        return <div key={question.id} className={styles.resultRow}>
          <span className={feedback?.correct ? styles.resultGood : styles.resultBad}>{feedback?.correct ? '✓' : '×'}</span>
          <div><strong>{text}</strong><small>Correct answer: {answersText(question)} · {explanation}</small>
            {example ? <small>Example: {example} {translation}</small> : null}
          </div>
        </div>;
      })}</div>
      <button className={styles.primaryButton} onClick={() => { setActiveQuiz(null); setAttemptId(''); setResult(null); setResponses({}); }}>Back to {kind === 'mock' ? 'examinations' : kind === 'reading' ? 'reading' : kind === 'kana' ? 'kana' : 'practice'} <span>→</span></button>
    </div>
  </>;

  if (activeQuiz && current) {
    return <>
      <SectionHeading eyebrow={kind === 'mock' ? 'TIMED JLPT SIMULATOR' : kind === 'reading' ? 'READING COMPREHENSION' : kind === 'kana' ? 'KANA RECOGNITION' : 'DAILY PRACTICE ENGINE'} title={activeQuiz.title} description={activeQuiz.description || 'Answer each question, then submit to receive detailed explanations.'} action={<button className={styles.ghostButton} type="button" onClick={() => setRomaji(!romaji)}>{romaji ? 'Hide' : 'Show'} romaji <span>あ</span></button>} />
      <div className={styles.examRunningTop}><div><div className={styles.eyebrow}>QUESTION {index + 1} OF {questions.length}</div><h1>{jsonDisplayText(prompt.instruction, 'Choose the best answer.')}</h1></div><div className={styles.timerBox}><small>TIME LEFT</small><strong>{formatTime}</strong></div></div>
      <ProgressBar value={(index + 1) / questions.length * 100} />
      <div className={styles.examQuestion}>
        <div className={styles.questionType}>{current.type.replaceAll('_', ' ').toUpperCase()}</div>
        <h2>{jsonDisplayText(prompt.text ?? prompt.question, 'Complete the question.')}</h2>
        {romaji && prompt.romaji ? <div className={styles.questionRomaji}>{jsonDisplayText(prompt.romaji)}</div> : null}
        {prompt.meaning ? <div className={styles.questionMeaning}>{jsonDisplayText(prompt.meaning)}</div> : null}
        {current.type === 'fill_blank' || current.type === 'short_answer' ? <div className={styles.fillForm}><input value={typed} onChange={(event) => setResponses((state) => ({ ...state, [current.id]: event.target.value }))} placeholder="Type your answer" /><span /></div> : null}
        {current.type === 'ordering' ? <>
          <div className={styles.builderAnswer}>{ordered.length ? ordered.map((key) => { const option = current.options.find((row) => row.key === key); return <button key={key} type="button" onClick={() => { setResponses((value) => ({ ...value, [current.id]: ordered.filter((part) => part !== key) })); }}>{option ? optionLabel(option) : key} <small>×</small></button>; }) : <span>Build the sentence in the right order…</span>}</div>
          <div className={styles.builderTiles}>{current.options.filter((option) => !ordered.includes(option.key)).map((option) => <button type="button" key={option.key} onClick={() => { const next = [...ordered, option.key]; setResponses((value) => ({ ...value, [current.id]: next })); }}>{optionLabel(option)}</button>)}</div>
        </> : null}
        {current.type !== 'fill_blank' && current.type !== 'short_answer' && current.type !== 'ordering' ? <div className={styles.choiceGrid}>{current.options.map((option) => {
          const picked = current.type === 'multiple_choice' ? (Array.isArray(responses[current.id]) && (responses[current.id] as string[]).includes(option.key)) : responses[current.id] === option.key;
          return <button type="button" key={option.key} className={`${styles.choiceButton} ${picked ? styles.choiceSelected : ''}`} onClick={() => choose(option.key)}><span>{optionLabel(option)}</span><small>{option.key}</small></button>;
        })}</div> : null}
        <div className={styles.examControls}>
          <button className={styles.textButton} onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>← Previous</button>
          {index < questions.length - 1 ? <button className={styles.primaryButton} onClick={() => setIndex((value) => value + 1)}>Next question <span>→</span></button> : <button className={styles.primaryButton} disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit answers'} <span>✓</span></button>}
        </div>
        {index === questions.length - 1 && questions.length > 1 ? <button className={styles.textButton} onClick={() => void submit()} disabled={busy}>Submit now and finish the set</button> : null}
        {error ? <div className={styles.authMessage}>{error}</div> : null}
      </div>
    </>;
  }

  return <>
    <SectionHeading eyebrow={kind === 'mock' ? 'EXAM SIMULATOR' : 'DAILY PRACTICE · N5'} title={kind === 'mock' ? 'Make exam day feel familiar.' : 'A little practice goes a long way.'} description={kind === 'mock' ? 'Start a timed mock examination. Your attempt is graded and stored securely.' : 'Choose a focused practice set. Your progress and answers are saved to your account.'} action={<button className={styles.ghostButton} type="button" onClick={() => setRomaji(!romaji)}>{romaji ? 'Hide' : 'Show'} romaji <span>あ</span></button>} />
    {!signedIn ? <div className={styles.emptyState}><div>学</div><h2>Sign in to start learning</h2><p>Your practice attempts, exam results and streaks are saved to your account.</p><Link href="/login" className={styles.primaryButton}>Sign in <span>→</span></Link></div> : null}
    {loading ? <div className={styles.panel}>Loading practice sets…</div> : null}
    {!loading && quizzes.length === 0 ? <EmptyState title="Practice sets are not seeded yet" description="Run sql/010_n5_content_and_plans_seed.sql in local Supabase Studio to add the N5 starter practice bank." /> : null}
    <div className={styles.focusGrid}>{quizzes.map((quiz) => <div className={styles.focusCard} key={quiz.id}><div className={styles.focusTop}><span>{String(quiz.questionCount).padStart(2, '0')} questions</span><small>{quiz.accessLevel.toUpperCase()}</small></div><h3>{quiz.title}</h3><p>{quiz.description}</p><div className={styles.focusMeta}><span>◷ {quiz.timeLimitSeconds ? `${Math.ceil(quiz.timeLimitSeconds / 60)} min` : 'Untimed'} · Pass {quiz.passPercentage}%</span><button className={styles.textButton} disabled={!signedIn || busy} onClick={() => void begin(quiz)}>Start →</button></div></div>)}</div>
    {error ? <div className={styles.authMessage}>{error}</div> : null}
  </>;
}


type VocabularyLevel = 'N5' | 'N4';
type VocabularyView = 'new' | 'learned';
type LearnedVocabularyItem = {
  vocabularyId: string;
  learnedAt: string;
  word: string;
  kana: string;
  romaji: string;
  meaning: string;
};

const VOCABULARY_PAGE_SIZE = 80;

function Vocabulary({
  items: fallbackItems, romaji, setRomaji, signedIn, search, onProgressSaved,
}: {
  items: VocabularyItem[];
  romaji: boolean;
  setRomaji: (value: boolean) => void;
  signedIn: boolean;
  search: string;
  onProgressSaved: () => Promise<void>;
}) {
  const [level, setLevel] = useState<VocabularyLevel>('N5');
  const [view, setView] = useState<VocabularyView>('new');
  const [deckItems, setDeckItems] = useState<VocabularyItem[]>([]);
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
  const [learnedItems, setLearnedItems] = useState<LearnedVocabularyItem[]>([]);
  const [learnedListLoaded, setLearnedListLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [learnedLoading, setLearnedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageBusyRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const learnedIdsRef = useRef<Set<string>>(new Set());
  const queryKeyRef = useRef('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    learnedIdsRef.current = learnedIds;
  }, [learnedIds]);

  const queryKey = `${level}|${debouncedSearch}`;

  function toggleExample(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    queryKeyRef.current = queryKey;
    setLoading(true);
    setNotice('');
    setExpandedIds(new Set());
    setDeckItems([]);
    setLearnedIds(new Set<string>());
    learnedIdsRef.current = new Set<string>();
    setLearnedItems([]);
    setLearnedListLoaded(false);
    setLearnedLoading(false);
    setHasMore(false);
    hasMoreRef.current = false;
    setLoadingMore(false);
    pageBusyRef.current = false;
    nextOffsetRef.current = 0;

    async function loadInitialPage() {
      const [page, progressResponse] = await Promise.all([
        getPublishedVocabulary(level, 0, VOCABULARY_PAGE_SIZE, debouncedSearch),
        signedIn
          ? fetch(`/api/learning/vocabulary-progress?level=${level}&view=ids`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const progressBody = progressResponse?.ok
        ? await progressResponse.json() as { vocabularyIds?: string[] }
        : undefined;
      const ids = new Set(progressBody?.vocabularyIds ?? []);
      if (!active || queryKeyRef.current !== queryKey) return;

      learnedIdsRef.current = ids;
      setLearnedIds(ids);
      let visible = page.items.filter((item) => !ids.has(item.id));
      let offset = page.nextOffset;
      let more = page.hasMore;

      // Fill the first view to roughly 80 unseen words without requesting a large catalogue.
      while (visible.length < VOCABULARY_PAGE_SIZE && more && offset > 0) {
        const needed = VOCABULARY_PAGE_SIZE - visible.length;
        const nextPage = await getPublishedVocabulary(level, offset, Math.min(needed, VOCABULARY_PAGE_SIZE), debouncedSearch);
        if (!active || queryKeyRef.current !== queryKey) return;
        const seen = new Set(visible.map((item) => item.id));
        visible = [...visible, ...nextPage.items.filter((item) => !ids.has(item.id) && !seen.has(item.id))];
        offset = nextPage.nextOffset;
        more = nextPage.hasMore;
        if (nextPage.items.length === 0) break;
      }

      if (!active || queryKeyRef.current !== queryKey) return;
      setDeckItems(visible);
      nextOffsetRef.current = offset;
      setHasMore(more);
      hasMoreRef.current = more;
    }

    void loadInitialPage()
      .catch((error) => {
        if (active) {
          setDeckItems(level === 'N5' && !debouncedSearch ? fallbackItems.slice(0, VOCABULARY_PAGE_SIZE) : []);
          setNotice(error instanceof Error ? error.message : 'Could not load vocabulary.');
        }
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [level, debouncedSearch, signedIn, fallbackItems, queryKey]);

  const loadMore = useCallback(async (requestedLimit = VOCABULARY_PAGE_SIZE) => {
    if (pageBusyRef.current || !hasMoreRef.current) return;
    pageBusyRef.current = true;
    setLoadingMore(true);
    const requestKey = queryKeyRef.current;
    try {
      let offset = nextOffsetRef.current;
      let more = hasMoreRef.current;
      let additions: VocabularyItem[] = [];
      const existingIds = new Set(deckItems.map((item) => item.id));

      // Continue through already-learned rows until we have a useful page of unseen words.
      while (additions.length < requestedLimit && more) {
        const remaining = requestedLimit - additions.length;
        const page = await getPublishedVocabulary(
          level,
          offset,
          Math.min(VOCABULARY_PAGE_SIZE, Math.max(remaining, 20)),
          debouncedSearch,
        );
        if (requestKey !== queryKeyRef.current) return;
        additions = [...additions, ...page.items.filter((item) =>
          !learnedIdsRef.current.has(item.id) &&
          !existingIds.has(item.id) &&
          !additions.some((added) => added.id === item.id),
        )];
        offset = page.nextOffset;
        more = page.hasMore;
        if (page.items.length === 0) break;
      }

      if (requestKey !== queryKeyRef.current) return;
      if (additions.length) {
        setDeckItems((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          return [...current, ...additions.filter((item) => !currentIds.has(item.id))];
        });
      }
      nextOffsetRef.current = offset;
      setNextOffset(offset);
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (error) {
      if (requestKey === queryKeyRef.current) setNotice(error instanceof Error ? error.message : 'Could not load more vocabulary.');
    } finally {
      pageBusyRef.current = false;
      if (requestKey === queryKeyRef.current) setLoadingMore(false);
    }
  }, [level, debouncedSearch, deckItems]);

  useEffect(() => {
    if (view !== 'new' || loading || !hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '420px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [view, loading, hasMore, loadMore]);

  useEffect(() => {
    if (view !== 'learned') return;
    let active = true;
    setLearnedLoading(true);
    async function loadLearnedWords() {
      if (!signedIn) {
        setLearnedItems([]);
        setLearnedListLoaded(true);
        return;
      }
      const params = new URLSearchParams({ level, view: 'learned', limit: '500', q: debouncedSearch });
      const response = await fetch(`/api/learning/vocabulary-progress?${params.toString()}`, {
        credentials: 'same-origin', cache: 'no-store',
      });
      const body = await response.json() as { items?: LearnedVocabularyItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load learned words.');
      if (active) {
        setLearnedItems(body.items ?? []);
        setLearnedListLoaded(true);
      }
    }
    void loadLearnedWords()
      .catch((error) => { if (active) setNotice(error instanceof Error ? error.message : 'Could not load learned words.'); })
      .finally(() => { if (active) setLearnedLoading(false); });
    return () => { active = false; };
  }, [view, level, debouncedSearch, signedIn]);

  async function review(id: string, quality: number) {
    if (reviewBusy) return;
    setReviewBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/learning/vocabulary-review', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId: id, quality }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save vocabulary review.');
      setNotice(`Revision saved · next review ${new Date(body.state.due_at).toLocaleDateString()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save review.');
    } finally {
      setReviewBusy(false);
    }
  }

  async function markLearned(item: VocabularyItem) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) {
      setNotice('This is preview content. Connect and publish vocabulary in Supabase before saving learning progress.');
      return;
    }
    if (!signedIn) {
      setNotice('Sign in to save learned words and keep them hidden from your new-word list.');
      return;
    }
    if (savingId) return;
    setSavingId(item.id);
    setNotice('');
    try {
      const response = await fetch('/api/learning/vocabulary-progress', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId: item.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not mark this word as learned.');
      const learned: LearnedVocabularyItem = {
        vocabularyId: item.id, learnedAt: new Date().toISOString(),
        word: item.word, kana: item.kana, romaji: item.romaji, meaning: item.meaning,
      };
      setLearnedIds((current) => {
        const next = new Set(current);
        next.add(item.id);
        learnedIdsRef.current = next;
        return next;
      });
      setDeckItems((current) => current.filter((row) => row.id !== item.id));
      if (learnedListLoaded) setLearnedItems((current) => [learned, ...current.filter((row) => row.vocabularyId !== item.id)]);
      setNotice(`“${item.word}” moved to your learned vocabulary.`);
      void onProgressSaved();
      if (deckItems.length - 1 < VOCABULARY_PAGE_SIZE && hasMoreRef.current) void loadMore(1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not mark this word as learned.');
    } finally {
      setSavingId('');
    }
  }

  async function unmarkLearned(item: LearnedVocabularyItem) {
    if (savingId) return;
    setSavingId(item.vocabularyId);
    setNotice('');
    try {
      const response = await fetch('/api/learning/vocabulary-progress', {
        method: 'DELETE', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId: item.vocabularyId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not move this word back to new vocabulary.');
      setLearnedIds((current) => {
        const next = new Set(current);
        next.delete(item.vocabularyId);
        learnedIdsRef.current = next;
        return next;
      });
      setLearnedItems((current) => current.filter((row) => row.vocabularyId !== item.vocabularyId));
      const restored: VocabularyItem = {
        id: item.vocabularyId, word: item.word, kana: item.kana, romaji: item.romaji,
        meaning: item.meaning, partOfSpeech: 'Word', example: '', exampleRomaji: '', exampleMeaning: '',
      };
      const searchText = `${restored.word} ${restored.kana} ${restored.romaji} ${restored.meaning}`.toLowerCase();
      if (!debouncedSearch || searchText.includes(debouncedSearch.toLowerCase())) {
        setDeckItems((current) => current.some((row) => row.id === restored.id)
          ? current
          : [...current, restored].sort((a, b) => a.word.localeCompare(b.word)));
      }
      setNotice(`“${item.word}” returned to your new-word list.`);
      void onProgressSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update learned vocabulary.');
    } finally {
      setSavingId('');
    }
  }

  return <>
    <SectionHeading
      eyebrow={`JLPT ${level} VOCABULARY`}
      title="Words you’ll use every day."
      description="Learn in small batches, mark words you know, and keep moving forward."
      action={
        <div className={styles.vocabTopControls}>
          <div className={styles.vocabSwitch} aria-label="JLPT vocabulary level">
            {(['N5', 'N4'] as const).map((option) => (
              <button key={option} type="button" className={level === option ? styles.vocabSwitchActive : ''}
                aria-pressed={level === option} onClick={() => setLevel(option)}>{option}</button>
            ))}
          </div>
          <button type="button" className={styles.ghostButton} onClick={() => setRomaji(!romaji)}>
            {romaji ? 'Hide' : 'Show'} romaji
          </button>
        </div>
      }
    />
    <div className={styles.toolbar}>
      <span>{view === 'new' ? `${deckItems.length} new words loaded` : `${learnedIds.size} learned words`} · {signedIn ? 'Your progress is saved' : 'Sign in to save progress'}</span>
      <div className={styles.filterPills}>
        <button type="button" className={view === 'new' ? styles.filterActive : ''} onClick={() => setView('new')}>New words</button>
        <button type="button" className={view === 'learned' ? styles.filterActive : ''} onClick={() => setView('learned')}>Learned ({learnedIds.size})</button>
      </div>
    </div>
    {notice ? <div className={styles.billingNote} role="status">{notice}</div> : null}

    {view === 'new' ? <>
      {loading ? <div className={styles.panel} role="status">Loading your first 80 words…</div> : null}
      {!loading && deckItems.length === 0 ? (
        <div className={styles.panel}>
          <strong>{debouncedSearch ? 'No matching new words' : learnedIds.size ? 'You’ve learned all available words at this level' : 'No vocabulary published yet'}</strong>
          <p className={styles.mutedMeta}>{debouncedSearch ? 'Try another search term.' : 'Switch to the Learned tab to review words you have mastered.'}</p>
        </div>
      ) : null}
      <div className={styles.vocabGrid}>
        {deckItems.map((item) => (
          <article key={item.id} className={`${styles.vocabCard} ${expandedIds.has(item.id) ? styles.vocabExpanded : ''}`}>
            <button type="button" className={styles.vocabCardTop} onClick={() => toggleExample(item.id)}>
              <span className={styles.wordType}>{item.partOfSpeech}</span>
              <span className={styles.bookmark}>{expandedIds.has(item.id) ? '⌃' : '⌄'}</span>
            </button>
            <button type="button" className={styles.vocabCardBody} onClick={() => toggleExample(item.id)}>
              <div className={styles.vocabWord}>{item.word}</div>
              <div className={styles.vocabKana}>{item.kana}</div>
              {romaji ? <div className={styles.vocabRomaji}>{item.romaji}</div> : null}
              <div className={styles.vocabMeaning}>{item.meaning}</div>
            </button>
            {expandedIds.has(item.id) ? (
              <div className={styles.vocabExample}>
                {item.example ? <strong>{item.example}</strong> : null}
                {romaji && item.exampleRomaji ? <small>{item.exampleRomaji}</small> : null}
                {item.exampleMeaning ? <span>{item.exampleMeaning}</span> : null}
                <div className={styles.ratingRow}>
                  <span>How well do you remember it?</span>
                  <div>
                    <button type="button" className={styles.rateAgain} disabled={reviewBusy} onClick={() => void review(item.id, 1)}>Again</button>
                    <button type="button" className={styles.rateGood} disabled={reviewBusy} onClick={() => void review(item.id, 4)}>Good</button>
                    <button type="button" className={styles.rateEasy} disabled={reviewBusy} onClick={() => void review(item.id, 5)}>Easy</button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.vocabActions}>
              <button type="button" className={styles.ghostButton} onClick={() => toggleExample(item.id)}>
                {expandedIds.has(item.id) ? 'Close example' : 'View example'}
              </button>
              <button type="button" className={styles.vocabLearnButton} disabled={savingId === item.id}
                onClick={() => void markLearned(item)}>
                {savingId === item.id ? 'Saving…' : 'Mark learned ✓'}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div ref={sentinelRef} className={styles.vocabSentinel} aria-hidden="true" />
      {loadingMore ? <div className={styles.vocabLoadStatus} role="status">Loading the next words…</div> : null}
      {!loading && hasMore && !loadingMore ? (
        <div className={styles.vocabLoadStatus}>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadMore()}>Load 80 more words</button>
        </div>
      ) : null}
      {!loading && !hasMore && deckItems.length > 0 ? <div className={styles.vocabLoadStatus}>You’re up to date for this level.</div> : null}
    </> : <>
      {!signedIn ? <div className={styles.panel}>Sign in to see your learned-word list on every device.</div> : null}
      {signedIn && learnedLoading ? <div className={styles.panel} role="status">Loading learned words…</div> : null}
      {signedIn && !learnedLoading && learnedItems.length === 0 ? (
        <div className={styles.panel}>No learned words yet. Mark a word as learned and it will be saved here.</div>
      ) : null}
      {signedIn && learnedItems.length > 0 ? (
        <div className={styles.vocabLearnedList}>
          {learnedItems.map((item) => (
            <article className={styles.vocabLearnedRow} key={item.vocabularyId}>
              <div className={styles.vocabLearnedWord}>
                <strong>{item.word}</strong>
                <span>{item.kana}{romaji && item.romaji ? ` · ${item.romaji}` : ''}</span>
              </div>
              <p>{item.meaning}</p>
              <button type="button" className={styles.secondaryButton} disabled={savingId === item.vocabularyId}
                onClick={() => void unmarkLearned(item)}>
                {savingId === item.vocabularyId ? 'Saving…' : 'Move back'}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </>}
  </>;
}

function Kanji({ items, onProgressSaved }: { items: KanjiItem[]; onProgressSaved: () => Promise<void> }) {
  const [level, setLevel] = useState<'N5' | 'N4'>('N5');
  const [deckItems, setDeckItems] = useState<KanjiItem[]>(items);
  const [selected, setSelected] = useState(items[0]?.id || '');
  const [flipped, setFlipped] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Record<string, 'known' | 'learning'>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const selectedItem = deckItems.find((row) => row.id === selected) || deckItems[0];
  const filtered = useMemo(() => deckItems.filter((row) => `${row.character} ${row.meaning} ${row.radical}`.toLowerCase().includes(query.toLowerCase())), [deckItems, query]);
  const knownCount = Object.values(status).filter((value) => value === 'known').length;
  const learningCount = Object.values(status).filter((value) => value === 'learning').length;

  useEffect(() => {
    let alive = true;
    void fetch('/api/kanji/session', { credentials: 'same-origin', cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<{ signedIn?: boolean }> : null).then((body) => { if (alive) setSignedIn(Boolean(body?.signedIn)); }).catch(() => undefined);

    void fetch(`/api/learning/content?kind=kanji&level=${level}&limit=250`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load this kanji deck.');
        const body = await response.json() as { items?: Array<{ id:string; character:string; meaning:string; on_yomi:string[]|null; kun_yomi:string[]|null; stroke_count:number|null; radical:string|null; example_words:Array<{word?:string;reading?:string;meaning?:string}>|null }> };
        const mapped = (body.items || []).map((row) => {
          const example = row.example_words?.[0];
          return { id:row.id, character:row.character, meaning:row.meaning, onYomi:row.on_yomi||[], kunYomi:row.kun_yomi||[], strokes:row.stroke_count||0, radical:row.radical||'', example: example ? `${example.word||''}${example.reading ? `（${example.reading}）` : ''}` : '', exampleMeaning:example?.meaning||'' };
        });
        if (alive) { setDeckItems(mapped); setSelected(mapped[0]?.id || ''); setFlipped(false); }
      })
      .catch((error) => { if (alive) { setDeckItems(level === 'N5' ? items : []); setSelected(level === 'N5' ? items[0]?.id || '' : ''); setNotice(error instanceof Error ? error.message : 'Could not load kanji.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [level, items]);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/kanji/progress?level=${level}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ progress?: Array<{kanji_id:string;status:'known'|'learning'}> }> : null)
      .then((body) => { if (alive && body?.progress) setStatus(Object.fromEntries(body.progress.map((row) => [row.kanji_id,row.status]))); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [level]);

  function changeLevel(nextLevel: 'N5' | 'N4') {
    if (nextLevel === level) return;
    setLoading(true);
    setNotice('');
    setLevel(nextLevel);
    setQuery('');
    setFlipped(false);
  }

  async function markFamiliarity(value: 'known' | 'learning') {
    if (!selectedItem || !signedIn || reviewLoading) return;
    setReviewLoading(true);
    setNotice(value === 'known' ? 'Saving known status…' : 'Saving learning status…');
    try {
      const response = await fetch('/api/kanji/review', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ kanjiId:selectedItem.id, status:value }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || (response.status === 401 ? 'Sign in to save your kanji progress.' : 'Progress could not be saved.')); }
      setStatus((current) => ({ ...current, [selectedItem.id]: value }));
      setNotice(value === 'known' ? 'Your progress has been saved.' : 'Added to your review list.');
      await onProgressSaved();
    } catch { setNotice('Your selection is shown for this session, but could not be saved.'); }
    finally { setReviewLoading(false); }
  }

  return <>
    <SectionHeading eyebrow="THE BUILDING BLOCKS" title="Meet your kanji." description="Explore each character, flip for meanings and readings, and build your own familiarity over time." action={<span className={styles.counterPill}>{deckItems.length} characters</span>}/>
    <div className={styles.kanjiLevelTabs} aria-label="Kanji deck level">
      <button type="button" aria-pressed={level==='N5'} onClick={()=>changeLevel('N5')}>N5 kanji</button>
      <button type="button" aria-pressed={level==='N4'} onClick={()=>changeLevel('N4')}>N4 kanji</button>
    </div>
    <div className={styles.kanjiControls}>
      <input aria-label="Search kanji" placeholder="Search kanji or meaning…" value={query} onChange={(event)=>setQuery(event.target.value)}/>
      <span className={styles.kanjiCount}>{filtered.length} of {deckItems.length} characters · {knownCount} known · {learningCount} learning</span>
    </div>
    {notice ? <div className={styles.billingNote}>{notice}</div> : null}
    {loading ? <div className={styles.kanjiDeckEmpty}>Loading {level} kanji…</div> : !filtered.length ? <div className={styles.kanjiDeckEmpty}>No kanji found in this deck.</div> :
      <div className={styles.kanjiLayout}>
        <div className={styles.kanjiGrid}>{filtered.map((row)=> <button type="button" key={row.id} onClick={()=>{setSelected(row.id);setFlipped(false);}} className={`${styles.kanjiTile} ${row.id===selected?styles.kanjiSelected:''}`}><strong>{row.character}</strong><span>{row.meaning}</span><small>{row.strokes} strokes</small></button>)}</div>
        {selectedItem&&<div className={styles.kanjiDetail}>
          <button type="button" aria-label={flipped?'Show kanji front':'Flip kanji card'} onClick={()=>setFlipped((value)=>!value)} style={{width:'100%',border:0,background:'transparent',padding:0,cursor:'pointer'}} aria-pressed={flipped}>
            <div className={styles.kanjiBig}>{selectedItem.character}</div>
            {flipped ? <div className={styles.kanjiMeaning}>{selectedItem.meaning}</div> : <div className={styles.kanjiMeaning} aria-hidden="true" style={{opacity:0,fontSize:12}}>Tap to reveal</div>}
            <div className={styles.kanjiMeta}><span>{selectedItem.strokes} strokes</span><span>Radical · {selectedItem.radical || '—'}</span><span>{level}</span></div>
            <div className={styles.kanjiCardHint}>{flipped?'TAP TO HIDE DETAILS':'TAP CARD TO REVEAL READINGS ↻'}</div>
          </button>
          {flipped ? <div className={styles.readingBlock}>
            <div><small>ONYOMI · 音読み</small><strong>{selectedItem.onYomi.join(' · ')||'—'}</strong><p>Chinese-origin readings, commonly used in compound words.</p></div>
            <div><small>KUNYOMI · 訓読み</small><strong>{selectedItem.kunYomi.join(' · ')||'—'}</strong><p>Native Japanese readings, often used with okurigana.</p></div>
            <div className={styles.kanjiExample}><small>EXAMPLE WORD</small><strong>{selectedItem.example||'Examples being prepared'}</strong><span>{selectedItem.exampleMeaning||'See the readings above for common usage.'}</span></div>
            <div className={styles.kanjiFamiliarity}>
              <span>How familiar are you with this kanji?</span>
              <div><button type="button" title={signedIn?'Save learning status':'Sign in to save progress'} disabled={!signedIn || reviewLoading} onClick={()=>void markFamiliarity('learning')}>{reviewLoading?'Saving…':'Still learning'}</button><button type="button" title={signedIn?'Save learning status':'Sign in to save progress'} disabled={!signedIn || reviewLoading} onClick={()=>void markFamiliarity('known')}>Know it ✓</button></div>
              <small>{status[selectedItem.id]==='known'?'Marked as known':status[selectedItem.id]==='learning'?'In your learning review':'Not reviewed yet'}</small>
            </div>
          </div> : null}
        </div>}
      </div>}
  </>;
}

function Kana({ mode, setMode, quiz, setQuiz, signedIn, romaji, setRomaji }: { mode: 'hiragana'|'katakana'; setMode: (value:'hiragana'|'katakana')=>void; quiz: boolean; setQuiz: (value:boolean)=>void; signedIn:boolean; romaji:boolean; setRomaji:(v:boolean)=>void }) {
  const rows = mode==='hiragana'?kanaRows:katakanaRows;
  const voicedRows = mode==='hiragana'?hiraganaVoicedRows:katakanaVoicedRows;
  const voicedRomajiRows = mode==='hiragana'?hiraganaVoicedRomajiRows:katakanaVoicedRomajiRows;
  return <>{quiz ? <><SectionHeading eyebrow="KANA KNOWLEDGE CHECK" title="Test your kana recognition." description="Complete the saved N5 kana quiz to record your result." action={<button className={styles.ghostButton} onClick={()=>setQuiz(false)}>Back to chart</button>}/><QuizRunner kind="kana" signedIn={signedIn} romaji={romaji} setRomaji={setRomaji}/></> : <><SectionHeading eyebrow="YOUR FIRST MILESTONE" title="Get comfortable with kana." description="Master the two phonetic alphabets that make Japanese reading possible." action={<div className={styles.headingActions}><button type="button" className={styles.ghostButton} onClick={()=>setRomaji(!romaji)}>{romaji?'Hide':'Show'} romaji</button><button className={styles.primaryButton} type="button" onClick={()=>setQuiz(true)}>Start scored kana quiz <span>→</span></button></div>}/><div className={styles.kanaToolbar}><div className={styles.segmented}><button className={mode==='hiragana'?styles.segmentActive:''} onClick={()=>setMode('hiragana')}>あ Hiragana</button><button className={mode==='katakana'?styles.segmentActive:''} onClick={()=>setMode('katakana')}>ア Katakana</button></div><span>46 basic characters · plus voiced sounds</span></div><div className={styles.kanaChart}><div className={styles.kanaChartHeader}><div><strong>{mode==='hiragana'?'Hiragana':'Katakana'} chart</strong><span>Each character is paired with its standard romaji reading.</span></div><span className={styles.chartCount}>46 / 46 basic</span></div><div className={styles.kanaGrid}>{rows.map((row,i)=><div className={styles.kanaRow} key={i}>{row.map((char,j)=>char?<div className={styles.kanaCell} key={char}><strong>{char}</strong>{romaji?<span>{kanaRomajiRows[i][j]}</span>:null}</div>:<div className={styles.kanaBlank} key={`blank-${i}-${j}`}/>)}</div>)}</div><div className={styles.kanaExtraHeader}><strong>Dakuten &amp; Handakuten</strong><span>Voiced and semi-voiced sounds</span></div><div className={styles.kanaGrid}>{voicedRows.map((row,i)=><div className={styles.kanaRow} key={`voiced-${i}`}>{row.map((char,j)=><div className={styles.kanaCell} key={char}><strong>{char}</strong>{romaji?<span>{voicedRomajiRows[i][j]}</span>:null}</div>)}</div>)}</div></div></>}</>;
}

const flashDeck = [
  { front:'学校', reading:'がっこう', romaji:'gakkou', back:'school', example:'学校へ行きます。', meaning:'I go to school.' },
  { front:'友達', reading:'ともだち', romaji:'tomodachi', back:'friend', example:'友達と話します。', meaning:'I talk with a friend.' },
  { front:'水', reading:'みず', romaji:'mizu', back:'water', example:'水を飲みます。', meaning:'I drink water.' },
  { front:'今日', reading:'きょう', romaji:'kyou', back:'today', example:'今日は休みです。', meaning:'Today is a day off.' },
  { front:'先生', reading:'せんせい', romaji:'sensei', back:'teacher', example:'先生に聞きます。', meaning:'I ask the teacher.' },
];
type DueFlashcard = {
  id: string; front_text: string; back_text: string; front_reading: string | null; back_reading: string | null;
  front_romaji: string | null; back_romaji: string | null; hint: string | null; example_sentence: string | null;
  example_translation: string | null; source_type: string;
};
function Flashcards({ items, signedIn, romaji, setRomaji }: { items: LearnerFlashcard[]; signedIn: boolean; romaji: boolean; setRomaji: (value: boolean) => void }) {
  const decks = useMemo(() => Array.from(new Map(items.map((item) => [item.deckId, { id: item.deckId, title: item.deckTitle, slug: item.deckSlug }])).values()), [items]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const deckId = selectedDeckId && decks.some((deck) => deck.id === selectedDeckId) ? selectedDeckId : (decks[0]?.id ?? '');
  const [sessionId, setSessionId] = useState('');
  const [queue, setQueue] = useState<DueFlashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [cardStartedAt, setCardStartedAt] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const card = queue[index];
  const preview = flashDeck[previewIndex % flashDeck.length];
  async function startSession() {
    if (!deckId || busy) return;
    setBusy(true); setNotice('');
    try {
      const sessionResponse = await fetch('/api/flashcards/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deckId, mode: 'mixed' }) });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(session.error || 'Could not start revision session.');
      const dueResponse = await fetch(`/api/flashcards/due?deckId=${encodeURIComponent(deckId)}&mode=mixed`, { credentials: 'same-origin', cache: 'no-store' });
      const due = await dueResponse.json();
      if (!dueResponse.ok) throw new Error(due.error || 'Could not load due flashcards.');
      const nextQueue = [...(due.due ?? []), ...(due.newCards ?? [])] as DueFlashcard[];
      setSessionId(session.sessionId); setQueue(nextQueue); setIndex(0); setFlipped(false); setCardStartedAt(Date.now());
      setNotice(nextQueue.length ? `${due.dueCount ?? 0} due · ${due.newCount ?? 0} new cards` : 'No cards are due. You are all caught up.');
      if (!nextQueue.length) await fetch('/api/flashcards/session', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.sessionId }) });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not start session.'); }
    finally { setBusy(false); }
  }
  async function rate(value: 'again'|'hard'|'good'|'easy') {
    if (!card || !sessionId || busy) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/flashcards/review', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flashcardId: card.id, sessionId, rating: value, responseTimeMs: Math.max(0, Date.now()-cardStartedAt) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save card review.');
      setStats((current) => ({ ...current, [value]: current[value] + 1 }));
      if (index + 1 >= queue.length) {
        await fetch('/api/flashcards/session', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
        setIndex(queue.length); setNotice(`Session complete · ${queue.length} cards reviewed. Next card scheduled ${new Date(body.dueAt).toLocaleString()}.`);
      } else { setIndex((value) => value + 1); setNotice(`Saved · next review ${new Date(body.dueAt).toLocaleString()}.`); }
      setFlipped(false); setCardStartedAt(Date.now());
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save review.'); }
    finally { setBusy(false); }
  }
  const reviewed = stats.again + stats.hard + stats.good + stats.easy;
  return <><SectionHeading eyebrow="SPACED REPETITION · FSRS-6" title="A few cards. A stronger memory." description="Each rating is saved and schedules the next review using your personal revision history." action={<button className={styles.ghostButton} onClick={()=>setRomaji(!romaji)}>{romaji?'Hide':'Show'} romaji</button>}/>
    <div className={styles.flashSummary}><div><strong>{signedIn ? Math.max(0,queue.length-index) : flashDeck.length}</strong><span>cards remaining</span></div><div><strong>{stats.good+stats.easy}</strong><span>remembered this session</span></div><div><strong>{stats.again+stats.hard}</strong><span>to revisit</span></div></div>
    {!signedIn ? <div className={styles.flashStage}><div className={styles.flashTopline}><span>PREVIEW FLASHCARD</span><span>{previewIndex+1} / {flashDeck.length}</span></div><button type="button" className={`${styles.flashCard} ${flipped?styles.flashCardFlip:''}`} onClick={()=>setFlipped(!flipped)}><span className={styles.flashCardLabel}>{flipped?'MEANING':'JAPANESE'}</span>{flipped?<><strong className={styles.flashMeaning}>{preview.back}</strong><span className={styles.flashExample}>{preview.example}</span><span className={styles.flashReading}>{preview.meaning}</span></>:<><strong className={styles.flashJapanese}>{preview.front}</strong><span className={styles.flashReading}>{preview.reading}</span>{romaji&&<small>{preview.romaji}</small>}</>}<span className={styles.flipHint}>↻ Tap to reveal</span></button><div className={styles.flashActions}><Link href="/login" className={styles.primaryButton}>Sign in to save revision <span>→</span></Link><button className={styles.secondaryButton} onClick={()=>{setPreviewIndex((v)=>v+1);setFlipped(false);}}>Next preview</button></div></div>
    : !items.length ? <EmptyState title="No published flashcards yet" description="Run the N5 content seed once in your local database to publish the vocabulary, kanji and grammar decks." />
    : <><div className={styles.toolbar}><span>{decks.length} published decks</span><select aria-label="Choose flashcard deck" value={deckId} onChange={(event)=>{setSelectedDeckId(event.target.value);setSessionId('');setQueue([]);setIndex(0);}}>{decks.map((deck)=><option key={deck.id} value={deck.id}>{deck.title}</option>)}</select><button className={styles.primaryButton} disabled={busy || !deckId} onClick={()=>void startSession()}>{busy?'Loading…':sessionId?'Start another session':'Start revision'} <span>→</span></button></div>
    {notice?<div className={styles.billingNote}>{notice}</div>:null}
    {card ? <div className={styles.flashStage}><div className={styles.flashTopline}><span>{decks.find((deck)=>deck.id===deckId)?.title || 'N5 DECK'}</span><span>{index+1} / {queue.length}</span></div><button type="button" className={`${styles.flashCard} ${flipped?styles.flashCardFlip:''}`} onClick={()=>setFlipped(!flipped)}><span className={styles.flashCardLabel}>{flipped?'MEANING':'JAPANESE'}</span>{flipped?<><strong className={styles.flashMeaning}>{card.back_text}</strong>{card.back_reading?<span className={styles.flashReading}>{card.back_reading}</span>:null}{card.example_sentence?<span className={styles.flashExample}>{card.example_sentence}</span>:null}{card.example_translation?<span className={styles.flashReading}>{card.example_translation}</span>:null}{card.hint?<small>{card.hint}</small>:null}{romaji&&card.back_romaji?<small>{card.back_romaji}</small>:null}</>:<><strong className={styles.flashJapanese}>{card.front_text}</strong>{card.front_reading?<span className={styles.flashReading}>{card.front_reading}</span>:null}{romaji&&card.front_romaji?<small>{card.front_romaji}</small>:null}</>}<span className={styles.flipHint}>↻ Tap to {flipped?'see Japanese':'reveal meaning'}</span></button>{flipped?<div className={styles.ratingRow}><span>How well did you know it?</span><div><button disabled={busy} onClick={()=>void rate('again')} className={styles.rateAgain}>Again</button><button disabled={busy} onClick={()=>void rate('hard')} className={styles.rateHard}>Hard</button><button disabled={busy} onClick={()=>void rate('good')} className={styles.rateGood}>Good</button><button disabled={busy} onClick={()=>void rate('easy')} className={styles.rateEasy}>Easy</button></div></div>:<div className={styles.flashActions}><button className={styles.primaryButton} onClick={()=>setFlipped(true)}>Reveal answer <span>↗</span></button></div>}</div> : sessionId ? <div className={styles.emptyState}><div>完</div><h2>Revision session complete</h2><p>{reviewed} cards reviewed. Your next due times have been saved.</p><button className={styles.primaryButton} onClick={()=>void startSession()}>Review another deck <span>→</span></button></div> : <div className={styles.emptyState}><div>復</div><h2>Ready when you are</h2><p>Start a session to load the cards due for review and your next new cards.</p></div>}</>}
  </>;
}

function Reading({ romaji, setRomaji, signedIn }: { romaji:boolean; setRomaji:(v:boolean)=>void; signedIn:boolean }) {
  const [passages,setPassages] = useState<ReadingPassage[]>([]);
  const [selected,setSelected] = useState(0);
  const [translation,setTranslation] = useState(false);
  const [showQuiz,setShowQuiz] = useState(false);
  useEffect(()=>{let alive=true;getReadingPassages().then((rows)=>{if(alive)setPassages(rows)});return()=>{alive=false}},[]);
  const p = passages[selected];
  if (showQuiz) return <><SectionHeading eyebrow="N5 READING CHECK" title="Test your comprehension." description="Your answers are submitted to the secure grading service." action={<button className={styles.ghostButton} onClick={()=>setShowQuiz(false)}>Back to passages</button>}/><QuizRunner kind="reading" signedIn={signedIn} romaji={romaji} setRomaji={setRomaji}/></>;
  return <><SectionHeading eyebrow="READING ROOM · JLPT N5" title="Read a little. Understand a lot." description="Graded passages with optional Romaji, English meaning and vocabulary notes." action={<button className={styles.ghostButton} onClick={()=>setRomaji(!romaji)}>{romaji?'Hide':'Show'} romaji</button>}/>
    {!p ? <EmptyState title="Reading library is being prepared" description="Run the local N5 content seed to add graded reading passages."/> : <div className={styles.readingLayout}><article className={styles.readingPanel}><div className={styles.readingTop}><span className={styles.readingLevel}>N5 READER · 3 MIN</span><span>Story {String(selected+1).padStart(2,'0')}</span></div><div className={styles.filterPills}>{passages.map((passage,index)=><button key={passage.title} className={selected===index?styles.filterActive:''} onClick={()=>{setSelected(index);setTranslation(false)}}>{passage.title}</button>)}</div><h2>{p.title}</h2><div className={styles.readingJapanese}>{p.text}</div>{romaji&&p.romaji?<div className={styles.readingRomaji}>{p.romaji}</div>:null}<button className={styles.translationToggle} onClick={()=>setTranslation((v)=>!v)}>{translation?'Hide translation':'Show English translation'} <span>⌄</span></button>{translation&&<div className={styles.translationBox}>{p.translation}</div>}<div className={styles.wordNotes}><div className={styles.eyebrow}>WORDS TO NOTICE</div>{(p.vocabulary??[]).map((word)=><div key={`${word.word}-${word.reading}`}><span>{word.word}</span><small>{word.reading} · {word.meaning}{romaji&&word.romaji?` · ${word.romaji}`:''}</small></div>)}</div><button type="button" className={styles.primaryButton} onClick={()=>setShowQuiz(true)}>Start graded comprehension <span>→</span></button></article><aside className={styles.comprehensionPanel}><div className={styles.eyebrow}>READING PRACTICE</div><div className={styles.questionNumber}>{passages.length} PASSAGES</div><h3>Read the passage carefully, then answer comprehension questions in a graded practice set.</h3><p>Answers are checked server-side, and your result is saved to your learning history.</p><button className={styles.primaryButton} onClick={()=>setShowQuiz(true)}>Start questions <span>→</span></button></aside></div>}
  </>;
}

function Exams({ signedIn, romaji, setRomaji }: { signedIn: boolean; romaji: boolean; setRomaji: (value: boolean) => void }) {
  return <QuizRunner kind="mock" signedIn={signedIn} romaji={romaji} setRomaji={setRomaji} />;
}


async function fetchMembershipData(signedIn: boolean): Promise<{
  plans: MembershipPlan[];
  status: MembershipStatus | null;
}> {
  const planResponse = await fetch('/api/billing/plans', { cache: 'no-store' });
  const planBody = await planResponse.json() as { plans?: MembershipPlan[]; error?: string };
  if (!planResponse.ok) throw new Error(planBody.error || 'Could not load plans.');

  let status: MembershipStatus | null = null;
  if (signedIn) {
    const statusResponse = await fetch('/api/billing/status', { credentials: 'same-origin', cache: 'no-store' });
    if (statusResponse.ok) status = await statusResponse.json() as MembershipStatus;
  }
  return { plans: planBody.plans ?? [], status };
}

function Membership({signedIn}:{signedIn:boolean}) {
  const router = useRouter();
  const [plans,setPlans]=useState<MembershipPlan[]>([]);
  const [status,setStatus]=useState<MembershipStatus | null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMembershipData(signedIn);
      setPlans(data.plans);
      setStatus(data.status);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load membership.');
    } finally {
      setLoading(false);
    }
  }, [signedIn]);
  useEffect(() => {
    let active = true;
    fetchMembershipData(signedIn)
      .then((data) => {
        if (!active) return;
        setPlans(data.plans);
        setStatus(data.status);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Could not load membership.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [signedIn]);
  async function checkout(planCode:string){
    if(!signedIn){router.push('/signup');return;}
    setBusy(true);setNotice('');
    try{
      const response=await fetch('/api/billing/checkout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode,idempotencyKey:crypto.randomUUID()})});
      const body=await response.json() as CheckoutResponse;if(!response.ok)throw new Error(body.error||'Checkout could not be started.');
      if(body.mode==='subscription' && body.checkoutUrl){window.location.assign(body.checkoutUrl);return;}
      if(body.mode!=='order' || !body.orderId || !body.keyId || typeof body.amountMinor !== 'number' || !body.currency)throw new Error('Razorpay Checkout details are incomplete. Check payment configuration.');
      if(!window.Razorpay){
        await new Promise<void>((resolve,reject)=>{const existing=document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Razorpay Checkout failed to load.')),{once:true});return;}const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.async=true;script.dataset.razorpayCheckout='true';script.onload=()=>resolve();script.onerror=()=>reject(new Error('Razorpay Checkout failed to load.'));document.body.appendChild(script);});
      }
      if(!window.Razorpay)throw new Error('Razorpay Checkout is unavailable.');
      const checkout=new window.Razorpay({key:body.keyId,amount:body.amountMinor,currency:body.currency,name:'Nihongo Labs',description:`${body.planName||'Premium membership'}`,order_id:body.orderId,theme:{color:'#b54c43'},handler:async(payment: RazorpayPaymentResult)=>{
        const verified=await fetch('/api/billing/verify',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:payment.razorpay_order_id,paymentId:payment.razorpay_payment_id,signature:payment.razorpay_signature})});
        const result=await verified.json();if(!verified.ok){setNotice(result.error||'Payment was received but verification is still pending.');setBusy(false);return;}
        router.push('/learn/subscription?payment=verified');
      }});
      checkout.on('payment.failed',(failure: RazorpayFailure)=>{setNotice(failure?.error?.description||'Payment failed. You can try again.');setBusy(false);});
      checkout.open();setBusy(false);
    }catch(error){setNotice(error instanceof Error?error.message:'Checkout could not be started.');setBusy(false);}
  }
  async function cancel(subscriptionId:string){
    setBusy(true);setNotice('');
    try{const response=await fetch('/api/billing/cancel',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscriptionId})});const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not cancel renewal.');setNotice('Automatic renewal is scheduled to stop at the end of the current billing period.');await refresh();}
    catch(error){setNotice(error instanceof Error?error.message:'Could not cancel subscription.');}finally{setBusy(false);}
  }
  return <><SectionHeading eyebrow="YOUR LEARNING, YOUR PACE" title="Choose how far you want to go." description="Start free and unlock more revision, reading and examination practice when you're ready." action={status?.hasPremium?<span className={styles.counterPill}>Premium active</span>:null}/>
    {notice?<div className={styles.billingNote}>{notice}</div>:null}
    {signedIn&&status?.subscriptions?.length?<div className={styles.panel}><div className={styles.eyebrow}>YOUR SUBSCRIPTION</div>{status.subscriptions.map((sub)=><div key={sub.id} className={styles.exampleCard}><strong>{sub.subscription_plans?.name||'Nihongo Labs plan'} · {sub.status}</strong><p>{sub.current_period_end?`Current period ends ${new Date(sub.current_period_end).toLocaleDateString()}`:'No fixed end date recorded.'}</p>{sub.cancel_at_period_end?<small>Renewal cancellation is scheduled.</small>:['active','trialing','past_due'].includes(sub.status)&&!String(sub.subscription_plans?.billing_interval).includes('lifetime')?<button className={styles.textButton} disabled={busy} onClick={()=>void cancel(sub.id)}>Cancel automatic renewal</button>:null}</div>)}</div>:null}
    {loading?<div className={styles.emptyState}><div>読</div><h2>Loading plans…</h2></div>:<div className={styles.planGrid}>{plans.map((plan) => {
      const price=Number(plan.amountMinor??0)/100;const featured=plan.code==='plus_monthly';const free=plan.planKind==='free';
      return <div className={`${styles.planCard} ${featured?styles.planFeatured:''}`} key={plan.id}>{featured?<div className={styles.popularBadge}>MOST POPULAR</div>:null}<div className={styles.eyebrow}>{free?'START HERE':plan.code==='basic_monthly'?'A LIGHTER STEP':'FOR CONSISTENT LEARNERS'}</div><h2>{plan.name}</h2><div className={styles.planPrice}>₹{price.toLocaleString('en-IN')} <small>{free?'/ forever':`/ ${plan.billingInterval}`}</small></div><p>{plan.description}</p><ul>{(plan.features??[]).map((feature)=><li key={feature.key}>✓ {feature.key.replaceAll('_',' ')}</li>)}</ul>{free?<Link href={signedIn?'/learn':'/signup'} className={styles.secondaryButton}>{signedIn?'Your free workspace':'Create free account'}</Link>:<button className={featured?styles.primaryButton:styles.secondaryButton} disabled={busy} onClick={()=>void checkout(plan.code)}>{busy?'Starting checkout…':signedIn?'Choose plan':'Sign up to subscribe'} <span>→</span></button>}{!free?<small className={styles.planFoot}>Secure checkout opens on Razorpay.</small>:null}</div>;
    })}</div>}
    <div className={styles.billingNote}>Payments are activated only after the Razorpay webhook verifies the provider event and records an entitlement. A plan must have its Razorpay Plan ID configured before recurring checkout can start.</div>
  </>;
}


export function LearningFeature(props: LearningFeatureProps) {
  switch (props.active) {
    case 'grammar': return <GrammarStudio items={props.grammarItems} romaji={props.romaji} setRomaji={props.setRomaji} signedIn={props.signedIn} />;
    case 'practice': return <Practice signedIn={props.signedIn} romaji={props.romaji} setRomaji={props.setRomaji} />;
    case 'vocabulary': return <Vocabulary items={props.vocabularyItems} romaji={props.romaji} setRomaji={props.setRomaji} signedIn={props.signedIn} search={props.search} onProgressSaved={props.onProgressSaved} />;
    case 'kanji': return <Kanji items={props.kanjiItems} onProgressSaved={props.onProgressSaved} />;
    case 'kana': return <Kana mode={props.kanaMode} setMode={props.setKanaMode} quiz={props.kanaQuiz} setQuiz={props.setKanaQuiz} signedIn={props.signedIn} romaji={props.romaji} setRomaji={props.setRomaji} />;
    case 'flashcards': return <Flashcards items={props.flashcardItems} signedIn={props.signedIn} romaji={props.romaji} setRomaji={props.setRomaji} />;
    case 'reading': return <Reading romaji={props.romaji} setRomaji={props.setRomaji} signedIn={props.signedIn} />;
    case 'exams': return <Exams signedIn={props.signedIn} romaji={props.romaji} setRomaji={props.setRomaji} />;
    case 'subscription': return <Membership signedIn={props.signedIn} />;
    default: return null;
  }
}
