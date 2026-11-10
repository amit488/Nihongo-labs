'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './learning-app.module.css';
import { JlptLevelSwitch, SectionHeading, type JlptLevel } from './learning-shared';
import { getSentenceConstructionItems } from '@/lib/nihongo/sentence-construction-bank';

type SentenceStats = {
  totalSentences: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  attemptedSentences: number;
  solvedSentences: number;
};

type Feedback = { correct: boolean; canonical: string; tip: string };
const emptyStats: SentenceStats = {
  totalSentences: 80, totalAttempts: 0, correctAttempts: 0, accuracy: 0,
  attemptedSentences: 0, solvedSentences: 0,
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

export default function SentenceConstruction({ signedIn, romaji, onProgressSaved }: {
  signedIn: boolean;
  romaji: boolean;
  onProgressSaved: () => Promise<void>;
}) {
  const [level, setLevel] = useState<JlptLevel>('N5');
  const items = useMemo(() => getSentenceConstructionItems(level), [level]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showMeaning, setShowMeaning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [stats, setStats] = useState<SentenceStats>(emptyStats);
  const [startedAt, setStartedAt] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const current = items[index] ?? items[0];

  const tileOrder = useMemo(() => {
    if (!current) return [];
    return current.tokens.map((_, tokenIndex) => tokenIndex)
      .sort((a, b) => stableHash(current.id + ':' + a) - stableHash(current.id + ':' + b));
  }, [current]);

  useEffect(() => {
    let active = true;
    setStats(emptyStats);
    if (!signedIn) return () => { active = false; };
    fetch('/api/learning/sentence-construction?level=' + level, {
      credentials: 'same-origin', cache: 'no-store',
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load sentence progress.');
      return body as SentenceStats;
    }).then((body) => {
      if (active) setStats(body);
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? error.message : 'Sentence progress is temporarily unavailable.');
    });
    return () => { active = false; };
  }, [level, signedIn]);

  useEffect(() => {
    setStartedAt(Date.now());
  }, [current?.id]);

  function changeLevel(next: JlptLevel) {
    if (next === level) return;
    setLevel(next);
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
    setFeedback({ correct: localCorrect, canonical: current.sentence, tip: current.tip });
    setSessionCorrect((value) => value + (localCorrect ? 1 : 0));
    setNotice('');

    if (!signedIn) {
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
      setFeedback({ correct: Boolean(body.correct), canonical: current.sentence, tip: current.tip });
      const statsResponse = await fetch('/api/learning/sentence-construction?level=' + level, {
        credentials: 'same-origin', cache: 'no-store',
      });
      if (statsResponse.ok) setStats(await statsResponse.json() as SentenceStats);
      await onProgressSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your attempt could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function nextSentence() {
    if (!current) return;
    setIndex((value) => (value + 1) % items.length);
    setSelected([]);
    setFeedback(null);
    setShowMeaning(false);
    setShowHint(false);
    setNotice('');
    setStartedAt(Date.now());
  }

  if (!current) return null;
  const built = selected.map((tokenIndex) => current.tokens[tokenIndex]);

  return <div className={styles.sentenceWorkspace}>
    <SectionHeading
      eyebrow={`ACTIVE PRACTICE · JLPT ${level}`}
      title="Build the sentence."
      description="Turn the grammar you know into Japanese you can actually use. Arrange every tile, then check your sentence."
      action={<div className={styles.headingActions}><JlptLevelSwitch value={level} onChange={changeLevel} label="Sentence construction JLPT level" /></div>}
    />

    <section className={styles.sentenceHero}>
      <div className={styles.sentenceHeroTop}>
        <div><span className={styles.sentenceEyebrow}>SENTENCE CONSTRUCTION LAB</span><h2>Think in Japanese, one tile at a time.</h2><p>160 curated challenges · mixed grammar · instant feedback</p></div>
        <div className={styles.sentenceMark} aria-hidden="true">文</div>
      </div>
      <div className={styles.sentenceStats}>
        <div><strong>{items.length}</strong><span>{level} sentences</span></div>
        <div><strong>{stats.solvedSentences}</strong><span>solved correctly</span></div>
        <div><strong>{stats.accuracy}%</strong><span>your accuracy</span></div>
      </div>
      <div className={styles.sentenceProgressTrack} role="progressbar" aria-label={`${level} sentence construction set progress`} aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={stats.solvedSentences}>
        <span style={{ width: `${Math.min(100, stats.solvedSentences / Math.max(1, items.length) * 100)}%` }} />
      </div>
      <div className={styles.sentenceProgressFoot}><span>{stats.solvedSentences} of {items.length} solved</span><span>{stats.totalAttempts} saved attempts</span></div>
    </section>

    <section className={styles.sentenceCard}>
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
            onClick={() => removeToken(position)} disabled={Boolean(feedback)} aria-label={`Remove ${token}`}>{token}<span>×</span></button>
        )) : <span className={styles.sentencePlaceholder}>Tap the tiles below to build your answer…</span>}
      </div>

      <div className={styles.sentenceTilesLabel}><span>WORD BANK</span><small>{selected.length} / {current.tokens.length} placed</small></div>
      <div className={styles.sentenceTiles}>
        {tileOrder.map((tokenIndex) => {
          const used = selected.includes(tokenIndex);
          return <button type="button" key={tokenIndex} className={styles.sentenceTile}
            onClick={() => addToken(tokenIndex)} disabled={used || Boolean(feedback)} aria-pressed={used}>{used ? <span className={styles.sentenceTileUsed}>{current.tokens[tokenIndex]}</span> : current.tokens[tokenIndex]}</button>;
        })}
      </div>

      <div className={styles.sentenceUtilityRow}>
        <button type="button" className={styles.textButton} onClick={() => { setSelected([]); setFeedback(null); setNotice(''); }} disabled={Boolean(feedback)}>Reset tiles</button>
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

    <div className={styles.sentenceBottomRow}>
      <div className={styles.sentenceInfoCard}><span className={styles.sentenceEyebrow}>SESSION RECAP</span><strong>{sessionCorrect} correct this session</strong><p>Build accuracy by attempting a mix of grammar patterns, not only the ones that feel familiar.</p></div>
      <div className={styles.sentenceInfoCard}><span className={styles.sentenceEyebrow}>LEARNING INTELLIGENCE</span><strong>Every answer counts.</strong><p>{signedIn ? 'Saved answers update your grammar weakness map and My progress report.' : 'Sign in to keep your attempts and connect them to your learner profile.'}</p></div>
    </div>
  </div>;
}
