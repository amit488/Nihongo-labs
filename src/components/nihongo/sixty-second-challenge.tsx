'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './sixty-second-challenge.module.css';

type RevisionQuestion = {
  contentType: 'vocabulary' | 'kanji' | 'grammar';
  contentId: string;
  level: string;
  question: string;
  prompt: string;
  options: string[];
};

type RevisionAnswer = {
  isCorrect: boolean;
  didNotRemember: boolean;
  correctAnswer: string;
  explanation: string;
};

const CHALLENGE_MS = 60_000;
const AUTO_MIN_MS = 7 * 60_000;
const AUTO_RANGE_MS = 6 * 60_000;

function nextAutoDelay() {
  return AUTO_MIN_MS + Math.floor(Math.random() * AUTO_RANGE_MS);
}

export function SixtySecondChallenge({ signedIn, disabled = false }: { signedIn: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<RevisionQuestion | null>(null);
  const [selected, setSelected] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<RevisionAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deadlineRef = useRef(0);
  const targetAutoRef = useRef(nextAutoDelay());
  const activeTimeRef = useRef(0);
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const startChallengeRef = useRef<() => void>(() => undefined);
  const finishChallengeRef = useRef<() => void>(() => undefined);

  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!signedIn || disabled) return;
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(1500, Math.max(0, now - last));
      last = now;
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      if (openRef.current) {
        const remaining = Math.max(0, deadlineRef.current - Date.now());
        setSecondsLeft(Math.ceil(remaining / 1000));
        if (remaining <= 0) finishChallengeRef.current();
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      activeTimeRef.current += elapsed;
      if (activeTimeRef.current >= targetAutoRef.current) {
        activeTimeRef.current = 0;
        targetAutoRef.current = nextAutoDelay();
        startChallengeRef.current();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [signedIn, disabled]);

  const loadQuestion = useCallback(async () => {
    const response = await fetch('/api/learning/quick-revision?view=question', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({})) as {
      available?: boolean;
      question?: RevisionQuestion;
      reason?: string;
      error?: string;
    };
    if (!response.ok) throw new Error(body.error || 'Could not load a challenge question.');
    if (!body.available || !body.question) {
      throw new Error(body.reason === 'no-learned-items'
        ? 'Mark vocabulary as learned, kanji as known or grammar as understood to unlock questions.'
        : 'There are not enough published answer choices for your learned items yet.');
    }
    setQuestion(body.question);
    setSelected('');
    setFeedback(null);
  }, []);

  const startChallenge = useCallback(async () => {
    if (!signedIn || disabled || busyRef.current || openRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    setAnswered(0);
    setCorrect(0);
    setSecondsLeft(60);
    deadlineRef.current = Date.now() + CHALLENGE_MS;
    try {
      await loadQuestion();
      setOpen(true);
      openRef.current = true;
      activeTimeRef.current = 0;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The challenge is unavailable right now.');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [signedIn, disabled, loadQuestion]);

  async function submitAnswer() {
    if (!question || !selected || busyRef.current || Date.now() >= deadlineRef.current) return;
    busyRef.current = true;
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
          selectedOption: selected,
          didNotRemember: false,
          responseTimeMs: 0,
        }),
      });
      const body = await response.json().catch(() => ({})) as RevisionAnswer & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Your answer could not be saved.');
      setAnswered((value) => value + 1);
      setCorrect((value) => value + (body.isCorrect ? 1 : 0));
      setFeedback(body);
      window.dispatchEvent(new Event('nihongo:quick-revision-updated'));
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      if (Date.now() < deadlineRef.current) await loadQuestion();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your answer could not be saved.');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  const finishChallenge = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    setQuestion(null);
    setSelected('');
    setFeedback(null);
    activeTimeRef.current = 0;
    targetAutoRef.current = nextAutoDelay();
  }, []);

  startChallengeRef.current = () => { void startChallenge(); };
  finishChallengeRef.current = finishChallenge;

  if (!signedIn || disabled) return null;

  return (
    <>
      <button type="button" className={styles.launcher} onClick={() => void startChallenge()} disabled={loading || open}>
        <span aria-hidden="true">◷</span> 60-second challenge
      </button>
      {error && !open ? <p className={styles.toast} role="status">{error}</p> : null}
      {open ? (
        <div className={styles.backdrop}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sixty-title">
            <header className={styles.header}>
              <div><span className={styles.eyebrow}>NIHONGO LABS · QUICK REVISION</span><h2 id="sixty-title">60-second challenge</h2></div>
              <div className={styles.timer} aria-live="off">{secondsLeft}<small>SEC</small></div>
            </header>
            <div className={styles.progressTrack}><span style={{ width: `${(secondsLeft / 60) * 100}%` }} /></div>
            <div className={styles.scoreRow}><span>{question?.level} · {question?.contentType}</span><strong>{correct} correct <i>·</i> {answered} answered</strong></div>
            {question ? (
              <>
                <h3>{question.question}</h3>
                <div className={styles.prompt}>{question.prompt}</div>
                <div className={styles.options}>
                  {question.options.map((option, index) => (
                    <button type="button" key={`${option}-${index}`} onClick={() => setSelected(option)}
                      className={selected === option ? styles.selected : ''} disabled={loading}>
                      <span>{String.fromCharCode(65 + index)}</span>{option}
                    </button>
                  ))}
                </div>
                {feedback ? <p className={feedback.isCorrect ? styles.correct : styles.incorrect} role="status">
                  {feedback.isCorrect ? 'Correct!' : `Answer: ${feedback.correctAnswer}`}
                </p> : null}
                {error ? <p className={styles.error} role="alert">{error}</p> : null}
                <footer className={styles.actions}>
                  <span>Keep going — every second counts.</span>
                  <button type="button" onClick={() => void submitAnswer()} disabled={!selected || loading}>
                    {loading ? 'Checking…' : 'Answer →'}
                  </button>
                </footer>
              </>
            ) : null}
            <button type="button" className={styles.endButton} onClick={finishChallenge}>End challenge</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
