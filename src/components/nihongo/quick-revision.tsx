'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './quick-revision.module.css';

type ContentType = 'vocabulary' | 'kanji' | 'grammar';
type QuickQuestion = {
  contentType: ContentType;
  contentId: string;
  level: string;
  question: string;
  prompt: string;
  options: string[];
};
type QuickResult = {
  isCorrect: boolean;
  didNotRemember: boolean;
  correctAnswer: string;
  explanation: string;
};
type RevisionStats = {
  totalAttempts: number;
  itemsTested: number;
  correctAttempts: number;
  accuracy: number;
  needsWorkCount: number;
  needsWork: Array<{ contentType: ContentType; label: string; detail: string; level: string }>;
  byType: Record<ContentType, { items: number; attempts: number; correct: number }>;
};

const INTERACTION_IDLE_MS = 60_000;
const FIRST_QUESTION_MS = 5 * 60_000;
const RETRY_WHEN_EMPTY_MS = 60_000;
const NEXT_QUESTION_MIN_MS = 8 * 60_000;
const NEXT_QUESTION_RANGE_MS = 4 * 60_000;

export function QuickRevision({ signedIn, disabled = false }: { signedIn: boolean; disabled?: boolean }) {
  const [question, setQuestion] = useState<QuickQuestion | null>(null);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const questionStartedAt = useRef(0);
  const responsePending = useRef(false);
  const dialogOpen = useRef(false);
  const activeMilliseconds = useRef(0);
  const targetMilliseconds = useRef(FIRST_QUESTION_MS);

  useEffect(() => {
    dialogOpen.current = Boolean(question);
  }, [question]);

  useEffect(() => {
    if (!question) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [question]);

  useEffect(() => {
    if (!signedIn || disabled) return;

    let disposed = false;
    let lastSampleAt = performance.now();
    let lastInteractionAt = performance.now();
    let requestInProgress = false;

    const activeAndAvailable = (now: number) =>
      document.visibilityState === 'visible' &&
      document.hasFocus() &&
      now - lastInteractionAt <= INTERACTION_IDLE_MS;

    const recordInteraction = () => {
      lastInteractionAt = performance.now();
    };

    const loadQuestion = async () => {
      if (requestInProgress || responsePending.current || dialogOpen.current || disposed) return;
      requestInProgress = true;
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/learning/quick-revision?view=question', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({})) as {
          available?: boolean;
          question?: QuickQuestion;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || 'Quick Revision could not load a question.');
        if (disposed) return;
        if (!body.available || !body.question) {
          // No learned items yet, or not enough distractors to form a fair MCQ.
          // Retry after another minute of active use without showing an empty popup.
          targetMilliseconds.current = activeMilliseconds.current + RETRY_WHEN_EMPTY_MS;
          return;
        }
        setQuestion(body.question);
        setSelected('');
        setResult(null);
        questionStartedAt.current = performance.now();
        activeMilliseconds.current = 0;
      } catch (requestError) {
        if (!disposed) {
          setError(requestError instanceof Error ? requestError.message : 'Quick Revision is temporarily unavailable.');
          targetMilliseconds.current = activeMilliseconds.current + RETRY_WHEN_EMPTY_MS;
        }
      } finally {
        if (!disposed) setLoading(false);
        requestInProgress = false;
      }
    };

    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(1_500, Math.max(0, now - lastSampleAt));
      lastSampleAt = now;

      if (!activeAndAvailable(now) || dialogOpen.current || responsePending.current || loading) return;
      activeMilliseconds.current += elapsed;

      if (activeMilliseconds.current >= targetMilliseconds.current) {
        void loadQuestion();
      }
    }, 1_000);

    document.addEventListener('pointerdown', recordInteraction, { passive: true });
    document.addEventListener('keydown', recordInteraction);
    document.addEventListener('scroll', recordInteraction, { passive: true });
    document.addEventListener('touchstart', recordInteraction, { passive: true });
    document.addEventListener('visibilitychange', recordInteraction);
    window.addEventListener('focus', recordInteraction);
    window.addEventListener('blur', recordInteraction);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('pointerdown', recordInteraction);
      document.removeEventListener('keydown', recordInteraction);
      document.removeEventListener('scroll', recordInteraction);
      document.removeEventListener('touchstart', recordInteraction);
      document.removeEventListener('visibilitychange', recordInteraction);
      window.removeEventListener('focus', recordInteraction);
      window.removeEventListener('blur', recordInteraction);
    };
  }, [signedIn, disabled, loading]);

  async function submitAnswer(didNotRemember: boolean) {
    if (!question || responsePending.current || result) return;
    responsePending.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/learning/quick-revision', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: question.contentType,
          contentId: question.contentId,
          selectedOption: didNotRemember ? null : selected,
          didNotRemember,
          responseTimeMs: Math.max(0, Math.floor(performance.now() - questionStartedAt.current)),
        }),
      });
      const body = await response.json().catch(() => ({})) as QuickResult & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Your answer could not be saved. Please try again.');
      setResult(body);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your answer could not be saved. Please try again.');
    } finally {
      responsePending.current = false;
      setLoading(false);
    }
  }

  function continueLearning() {
    setQuestion(null);
    setSelected('');
    setResult(null);
    setError('');
    targetMilliseconds.current = NEXT_QUESTION_MIN_MS + Math.floor(Math.random() * NEXT_QUESTION_RANGE_MS);
    activeMilliseconds.current = 0;
  }

  if (!signedIn || !question) return null;

  const resultTone = result ? (result.isCorrect && !result.didNotRemember ? 'correct' : 'incorrect') : '';

  return (
    <div className={styles.backdrop}>
      <section
        className={`${styles.dialog} ${resultTone ? styles[resultTone] : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-revision-title"
        aria-describedby="quick-revision-prompt"
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.preventDefault();
        }}
      >
        <div className={styles.dialogHeader}>
          <div>
            <div className={styles.eyebrow}>QUICK REVISION</div>
            <div className={styles.meta}>{question.level} · {question.contentType}</div>
          </div>
          <span className={styles.brandMark}>日</span>
        </div>

        {!result ? (
          <>
            <h2 id="quick-revision-title">{question.question}</h2>
            <div id="quick-revision-prompt" className={styles.prompt}>{question.prompt}</div>
            <div className={styles.options} role="group" aria-label="Answer options">
              {question.options.map((option, index) => (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  className={`${styles.option} ${selected === option ? styles.optionSelected : ''}`}
                  aria-pressed={selected === option}
                  disabled={loading}
                  onClick={() => setSelected(option)}
                >
                  <span className={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.forgotButton} disabled={loading} onClick={() => void submitAnswer(true)}>
                I don’t remember
              </button>
              <button type="button" className={styles.checkButton} disabled={!selected || loading} onClick={() => void submitAnswer(false)}>
                {loading ? 'Checking…' : 'Check answer'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.resultIcon}>{result.isCorrect ? '✓' : '!'}</div>
            <h2 id="quick-revision-title">{result.isCorrect ? 'Correct! Well remembered.' : result.didNotRemember ? 'That’s okay. Let’s reinforce it.' : 'Not quite. Let’s review it.'}</h2>
            <div id="quick-revision-prompt" className={styles.answerReveal}>
              <span>Correct answer</span>
              <strong>{result.correctAnswer}</strong>
              <p>{result.explanation}</p>
            </div>
            <p className={styles.resultMessage}>
              {result.isCorrect
                ? 'This item will return later, with a longer interval after consistent correct recall.'
                : 'We’ll bring this item back sooner so you can strengthen your memory.'}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.continueButton} onClick={continueLearning}>Continue learning</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function QuickRevisionStats({ signedIn }: { signedIn: boolean }) {
  const [stats, setStats] = useState<RevisionStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      setStats(null);
      return;
    }
    let active = true;
    setLoading(true);
    fetch('/api/learning/quick-revision?view=stats', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as RevisionStats & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load revision statistics.');
        return body;
      })
      .then((body) => { if (active) setStats(body); })
      .catch(() => { if (active) setStats(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signedIn]);

  return (
    <section className={styles.statsSection}>
      <div className={styles.statsHeading}>
        <div>
          <div className={styles.eyebrow}>ACTIVE RECALL</div>
          <h2>Quick Revision statistics</h2>
          <p>See what you remember and which learned items need another look.</p>
        </div>
      </div>
      {!signedIn ? (
        <div className={styles.statsEmpty}>Sign in to see your Quick Revision history.</div>
      ) : loading && !stats ? (
        <div className={styles.statsEmpty}>Loading your revision statistics…</div>
      ) : !stats || stats.totalAttempts === 0 ? (
        <div className={styles.statsEmpty}>Your revision statistics will appear here after your first Quick Revision question.</div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <span>Items tested</span>
              <strong>{stats.itemsTested}</strong>
              <small>Learned items recalled at least once</small>
            </article>
            <article className={styles.statCard}>
              <span>Accuracy</span>
              <strong>{stats.accuracy}%</strong>
              <small>{stats.correctAttempts} correct out of {stats.totalAttempts} attempts</small>
            </article>
            <article className={styles.statCard}>
              <span>To revisit</span>
              <strong>{stats.needsWorkCount}</strong>
              <small>Items with more incorrect than correct recalls, or a recent miss</small>
            </article>
          </div>
          <div className={styles.typeSummary}>
            {(['vocabulary', 'kanji', 'grammar'] as ContentType[]).map((type) => (
              <div key={type}>
                <span>{type}</span>
                <strong>{stats.byType[type].items} tested</strong>
                <small>{stats.byType[type].attempts} attempts</small>
              </div>
            ))}
          </div>
          {stats.needsWork.length ? (
            <div className={styles.needsWork}>
              <h3>Needs another look</h3>
              <div className={styles.needsWorkList}>
                {stats.needsWork.map((item, index) => (
                  <div className={styles.needsWorkItem} key={`${item.contentType}-${item.label}-${index}`}>
                    <span className={styles.needsWorkType}>{item.contentType} · {item.level}</span>
                    <strong>{item.label}</strong>
                    {item.detail && item.detail !== item.label ? <small>{item.detail}</small> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.statsEmpty}>No weak spots at the moment. Keep going!</div>
          )}
        </>
      )}
    </section>
  );
}
