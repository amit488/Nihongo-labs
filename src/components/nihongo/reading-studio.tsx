'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateReadingMinutes, getPassageText, getPassagesForLevel, kanaToRomaji, type ReadingLevel, type ReadingPassage } from '@/lib/nihongo/reading-content';
import { EmptyState, JlptLevelSwitch, SectionHeading, type JlptLevel } from './learning-shared';
import styles from './reading-studio.module.css';

export type ReadingStudioProps = {
  signedIn: boolean;
  romaji: boolean;
  setRomaji: (value: boolean) => void;
  search: string;
  preferredLevel: JlptLevel;
  onPreferredLevelChange: (level: JlptLevel) => Promise<void>;
  onProgressSaved: () => Promise<void>;
};

type SelectionPopup = { text: string; romaji: string; left: number; top: number; placement: 'above' | 'below' };

function passageSearchText(passage: ReadingPassage): string {
  return [
    passage.title,
    passage.context,
    passage.summary,
    getPassageText(passage),
    passage.paragraphs.flatMap((paragraph) => paragraph.map((sentence) => sentence.meaning)).join(' '),
    passage.vocabulary.map((item) => item.word + ' ' + item.meaning).join(' '),
  ].join(' ').toLocaleLowerCase();
}

function sentenceRomaji(passage: ReadingPassage): string[] {
  return passage.paragraphs.flatMap((paragraph) =>
    paragraph.map((sentence) => sentence.tokens.map((token) =>
      token.romaji || kanaToRomaji(token.reading),
    ).filter(Boolean).join(' ')),
  );
}

