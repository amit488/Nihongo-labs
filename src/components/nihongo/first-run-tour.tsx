'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './first-run-tour.module.css';

type TourStep = {
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
};

type Rect = { top: number; left: number; width: number; height: number };
type BubblePosition = { top: number; left: number };

const steps: TourStep[] = [
  {
    target: 'welcome',
    eyebrow: 'YOUR FIRST LOOK · 01',
    title: 'Welcome to your learning space.',
    description: 'This is your personal Japanese study desk. Your learning tools, daily focus and progress all live here.',
    detail: 'Think of this as your home base. You can always return to Overview from the left menu.',
  },
  {
    target: 'jlpt-focus',
    eyebrow: 'YOUR LEVEL · 02',
    title: 'Choose the level you are working towards.',
    description: 'Your current JLPT focus keeps learning progress organised. Switch between N5 and N4 as your confidence grows.',
    detail: 'Your selected level is remembered for your next visit.',
  },
  {
    target: 'learning-navigation',
    eyebrow: 'FIND YOUR WAY · 03',
    title: 'Everything has its own place.',
    description: 'Learn introduces kana, kanji, grammar and vocabulary. Practice is where you use them through sentences, flashcards, reading and mock exams.',
    detail: 'Open any section whenever you are ready. Your learning progress stays with your account.',
  },
  {
    target: 'library-search',
    eyebrow: 'QUICK DISCOVERY · 04',
    title: 'Find a lesson or word in seconds.',
    description: 'Search across published grammar, vocabulary, kanji and lessons without hunting through every section.',
    detail: 'Use the search box or press ⌘ K on Mac (Ctrl K on Windows).',
  },
  {
    target: 'study-timer',
    eyebrow: 'BUILD A HABIT · 05',
    title: 'Your study time is tracked for you.',
    description: 'The timer counts active study time while you are signed in. It pauses when you leave the browser window.',
    detail: 'Quick Revision also appears during eligible study sessions, helping you revisit what you have learned.',
  },
  {
    target: 'progress-summary',
    eyebrow: 'SEE THE MOMENTUM · 06',
    title: 'Small wins become visible progress.',
    description: 'These cards show your learning readiness, vocabulary, kanji and study streak. Your study rhythm and daily goal sit just below.',
    detail: 'Progress updates as you complete lessons and practice activities.',
  },
  {
    target: 'today-focus',
    eyebrow: 'START SMALL · 07',
    title: 'Pick one useful thing and begin.',
    description: 'Today’s focus gives you short activities to get moving. You do not need to finish everything in one sitting.',
    detail: 'Choose a card to open that study area. That is all it takes to get started.',
  },
  {
    target: 'learner-profile',
    eyebrow: 'YOU ARE ALL SET · 08',
    title: 'Your learning space is ready.',
    description: 'Your account and membership details are available at the bottom of the sidebar. You can return here whenever you need them.',
    detail: 'That is the tour. Let’s make your first study session count.',
  },
];

