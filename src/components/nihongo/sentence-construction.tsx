'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './learning-app.module.css';
import { JlptLevelSwitch, SectionHeading, type JlptLevel } from './learning-shared';
import { getSentenceConstructionItems } from '@/lib/nihongo/sentence-construction-bank';
import { findFirstUnsolvedSentenceIndex, findNextUnsolvedSentenceIndex } from '@/lib/nihongo/sentence-construction-progress';

type SentenceStats = {
  totalSentences: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  attemptedSentences: number;
  solvedSentences: number;
  solvedSentenceIds: string[];
  migrationRequired?: boolean;
};

type Feedback = { correct: boolean; canonical: string; tip: string };
const emptyStats: SentenceStats = {
  totalSentences: 80, totalAttempts: 0, correctAttempts: 0, accuracy: 0,
  attemptedSentences: 0, solvedSentences: 0, solvedSentenceIds: [],
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatTag(tag: string) {
  const labels: Record<string, string> = {
    'particle:wa': 'は · topic',
    'particle:wo': 'を · object',
    'particle:ni-vs-de': 'に / で · place',
    'particle:wa-vs-ga': 'は / が',
    'verb:te-form': 'て-form',
    'verb:past': 'Past tense',
    'verb:negative': 'Negative form',
    'grammar:existence': 'あります / います',
    'grammar:conditional': 'Conditionals',
    'grammar:purpose': 'Purpose',
    'grammar:reason': 'Giving reasons',
    'grammar:comparison': 'Comparison',
    'grammar:passive': 'Passive voice',
    'grammar:causative': 'Causative form',
    'grammar:potential': 'Potential form',
    'grammar:experience': 'Past experience',
    'grammar:obligation': 'Obligation',
    'grammar:request': 'Requests',
  };
  return labels[tag] || tag.replace(/^(grammar|particle|verb|adjective):/, '').replaceAll('-', ' ');
}

export default function SentenceConstruction({ signedIn, romaji, preferredLevel, onPreferredLevelChange, onProgressSaved }: {
  signedIn: boolean;
  romaji: boolean;
  preferredLevel: JlptLevel;
  onPreferredLevelChange: (level: JlptLevel) => Promise<void>;
  onProgressSaved: () => Promise<void>;
}) {
  const [level, setLevel] = useState<JlptLevel>(preferredLevel);
  const items = useMemo(() => getSentenceConstructionItems(level), [level]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showMeaning, setShowMeaning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [stats, setStats] = useState<SentenceStats>(emptyStats);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const current = items[index] ?? null;
  const allSolved = signedIn && progressLoaded && items.length > 0 && stats.solvedSentenceIds.length >= items.length;

  const tileOrder = useMemo(() => {
    if (!current) return [];
    return current.tokens.map((_, tokenIndex) => tokenIndex)
      .sort((a, b) => stableHash(current.id + ':' + a) - stableHash(current.id + ':' + b));
  }, [current]);

  useEffect(() => {
    let active = true;
    if (!signedIn) {
      setStats(emptyStats);
      setIndex(0);
      setProgressLoaded(true);
      return () => { active = false; };
    }

    setProgressLoaded(false);
    setNotice('');
    fetch('/api/learning/sentence-construction?level=' + level, {
      credentials: 'same-origin', cache: 'no-store',
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load sentence progress.');
      return body as SentenceStats;
    }).then((body) => {
      if (!active) return;
      const solvedSentenceIds = body.solvedSentenceIds ?? [];
      setStats({ ...emptyStats, ...body, solvedSentenceIds });
      const firstUnsolvedIndex = findFirstUnsolvedSentenceIndex(items, solvedSentenceIds);
      setIndex(firstUnsolvedIndex ?? items.length);
      setStartedAt(Date.now());
      setProgressLoaded(true);
      if (body.migrationRequired) setNotice('Apply the new sentence construction migration to save attempts and enable progress tracking.');
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? error.message : 'Sentence progress is temporarily unavailable.');
    });
    return () => { active = false; };
  }, [items, level, signedIn]);

  function changeLevel(next: JlptLevel) {
    if (next === level) return;
    setLevel(next);
    void onPreferredLevelChange(next);
    setStats(emptyStats);
    setProgressLoaded(false);
    setStartedAt(Date.now());
    setIndex(0);
    setSelected([]);
    setFeedback(null);
    setShowMeaning(false);
    setShowHint(false);
    setNotice('');
    setSessionCorrect(0);
  }

  function addToken(tokenIndex: number) {
    if (feedback || selected.includes(tokenIndex)) return;
    setSelected((value) => [...value, tokenIndex]);
  }

  function removeToken(position: number) {
    if (feedback) return;
    setSelected((value) => value.filter((_, selectedIndex) => selectedIndex !== position));
  }

  async function checkSentence() {
    if (!current || feedback || selected.length !== current.tokens.length || saving) return;
    const submittedTokens = selected.map((tokenIndex) => current.tokens[tokenIndex]);
    const localCorrect = submittedTokens.join('') === current.tokens.join('');
    setNotice('');

    if (!signedIn) {
      setFeedback({ correct: localCorrect, canonical: current.sentence, tip: current.tip });
      setSessionCorrect((value) => value + (localCorrect ? 1 : 0));
      setNotice('Sign in to save this attempt to My progress and Learning Intelligence.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/learning/sentence-construction', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentenceId: current.id,
          level,
          submittedTokens,
          timeTakenMs: Math.max(0, Date.now() - startedAt),
        }),
      });
      const body = await response.json() as { correct?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || 'Your attempt could not be saved.');

      const isCorrect = Boolean(body.correct);
      setFeedback({ correct: isCorrect, canonical: current.sentence, tip: current.tip });
      setSessionCorrect((value) => value + (isCorrect ? 1 : 0));
      if (isCorrect) {
        setStats((previous) => {
          const solvedSentenceIds = Array.from(new Set([...previous.solvedSentenceIds, current.id]));
          return { ...previous, solvedSentenceIds, solvedSentences: solvedSentenceIds.length };
        });
      }

      const statsResponse = await fetch('/api/learning/sentence-construction?level=' + level, {
        credentials: 'same-origin', cache: 'no-store',
      });
      if (statsResponse.ok) {
        const refreshedStats = await statsResponse.json() as SentenceStats;
        setStats((previous) => {
          const solvedSentenceIds = Array.from(new Set([
            ...previous.solvedSentenceIds,
            ...(refreshedStats.solvedSentenceIds ?? []),
          ]));
          return {
            ...refreshedStats,
            solvedSentenceIds,
            solvedSentences: Math.max(refreshedStats.solvedSentences, solvedSentenceIds.length),
          };
        });
      }
      await onProgressSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your attempt could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function nextSentence() {
    if (!current) return;
    const nextIndex = findNextUnsolvedSentenceIndex(items, stats.solvedSentenceIds, index);
    setIndex(nextIndex ?? items.length);
    setStartedAt(Date.now());
    setSelected([]);
    setFeedback(null);
    setShowMeaning(false);
    setShowHint(false);
    setNotice('');
  }

  const heading = <SectionHeading
    eyebrow={`SENTENCE PRACTICE · JLPT ${level}`}
    title="Build a natural sentence."
    description="Arrange the tiles, check your answer and learn from the grammar."
    action={<div className={styles.headingActions}><JlptLevelSwitch value={level} onChange={changeLevel} label="Sentence construction JLPT level" /></div>}
  />;

  if (signedIn && !progressLoaded) {
    return <div className={styles.sentenceWorkspace}>
      {heading}
      <section className={styles.sentenceCard}>
        <p className={styles.sentenceNotice} role="status">{notice || 'Restoring your saved sentence progress…'}</p>
      </section>
    </div>;
  }

  if (allSolved) {
    return <div className={styles.sentenceWorkspace}>
      {heading}
      <section className={styles.sentenceCard}>
        <div className={styles.sentenceQuickStats}>
          <span><strong>{stats.solvedSentences}</strong> / {items.length} solved</span>
          <span><strong>{stats.accuracy}%</strong> accuracy</span>
          <span><strong>{stats.totalAttempts}</strong> attempts</span>
        </div>
        <div className={styles.sentenceFeedbackCorrect} role="status">
          <strong>Excellent work — all {items.length} {level} sentences are solved.</strong>
          <p>Choose the other JLPT level to continue practising. Your completed sentences will stay completed.</p>
        </div>
      </section>
    </div>;
  }

  if (!current) return null;
  const visibleStats = signedIn ? stats : emptyStats;
  const built = selected.map((tokenIndex) => current.tokens[tokenIndex]);

  return <div className={styles.sentenceWorkspace}>
    {heading}

    <section className={styles.sentenceCard}>
      <div className={styles.sentenceCardMeta}>
        <div className={styles.sentenceQuickStats}>
          <span><strong>{visibleStats.solvedSentences}</strong> / {items.length} solved</span>
          <span><strong>{visibleStats.accuracy}%</strong> accuracy</span>
          <span title="Every submitted answer counts as one attempt, including incorrect retries. A sentence is solved once after a correct answer."><strong>{visibleStats.totalAttempts}</strong> attempts</span>
        </div>
        <div className={styles.sentenceCompactTrack} role="progressbar" aria-label={`${level} sentence set progress`} aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={visibleStats.solvedSentences}>
          <span style={{ width: `${Math.min(100, visibleStats.solvedSentences / Math.max(1, items.length) * 100)}%` }} />
        </div>
      </div>
      <div className={styles.sentenceQuestionTop}>
        <div><span className={styles.sentenceEyebrow}>CHALLENGE {String(index + 1).padStart(2, '0')} / {items.length}</span><h3>Arrange the words in the correct order</h3></div>
        <span className={styles.sentenceLevelPill}>{level} · MIXED GRAMMAR</span>
      </div>

      <div className={styles.sentencePrompt}>
        <span>Translate into Japanese</span>
        <strong>{current.meaning}</strong>
        {showMeaning ? <small>{current.sentence}</small> : null}
      </div>

      <div className={styles.sentenceAnswerLabel}>YOUR SENTENCE</div>
      <div className={styles.sentenceAnswer} aria-live="polite">
        {built.length ? built.map((token, position) => (
          <button type="button" key={`${position}-${selected[position]}`} className={styles.sentenceAnswerTile}
            onClick={() => removeToken(position)} disabled={Boolean(feedback) || saving} aria-label={`Remove ${token}`}>{token}<span>×</span></button>
        )) : <span className={styles.sentencePlaceholder}>Tap the tiles below to build your answer…</span>}
      </div>

      <div className={styles.sentenceTilesLabel}><span>WORD BANK</span><small>{selected.length} / {current.tokens.length} placed</small></div>
      <div className={styles.sentenceTiles}>
        {tileOrder.map((tokenIndex) => {
          const used = selected.includes(tokenIndex);
          return <button type="button" key={tokenIndex} className={styles.sentenceTile}
            onClick={() => addToken(tokenIndex)} disabled={used || Boolean(feedback) || saving} aria-pressed={used}>{used ? <span className={styles.sentenceTileUsed}>{current.tokens[tokenIndex]}</span> : current.tokens[tokenIndex]}</button>;
        })}
      </div>

      <div className={styles.sentenceUtilityRow}>
        <button type="button" className={styles.textButton} onClick={() => { setSelected([]); setFeedback(null); setNotice(''); }} disabled={Boolean(feedback) || saving}>Reset tiles</button>
        <div>
          <button type="button" className={styles.ghostButton} onClick={() => setShowHint((value) => !value)}>{showHint ? 'Hide grammar hint' : 'Grammar hint'}</button>
          <button type="button" className={styles.ghostButton} onClick={() => setShowMeaning((value) => !value)}>{showMeaning ? 'Hide answer' : 'Reveal answer'}</button>
        </div>
      </div>
      {showHint ? <div className={styles.sentenceHint}><strong>Grammar focus</strong><p>{current.grammarTags.map(formatTag).join(' · ')}</p><small>{current.tip}</small></div> : null}

      {feedback ? <div className={feedback.correct ? styles.sentenceFeedbackCorrect : styles.sentenceFeedbackWrong} role="status">
        <strong>{feedback.correct ? 'Excellent! Sentence correct.' : 'Not quite. Let’s learn from it.'}</strong>
        <p>{feedback.canonical}</p>
        {romaji ? <small>{current.romaji}</small> : null}
        <span>{feedback.tip}</span>
      </div> : null}

      {notice ? <p className={styles.sentenceNotice} role="status">{notice}</p> : null}

      <div className={styles.sentenceFooter}>
        <span>{saving ? 'Saving attempt…' : feedback ? 'Review the grammar, then continue.' : 'Build the complete sentence to check your answer.'}</span>
        {feedback
          ? <button type="button" className={styles.primaryButton} onClick={nextSentence}>Next sentence <span>→</span></button>
          : <button type="button" className={styles.primaryButton} onClick={() => void checkSentence()} disabled={selected.length !== current.tokens.length || saving}>Check sentence <span>→</span></button>}
      </div>
    </section>

    <div className={styles.sentenceSessionNote}>
      <strong>{sessionCorrect} correct this session</strong>
      <span>{signedIn ? 'Every check counts as an attempt, including retries. A sentence is marked solved once after a correct answer.' : 'Sign in to save attempts to My progress and Learning Intelligence.'}</span>
    </div>
  </div>;
}