export default function ReadingStudio({
  signedIn, romaji, setRomaji, search, preferredLevel, onPreferredLevelChange, onProgressSaved,
}: ReadingStudioProps) {
  const initialLevel: ReadingLevel = preferredLevel === 'N4' ? 'N4' : 'N5';
  const [level, setLevel] = useState<ReadingLevel>(initialLevel);
  const [selectedId, setSelectedId] = useState(getPassagesForLevel(initialLevel)[0]?.id ?? '');
  const [showMeaning, setShowMeaning] = useState(false);
  const [view, setView] = useState<'all' | 'learned'>('all');
  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
  const [progressLoading, setProgressLoading] = useState(signedIn);
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');
  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const readerTextRef = useRef<HTMLDivElement>(null);

  const levelPassages = useMemo(() => getPassagesForLevel(level), [level]);
  const filteredPassages = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? levelPassages.filter((passage) => passageSearchText(passage).includes(term)) : levelPassages;
  }, [levelPassages, search]);
  const visiblePassages = useMemo(() => view === 'learned'
    ? filteredPassages.filter((passage) => learnedIds.has(passage.id))
    : filteredPassages, [filteredPassages, learnedIds, view]);
  const passage = visiblePassages.find((item) => item.id === selectedId) || visiblePassages[0] || null;
  const groupedPassages = useMemo(() => {
    const groups = new Map<string, ReadingPassage[]>();
    for (const item of visiblePassages) {
      const current = groups.get(item.context) ?? [];
      current.push(item);
      groups.set(item.context, current);
    }
    return Array.from(groups.entries());
  }, [visiblePassages]);
  const learnedCount = levelPassages.filter((item) => learnedIds.has(item.id)).length;
  const readingMinutes = passage ? estimateReadingMinutes(passage) : 0;
  const passageRomaji = passage ? sentenceRomaji(passage) : [];
  const passageMeaning = passage
    ? passage.paragraphs.map((paragraph) => paragraph.map((sentence) => sentence.meaning.trim()).filter(Boolean).join(' ')).filter(Boolean)
    : [];

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch('/api/learning/reading-progress?level=' + level, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { passageIds?: string[]; error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load your reading progress.');
        if (active) setLearnedIds(new Set(body.passageIds ?? []));
      })
      .catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Could not load your reading progress.');
      })
      .finally(() => {
        if (active) setProgressLoading(false);
      });
    return () => { active = false; };
  }, [level, signedIn]);

  function clearSelection() {
    setPopup(null);
  }

  function selectPassage(id: string) {
    setSelectedId(id);
    setShowMeaning(false);
    setNotice('');
    clearSelection();
  }

  function changeLevel(next: JlptLevel) {
    if (next === level) return;
    const nextLevel: ReadingLevel = next === 'N4' ? 'N4' : 'N5';
    setLevel(nextLevel);
    setSelectedId(getPassagesForLevel(nextLevel)[0]?.id ?? '');
    setShowMeaning(false);
    setView('all');
    setNotice('');
    setProgressLoading(signedIn);
    setLearnedIds(new Set());
    clearSelection();
    void onPreferredLevelChange(next);
  }

  useEffect(() => {
    let animationFrame = 0;

    function clearPopup() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      setPopup(null);
    }

    function updatePopupAfterSelection() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const root = readerTextRef.current;
        const selection = document.getSelection();
        const selectedText = selection?.toString().trim() ?? '';
        if (!root || !selection || !selectedText || selection.rangeCount === 0 || selection.isCollapsed) {
          setPopup(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const startsInsideReader = root.contains(range.startContainer);
        const endsInsideReader = root.contains(range.endContainer);
        if (!startsInsideReader && !endsInsideReader) {
          setPopup(null);
          return;
        }

        const selectedTokens = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-token="true"]'))
          .filter((node) => {
            try { return range.intersectsNode(node) && Boolean(node.dataset.romaji); }
            catch { return false; }
          });
        const selectedRomaji = selectedTokens
          .map((node) => node.dataset.romaji || '')
          .filter(Boolean)
          .join(' · ');
        if (!selectedRomaji) {
          setPopup(null);
          return;
        }

        // Use the first visual line of the selected range. The popup is portalled
        // to document.body, so these viewport coordinates remain correct even
        // when the reading panel is inside a scrollable or clipped layout.
        const firstRect = Array.from(range.getClientRects()).find((rect) => rect.width > 0 && rect.height > 0)
          ?? range.getBoundingClientRect();
        if (!firstRect.width && !firstRect.height) {
          setPopup(null);
          return;
        }
        const halfPopupWidth = Math.min(170, Math.max(90, window.innerWidth / 2 - 12));
        const left = Math.max(halfPopupWidth + 12, Math.min(window.innerWidth - halfPopupWidth - 12, firstRect.left + firstRect.width / 2));
        const placement = firstRect.top >= 72 ? 'above' : 'below';
        const top = placement === 'above' ? firstRect.top - 10 : firstRect.bottom + 10;
        setPopup({ text: selectedText, romaji: selectedRomaji, left, top, placement });
      });
    }

    // Listen on document, not just the reading element: users often finish a
    // drag just outside the text panel, which otherwise misses the mouseup.
    document.addEventListener('mouseup', updatePopupAfterSelection);
    document.addEventListener('keyup', updatePopupAfterSelection);
    document.addEventListener('touchend', updatePopupAfterSelection, { passive: true });
    window.addEventListener('scroll', clearPopup, true);
    window.addEventListener('resize', clearPopup);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('mouseup', updatePopupAfterSelection);
      document.removeEventListener('keyup', updatePopupAfterSelection);
      document.removeEventListener('touchend', updatePopupAfterSelection);
      window.removeEventListener('scroll', clearPopup, true);
      window.removeEventListener('resize', clearPopup);
    };
  }, [passage?.id]);

  async function toggleLearned() {
    if (!passage || !signedIn || savingId) {
      if (!signedIn) setNotice('Sign in to save passages to your learned reading list.');
      return;
    }
    const wasLearned = learnedIds.has(passage.id);
    setSavingId(passage.id);
    setNotice('');
    try {
      const response = await fetch('/api/learning/reading-progress', {
        method: wasLearned ? 'DELETE' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passageId: passage.id, level }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not update this reading passage.');
      setLearnedIds((current) => {
        const next = new Set(current);
        if (wasLearned) next.delete(passage.id);
        else next.add(passage.id);
        return next;
      });
      setNotice(wasLearned
        ? 'Removed from your learned readings.'
        : 'Saved as learned. This passage will not be counted twice.');
      await onProgressSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update reading progress.');
    } finally {
      setSavingId('');
    }
  }

  return <>
    <SectionHeading
      eyebrow={'GRADED READERS · JLPT ' + level}
      title="Read Japanese in real-life contexts."
      description="Choose a situation, read kanji in context, select any phrase for a romaji hint, and reveal the meaning when you are ready."
      action={<div className={styles.headingActions}>
        <JlptLevelSwitch value={level} onChange={changeLevel} label="Reading JLPT level" />
        <button type="button" className={styles.romajiToggle} aria-pressed={romaji} onClick={() => { setRomaji(!romaji); clearSelection(); }}>
          {romaji ? 'Hide romaji' : 'Show romaji'}
        </button>
      </div>}
    />

    <div className={styles.librarySummary}>
      <div><strong>{levelPassages.length}</strong><span>{level} readings</span></div>
      <div><strong>{learnedCount}</strong><span>learned</span></div>
      <div><strong>{Math.max(0, levelPassages.length - learnedCount)}</strong><span>to explore</span></div>
      <div className={styles.librarySummaryNote}>Select any Japanese text to see its reading. Full-passage romaji is optional.</div>
    </div>

    <div className={styles.libraryToolbar}>
      <div className={styles.viewTabs} aria-label="Reading library filter">
        <button type="button" aria-pressed={view === 'all'} className={view === 'all' ? styles.viewTabActive : ''}
          onClick={() => setView('all')}>All readings ({levelPassages.length})</button>
        <button type="button" aria-pressed={view === 'learned'} className={view === 'learned' ? styles.viewTabActive : ''}
          onClick={() => setView('learned')}>Learned ({learnedCount})</button>
      </div>
      <span className={styles.libraryHint}>{signedIn ? 'Progress syncs to your account' : 'Sign in to save learned readings'}</span>
    </div>

    {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
    {progressLoading ? <div className={styles.loading} role="status">Loading your saved reading progress…</div> : null}

    {!visiblePassages.length ? (
      <EmptyState
        title={view === 'learned' ? 'No learned readings yet' : 'No readings match this search'}
        description={view === 'learned'
          ? 'Read a passage and use “Mark as learned” to build your personal reading library.'
          : 'Try another topic or search term. New reading contexts will appear here as the library grows.'}
      />
    ) : (
      <div className={styles.readingLayout}>
        <aside className={styles.readingLibrary} aria-label="Reading contexts">
          <div className={styles.libraryHeading}>
            <span>YOUR READING LIBRARY</span>
            <strong>{visiblePassages.length} passages</strong>
          </div>
          {groupedPassages.map(([context, items]) => (
            <section className={styles.contextGroup} key={context}>
              <h3>{context}</h3>
              {items.map((item) => {
                const itemLearned = learnedIds.has(item.id);
                return <button type="button" key={item.id}
                  className={styles.passageLink + (passage?.id === item.id ? ' ' + styles.passageLinkActive : '')}
                  aria-current={passage?.id === item.id ? 'page' : undefined}
                  onClick={() => selectPassage(item.id)}>
                  <span className={styles.passageLinkTitle}>{item.title}</span>
                  <span className={styles.passageLinkMeta}>{estimateReadingMinutes(item)} min · {itemLearned ? 'Learned ✓' : level}</span>
                </button>;
              })}
            </section>
          ))}
        </aside>

        {passage ? <article className={styles.readerCard} data-allow-copy="true">
          <div className={styles.readerTopline}>
            <span>{level} READER · {passage.context.toLocaleUpperCase()}</span>
            <span>{readingMinutes} min read</span>
          </div>
          <div className={styles.readerTitleRow}>
            <div>
              <h2>{passage.title}</h2>
              <p>{passage.summary}</p>
            </div>
            {learnedIds.has(passage.id) ? <span className={styles.learnedPill}>Learned ✓</span> : null}
          </div>

          <div className={styles.readerActions}>
            <button type="button" className={styles.meaningButton}
              aria-controls={`reading-meaning-${passage.id}`} aria-expanded={showMeaning}
              onClick={() => { clearSelection(); setShowMeaning((value) => !value); }}>
              {showMeaning ? 'Hide meaning' : 'Show meaning'}
            </button>
            <span className={styles.readingCount}>{Array.from(getPassageText(passage)).length} Japanese characters</span>
          </div>

          <div className={styles.readerTextSurface}>
            <div className={styles.readerText} ref={readerTextRef}>
              {passage.paragraphs.map((paragraph, paragraphIndex) => (
                <p className={styles.readerParagraph} key={paragraphIndex}>
                  {paragraph.map((sentence, sentenceIndex) => (
                    <span className={styles.readerSentence} key={sentenceIndex}>
                      {sentence.tokens.map((token, tokenIndex) => {
                        const tokenRomaji = token.romaji || kanaToRomaji(token.reading);
                        return <span key={tokenIndex} data-reading-token="true" data-romaji={tokenRomaji || undefined}
                          className={token.reading ? styles.readingToken : undefined}>{token.text}</span>;
                      })}
                    </span>
                  ))}
                </p>
              ))}
            </div>

          </div>
          {popup && typeof document !== 'undefined' ? createPortal(
            <div className={styles.selectionPopup} role="status" aria-live="polite"
              style={{ left: popup.left, top: popup.top, transform: popup.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}>
              <span className={styles.popupLabel}>ROMAJI</span>
              <strong>{popup.romaji}</strong>
              <small>{popup.text}</small>
            </div>,
            document.body,
          ) : null}

          {romaji ? <div className={styles.fullRomaji}>
            <div className={styles.supportingLabel}>FULL PASSAGE ROMAJI</div>
            {passageRomaji.map((line, index) => <p key={index}>{line}</p>)}
          </div> : null}

          <section id={`reading-meaning-${passage.id}`} className={styles.meaningPanel}
            aria-label={`English meaning for ${passage.title}`} hidden={!showMeaning}>
            <div className={styles.supportingLabel}>ENGLISH MEANING</div>
            {passageMeaning.length > 0
              ? passageMeaning.map((meaning, index) => <p key={index}>{meaning}</p>)
              : <p>English meaning is not available for this passage yet.</p>}
          </section>

          <div className={styles.vocabularyPanel}>
            <div className={styles.vocabularyHeader}>
              <div><span className={styles.supportingLabel}>WORDS TO NOTICE</span><strong>Vocabulary in context</strong></div>
              <span>{passage.vocabulary.length} words</span>
            </div>
            <div className={styles.vocabularyGrid}>
              {passage.vocabulary.map((item) => (
                <div className={styles.vocabularyItem} key={item.word}>
                  <strong>{item.word}</strong>
                  <span>{item.reading}{romaji ? ` · ${kanaToRomaji(item.reading)}` : ''}</span>
                  <small>{item.meaning}</small>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.readerFooter}>
            <div>
              <strong>{learnedIds.has(passage.id) ? 'You have learned this reading.' : 'Finished reading this context?'}</strong>
              <span>{learnedIds.has(passage.id) ? 'It is saved in your Learned list and counted once.' : 'Mark it as learned to keep track of your reading library.'}</span>
            </div>
            {signedIn ? <button type="button" className={styles.learnButton} disabled={savingId === passage.id}
              onClick={() => void toggleLearned()}>
              {savingId === passage.id ? 'Saving…' : learnedIds.has(passage.id) ? 'Remove learned status' : 'Mark as learned ✓'}
            </button> : <Link className={styles.learnButton} href="/login">Sign in to save</Link>}
          </div>
        </article> : null}
      </div>
    )}
  </>;
}