export default function FirstRunTour({
  open,
  saving,
  error,
  onFinish,
}: {
  open: boolean;
  saving: boolean;
  error: string;
  onFinish: () => void | Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [focusRect, setFocusRect] = useState<Rect | null>(null);
  const [bubblePosition, setBubblePosition] = useState<BubblePosition>({ top: 150, left: 20 });
  const bubbleRef = useRef<HTMLElement | null>(null);
  const step = steps[index];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let frame = 0;

    const updatePosition = () => {
      if (cancelled) return;
      const target = document.querySelector<HTMLElement>('[data-tour="' + step.target + '"]');
      if (!target) {
        setFocusRect(null);
        setBubblePosition({
          left: Math.max(16, (window.innerWidth - Math.min(390, window.innerWidth - 32)) / 2),
          top: Math.max(20, (window.innerHeight - 300) / 2),
        });
        return;
      }

      const raw = target.getBoundingClientRect();
      if (raw.top < 10 || raw.bottom > window.innerHeight - 10) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
      const rect = target.getBoundingClientRect();
      const padding = 7;
      const focus: Rect = {
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: Math.min(window.innerWidth - Math.max(8, rect.left - padding) - 8, rect.width + padding * 2),
        height: Math.min(window.innerHeight - Math.max(8, rect.top - padding) - 8, rect.height + padding * 2),
      };
      const bubbleWidth = Math.min(390, window.innerWidth - 32);
      const bubbleHeight = bubbleRef.current?.getBoundingClientRect().height ?? 285;
      const left = Math.max(16, Math.min(window.innerWidth - bubbleWidth - 16, rect.left + rect.width / 2 - bubbleWidth / 2));
      const canPlaceBelow = focus.top + focus.height + bubbleHeight + 22 <= window.innerHeight - 12;
      const top = canPlaceBelow
        ? focus.top + focus.height + 17
        : Math.max(12, focus.top - bubbleHeight - 17);

      setFocusRect(focus);
      setBubblePosition({ top, left });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [open, index, step.target]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!saving) void onFinish();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onFinish]);

  if (!open) return null;

  const lastStep = index === steps.length - 1;
  const focus = focusRect;
  const topHeight = focus ? Math.max(0, focus.top) : 0;
  const leftWidth = focus ? Math.max(0, focus.left) : 0;
  const rightStart = focus ? focus.left + focus.width : 0;
  const rightWidth = focus ? Math.max(0, window.innerWidth - rightStart) : 0;
  const bottomStart = focus ? focus.top + focus.height : 0;
  const bottomHeight = focus ? Math.max(0, window.innerHeight - bottomStart) : 0;

  return (
    <div className={styles.tourRoot}>
      {focus ? (
        <>
          <div className={styles.shade} style={{ top: 0, left: 0, width: '100vw', height: topHeight }} />
          <div className={styles.shade} style={{ top: focus.top, left: 0, width: leftWidth, height: focus.height }} />
          <div className={styles.shade} style={{ top: focus.top, left: rightStart, width: rightWidth, height: focus.height }} />
          <div className={styles.shade} style={{ top: bottomStart, left: 0, width: '100vw', height: bottomHeight }} />
          <div
            className={styles.focusFrame}
            style={{ top: focus.top, left: focus.left, width: focus.width, height: focus.height }}
            aria-hidden="true"
          />
        </>
      ) : <div className={styles.fullShade} />}
      <section
        ref={bubbleRef}
        className={styles.bubble}
        style={{ top: bubblePosition.top, left: bubblePosition.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-tour-title"
        aria-describedby="first-run-tour-description"
      >
        <div className={styles.bubbleTop}>
          <span className={styles.brandGlyph} aria-hidden="true">日</span>
          <span className={styles.eyebrow}>{step.eyebrow}</span>
          <span className={styles.stepCount}>{String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: ((index + 1) / steps.length * 100) + '%' }} />
        </div>
        <h2 id="first-run-tour-title">{step.title}</h2>
        <p id="first-run-tour-description">{step.description}</p>
        <div className={styles.detail}>
          <span aria-hidden="true">✦</span>
          <span>{step.detail}</span>
        </div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.dotRow} aria-label="Tour steps">
          {steps.map((item, itemIndex) => (
            <button
              key={item.target}
              type="button"
              className={itemIndex === index ? styles.activeDot : styles.dot}
              aria-label={'Go to step ' + (itemIndex + 1) + ': ' + item.title}
              aria-current={itemIndex === index ? 'step' : undefined}
              disabled={saving}
              onClick={() => setIndex(itemIndex)}
            />
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.skipButton} disabled={saving} onClick={() => void onFinish()}>
            {saving ? 'Saving…' : 'Skip tour'}
          </button>
          <div className={styles.actionRight}>
            {index > 0 ? (
              <button type="button" className={styles.backButton} disabled={saving} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className={styles.nextButton}
              disabled={saving}
              onClick={() => lastStep ? void onFinish() : setIndex((value) => Math.min(steps.length - 1, value + 1))}
            >
              {saving ? 'Saving…' : lastStep ? 'Finish tour' : 'Next step'}
              <span aria-hidden="true">{lastStep ? '✓' : '→'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
