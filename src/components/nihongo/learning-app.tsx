'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './learning-app.module.css';
import { QuickRevision, QuickRevisionStats } from './quick-revision';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { getDaysUntilJlpt } from '@/lib/nihongo/jlpt-countdown';
import { JlptLevelSwitch, ProgressBar, SectionHeading, type JlptLevel, type Tone } from './learning-shared';
import type { LearningFeatureProps } from './learning-features';
import { applyStudyTimeCredit } from '@/lib/nihongo/activity-snapshot';
import { getPublishedFlashcards, getPublishedGrammar, loadLearnerSnapshot, type LearnerFlashcard, type LearnerSnapshot } from '@/lib/nihongo/data';
import { signOutAction } from '@/app/actions/auth';
import { grammar as demoGrammar, kanji as demoKanji, vocabulary as demoVocabulary } from '@/lib/nihongo/demo-content';
import type { GrammarItem } from '@/lib/nihongo/demo-content';

type Props = { section?: string[] };
const LazyLearningFeature = lazy(() => import('./learning-features').then((module) => ({ default: module.LearningFeature })));

const navGroups = [
  { label: 'LEARN', items: [
    { key: 'overview', title: 'Overview', href: '/learn', icon: '◫' },
    { key: 'grammar', title: 'Grammar', href: '/learn/grammar', icon: '文' },
    { key: 'sensei', title: 'Japanese Sensei', href: '/learn/sensei', icon: '先生' },
    { key: 'vocabulary', title: 'Vocabulary', href: '/learn/vocabulary', icon: '語' },
    { key: 'kanji', title: 'Kanji', href: '/learn/kanji', icon: '字' },
    { key: 'kana', title: 'Hiragana & Katakana', href: '/learn/kana', icon: 'あ' },
  ] },
  { label: 'PRACTICE', items: [
    { key: 'practice', title: 'Daily practice', href: '/learn/practice', icon: '✳' },
    { key: 'flashcards', title: 'Flashcards', href: '/learn/flashcards', icon: '▤' },
    { key: 'reading', title: 'Reading', href: '/learn/reading', icon: '読' },
    { key: 'exams', title: 'Mock exams', href: '/learn/exams', icon: '◷' },
  ] },
  { label: 'YOUR SPACE', items: [
    { key: 'progress', title: 'My progress', href: '/learn/progress', icon: '↗' },
    { key: 'subscription', title: 'Membership', href: '/learn/subscription', icon: '◇' },
  ] },
];

function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span aria-hidden="true" className={styles.icon + ' ' + className}>{children}</span>;
}

export default function LearningApp({ section = [] }: Props) {
  const router = useRouter();
  const active = section[0] || 'overview';
  const isStudySection = ['grammar', 'vocabulary', 'kanji', 'kana', 'practice', 'flashcards', 'reading', 'exams'].includes(active);
  const [name, setName] = useState('Learner');
  const [signedIn, setSignedIn] = useState(false);
  const [activityTrackingNotice, setActivityTrackingNotice] = useState('');
  const studyTimerRef = useRef<HTMLSpanElement>(null);
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<LearnerSnapshot>({
    displayName: 'Learner', preferredJlptLevel: 'N5', grammarCount: 0, vocabularyCount: 0, kanjiCount: 0, kanjiMastered: 0,
    activeDays: [], lessonsCompleted: 0, recentScores: [], overallPercentage: 0,
    mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
    streak: 0, due: { vocabulary: 0, flashcards: 0, total: 0 },
    dailyGoal: { minutes: 15, studiedSeconds: 0 }, totalStudySeconds: 0,
    premiumActive: false, showRomaji: true, showFurigana: true, recentActivity: [], source: 'preview',
  });
  const [grammarData, setGrammarData] = useState<GrammarItem[]>(demoGrammar);
  const [flashcardData, setFlashcardData] = useState<LearnerFlashcard[]>([]);
  const [romaji, setRomaji] = useState(true);
  const refreshLearnerSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await loadLearnerSnapshot();
      setSnapshot(nextSnapshot);
      if (nextSnapshot.source === 'database') setName(nextSnapshot.displayName || 'Learner');
    } catch {
      // Keep the last known snapshot if the dashboard refresh is temporarily unavailable.
    }
  }, []);
  const setRomajiPreference = (value: boolean) => {
    setRomaji(value);
    if (signedIn) void fetch('/api/learning/settings', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showRomaji: value }) }).catch(() => undefined);
  };
  const [search, setSearch] = useState('');
  const [kanaMode, setKanaMode] = useState<'hiragana' | 'katakana'>('hiragana');
  const [kanaQuiz, setKanaQuiz] = useState(false);

  useEffect(() => {
    let alive = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const load = async () => {
      const authPromise = client.auth.getUser();
      const [authResult, dataSnapshot, grammarRows, flashcardRows] = await Promise.all([
        authPromise,
        authPromise.then(({ data }) => loadLearnerSnapshot(data.user)),
        getPublishedGrammar(),
        getPublishedFlashcards(),
      ]);
      const user = authResult.data.user;
      if (!alive) return;
      setConnected(true);
      if (user) {
        setSignedIn(true);
        setName(dataSnapshot.displayName || user.email?.split('@')[0] || 'Learner');
      }
      setRomaji(dataSnapshot.showRomaji);
      setSnapshot(dataSnapshot);
      if (grammarRows.length) setGrammarData(grammarRows);
      if (flashcardRows.length) setFlashcardData(flashcardRows);
    };
    void load();
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setSignedIn(Boolean(session?.user));
      if (session?.user) {
        // Supabase may emit TOKEN_REFRESHED when a background tab becomes active.
        // Reload the profile rather than replacing the saved display name with email.
        window.setTimeout(() => {
          if (alive) void refreshLearnerSnapshot();
        }, 0);
      } else {
        setName('Learner');
        setActivityTrackingNotice('');
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [refreshLearnerSnapshot]);

  useEffect(() => {
    if (!signedIn || !isStudySection) return;
    let sessionMilliseconds = 0;

    type BrowserLockManager = {
      request(
        name: string,
        options: { ifAvailable: boolean },
        callback: (lock: unknown | null) => Promise<void>,
      ): Promise<void>;
    };

    let disposed = false;
    let userId: string | null = null;
    let storageKey: string | null = null;
    type PendingStudyState = {
      milliseconds: number;
      requestId: string | null;
      requestCreatedAt: string | null;
      requestSeconds: number | null;
    };
    const emptyPendingState: PendingStudyState = {
      milliseconds: 0,
      requestId: null,
      requestCreatedAt: null,
      requestSeconds: null,
    };
    let fallbackPendingState: PendingStudyState = emptyPendingState;
    let lockRequestPending = false;
    let currentSend: Promise<void> | null = null;
    let retryAfter = 0;
    let retryTimer: number | null = null;
    let stopActiveLoop: (() => void) | null = null;

    const isEligible = () =>
      document.visibilityState === 'visible' && document.hasFocus();

    // Persist the queued duration and one immutable request batch together.
    // A batch keeps the same ID, creation time and seconds across every retry.
    // Time measured after that snapshot remains queued as a newer tail.
    const readPendingState = (): PendingStudyState => {
      if (!storageKey) return fallbackPendingState;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return fallbackPendingState;
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'number') {
          // Migrate values saved by the oldest timer format.
          return {
            ...emptyPendingState,
            milliseconds: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0,
          };
        }
        if (typeof parsed === 'object' && parsed !== null) {
          const value = parsed as {
            milliseconds?: unknown;
            requestId?: unknown;
            requestCreatedAt?: unknown;
            requestSeconds?: unknown;
          };
          const milliseconds =
            typeof value.milliseconds === 'number' &&
            Number.isFinite(value.milliseconds) &&
            value.milliseconds > 0
              ? Math.floor(value.milliseconds)
              : 0;
          const requestId =
            typeof value.requestId === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)
              ? value.requestId
              : null;
          const parsedCreatedAt =
            typeof value.requestCreatedAt === 'string' &&
            Number.isFinite(Date.parse(value.requestCreatedAt))
              ? value.requestCreatedAt
              : null;
          const requestSeconds =
            typeof value.requestSeconds === 'number' &&
            Number.isInteger(value.requestSeconds) &&
            value.requestSeconds >= 1 &&
            value.requestSeconds <= 3600
              ? value.requestSeconds
              : null;

          return {
            milliseconds,
            requestId,
            // Older saved states did not contain these two fields. Preserve
            // their ID and establish a one-time retry-window start for migration.
            requestCreatedAt: requestId ? parsedCreatedAt ?? new Date().toISOString() : null,
            requestSeconds: requestId
              ? (requestSeconds ?? Math.min(Math.floor(milliseconds / 1000), 3600)) || null
              : null,
          };
        }
        return emptyPendingState;
      } catch {
        return fallbackPendingState;
      }
    };

    const writePendingState = (state: PendingStudyState) => {
      const next: PendingStudyState = {
        milliseconds: Math.max(0, Math.floor(state.milliseconds)),
        requestId: state.requestId,
        requestCreatedAt: state.requestId ? state.requestCreatedAt : null,
        requestSeconds: state.requestId ? state.requestSeconds : null,
      };
      fallbackPendingState = next;
      if (!storageKey) return;
      try {
        if (next.milliseconds === 0 && next.requestId === null) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch {
        // Continue in memory when storage is unavailable; the server still
        // caps every credit using its own elapsed-time watermark.
      }
    };

    const readPendingMilliseconds = () => readPendingState().milliseconds;

    const getOrCreateRequest = (): PendingStudyState => {
      const state = readPendingState();
      if (state.requestId && state.requestCreatedAt && state.requestSeconds) {
        // Persist any one-time migration of older localStorage formats.
        writePendingState(state);
        return state;
      }
      const pendingSeconds = Math.floor(state.milliseconds / 1000);
      if (pendingSeconds < 1) return state;
      const next: PendingStudyState = {
        milliseconds: state.milliseconds,
        requestId: crypto.randomUUID(),
        requestCreatedAt: new Date().toISOString(),
        requestSeconds: Math.min(pendingSeconds, 3600),
      };
      writePendingState(next);
      return next;
    };

    let lastInteractionAt = performance.now();
    const inactivityLimitMilliseconds = 5 * 60 * 1000;
    const isStudyEligible = () =>
      isEligible() && performance.now() - lastInteractionAt <= inactivityLimitMilliseconds;

    const sendPendingTime = async (includePartialBatch: boolean) => {
      // A visibility/page-exit flush waits for any already-running heartbeat
      // before the tab releases its cross-tab lock.
      if (currentSend) {
        await currentSend;
        return sendPendingTime(includePartialBatch);
      }

      if (!userId || !storageKey || Date.now() < retryAfter) return;

      const pendingState = readPendingState();
      const pendingSeconds = Math.floor(pendingState.milliseconds / 1000);
      if (pendingSeconds < 1 || (!includePartialBatch && pendingSeconds < 30)) return;

      // Freeze one batch before sending it. Newly measured time is appended to
      // the queue but never changes the payload associated with this request ID.
      const requestState = getOrCreateRequest();
      if (!requestState.requestId || !requestState.requestCreatedAt || !requestState.requestSeconds) return;
      const requestedSeconds = requestState.requestSeconds;
      const requestId = requestState.requestId;
      const requestCreatedAt = requestState.requestCreatedAt;

      const operation = (async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch('/api/learning/activity', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds: requestedSeconds, requestId, requestCreatedAt }),
            keepalive: true,
            cache: 'no-store',
            signal: controller.signal,
          });
          const body = await response.json().catch(() => ({})) as {
            error?: string;
            details?: { code?: string };
            creditedSeconds?: number;
            activityDate?: string;
          };

          if (!response.ok && body.details?.code === 'HEARTBEAT_REQUEST_EXPIRED') {
            // The server cannot safely distinguish a very late retry from a
            // duplicate after its ledger row has expired. Drop only this frozen
            // batch; all time measured after it remains queued.
            const current = readPendingState();
            const expiredBatchMilliseconds = Math.min(
              current.milliseconds,
              requestedSeconds * 1000,
            );
            writePendingState({
              ...current,
              milliseconds: current.milliseconds - expiredBatchMilliseconds,
              requestId: null,
              requestCreatedAt: null,
              requestSeconds: null,
            });
            retryAfter = 0;
            if (!disposed) {
              setActivityTrackingNotice(
                'One unconfirmed study-time batch older than eight days was discarded to prevent double-counting. Newer pending time remains queued.',
              );
            }
            return;
          }

          if (!response.ok) {
            throw new Error(body.error || 'Study time could not be recorded.');
          }

          const creditedSeconds = Math.max(
            0,
            Math.min(requestedSeconds, Math.floor(Number(body.creditedSeconds ?? 0))),
          );

          if (creditedSeconds > 0) {
            // Subtract only what the database confirms it credited. Any
            // remainder stays queued for a later, newly identified batch.
            const current = readPendingState();
            writePendingState({
              ...current,
              milliseconds: current.milliseconds - creditedSeconds * 1000,
              requestId: null,
              requestCreatedAt: null,
              requestSeconds: null,
            });
            retryAfter = 0;
            if (!disposed) {
              setActivityTrackingNotice('');
              if (typeof body.activityDate === 'string') {
                setSnapshot((current) => applyStudyTimeCredit(current, body.activityDate!, creditedSeconds));
              }
            }
          } else {
            // Another tab/device may have written more recently. Keep this
            // exact batch and ID so a retry cannot credit it twice.
            retryAfter = Date.now() + 5000;
          }
        } catch (error) {
          if (!disposed) {
            setActivityTrackingNotice(
              error instanceof Error ? error.message : 'Study time could not be recorded.',
            );
          }
          retryAfter = Date.now() + 30_000;
        } finally {
          window.clearTimeout(timeout);
          currentSend = null;
        }
      })();

      currentSend = operation;
      await operation;
    };

    const startActiveLoop = (releaseLock: () => void) => {
      let stopped = false;
      let lastSampleAt = performance.now();
      let timer = 0;

      const sample = () => {
        const now = performance.now();
        const elapsed = now - lastSampleAt;
        lastSampleAt = now;

        if (Number.isFinite(elapsed) && elapsed > 0) {
          // The short cap prevents a suspended laptop/browser from turning
          // sleep time into study time while tolerating ordinary UI delays.
          const sampledMilliseconds = Math.min(elapsed, 5_000);
          sessionMilliseconds += sampledMilliseconds;
          if (!disposed && studyTimerRef.current) {
            const elapsedSeconds = Math.floor(sessionMilliseconds / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            studyTimerRef.current.textContent = `Study · ${minutes}:${String(seconds).padStart(2, '0')}`;
            studyTimerRef.current.setAttribute('aria-label', `Active study time ${minutes} minutes and ${seconds} seconds`);
          }
          const pending = readPendingState();
          writePendingState({
            ...pending,
            milliseconds: pending.milliseconds + sampledMilliseconds,
          });
        }
      };

      const stop = () => {
        if (stopped) return;
        stopped = true;
        window.clearInterval(timer);
        sample();
        stopActiveLoop = null;
        // Keep the cross-tab lock until the final partial batch has been sent.
        void sendPendingTime(true).finally(releaseLock);
      };

      stopActiveLoop = stop;
      timer = window.setInterval(() => {
        if (!isStudyEligible()) {
          stop();
          return;
        }
        sample();
        if (Math.floor(readPendingMilliseconds() / 1000) >= 30) {
          void sendPendingTime(false);
        }
      }, 1000);

      // Attempt to save a partial batch left by a previous route/session.
      void sendPendingTime(true);
    };

    const acquireStudyLock = () => {
      if (disposed || !userId || !storageKey || !isStudyEligible() || lockRequestPending || stopActiveLoop) {
        return;
      }

      const lockManager = (navigator as unknown as { locks?: BrowserLockManager }).locks;
      if (!lockManager) {
        // Modern browsers support Web Locks. This fallback still uses the
        // server-side account lock to prevent duplicate database credits.
        startActiveLoop(() => undefined);
        return;
      }

      lockRequestPending = true;
      void lockManager.request(
        'nihongo-labs-study-time:' + userId,
        { ifAvailable: true },
        async (lock) => {
          if (!lock || disposed || !isStudyEligible()) return;
          await new Promise<void>((resolve) => startActiveLoop(resolve));
        },
      ).catch((error: unknown) => {
        if (!disposed) {
          setActivityTrackingNotice(
            error instanceof Error ? error.message : 'Study-time tracking could not start.',
          );
        }
      }).finally(() => {
        lockRequestPending = false;
      });
    };

    const handleEligibilityChange = () => {
      if (isEligible()) {
        lastInteractionAt = performance.now();
        void refreshLearnerSnapshot();
        acquireStudyLock();
      } else {
        stopActiveLoop?.();
      }
    };

    const handleLearnerInteraction = () => {
      lastInteractionAt = performance.now();
      acquireStudyLock();
    };

    const handlePageHide = () => stopActiveLoop?.();

    document.addEventListener('visibilitychange', handleEligibilityChange);
    document.addEventListener('pointerdown', handleLearnerInteraction, { passive: true });
    document.addEventListener('keydown', handleLearnerInteraction);
    document.addEventListener('scroll', handleLearnerInteraction, { passive: true });
    document.addEventListener('touchstart', handleLearnerInteraction, { passive: true });
    window.addEventListener('focus', handleEligibilityChange);
    window.addEventListener('blur', handleEligibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    const initialize = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) return;

      const { data: { user }, error } = await client.auth.getUser();
      if (disposed || error || !user) return;

      userId = user.id;
      storageKey = 'nihongo-labs:study-time:v1:' + user.id;
      acquireStudyLock();
      // If another tab currently owns the lock, retry after it releases it.
      retryTimer = window.setInterval(acquireStudyLock, 2000);
    };

    void initialize().catch((error: unknown) => {
      if (!disposed) {
        setActivityTrackingNotice(
          error instanceof Error ? error.message : 'Study-time tracking could not start.',
        );
      }
    });

    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearInterval(retryTimer);
      document.removeEventListener('visibilitychange', handleEligibilityChange);
      document.removeEventListener('pointerdown', handleLearnerInteraction);
      document.removeEventListener('keydown', handleLearnerInteraction);
      document.removeEventListener('scroll', handleLearnerInteraction);
      document.removeEventListener('touchstart', handleLearnerInteraction);
      window.removeEventListener('focus', handleEligibilityChange);
      window.removeEventListener('blur', handleEligibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      stopActiveLoop?.();
    };
  }, [signedIn, isStudySection, refreshLearnerSnapshot]);

  const titleMap: Record<string, string> = { overview: 'Overview', grammar: 'Grammar studio', vocabulary: 'Vocabulary', kanji: 'Kanji library', kana: 'Kana practice', practice: 'Daily practice', flashcards: 'Flashcard review', reading: 'Reading room', exams: 'Mock examinations', progress: 'Your progress', subscription: 'Membership' };
  const title = titleMap[active] || 'Overview';

  async function signOut() {
    await signOutAction();
    setSignedIn(false);
    setActivityTrackingNotice('');
    router.push('/login');
  }



    const streak = signedIn ? snapshot.streak : 0;

  return (
    <div className={styles.appFrame}>
      <aside className={styles.sidebar}>
        <Link href="/learn" className={styles.brand}><span className={styles.brandMark}>日</span><span><strong>Nihongo<span>.</span></strong><small>LABS · JLPT LEARNING</small></span></Link>
        <div className={styles.levelCard}><div className={styles.levelKicker}>YOUR LEARNING PATH</div><div className={styles.levelTitle}>JLPT N5 <span>01 / 05</span></div><ProgressBar value={snapshot.overallPercentage} tone="orange"/><div className={styles.levelFoot}><span>Beginner</span><span>{snapshot.overallPercentage}% complete</span></div></div>
        <nav className={styles.navigation} aria-label="Learning navigation">
          {navGroups.map((group) => <div className={styles.navGroup} key={group.label}><div className={styles.navLabel}>{group.label}</div>{group.items.map((item) => {
            const selected = item.key === 'overview' ? active === 'overview' : active === item.key;
            return <Link key={item.key} href={item.href} className={`${styles.navLink} ${selected ? styles.navActive : ''}`}><Icon>{item.icon}</Icon><span>{item.title}</span>{item.key === 'flashcards' && snapshot.due.flashcards > 0 && <em>{snapshot.due.flashcards}</em>}</Link>;
          })}</div>)}
        </nav>
        <div className={styles.sidebarBottom}><div className={styles.helpCard}><div className={styles.helpIcon}>?</div><strong>Need a little help?</strong><p>Explore the N5 study guide and learning tips.</p><Link href="/learn/reading">Open study guide <span>↗</span></Link></div><div className={styles.sidebarUser}><div className={styles.avatar}>{name.slice(0,1).toUpperCase()}</div><div className={styles.userMeta}><strong>{name}</strong><span>{signedIn ? (snapshot.premiumActive ? 'Premium member' : 'Free learner') : 'Preview learner'}</span></div><button type="button" aria-label="Account" onClick={() => router.push(signedIn ? '/learn/subscription' : '/login')}>···</button></div></div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}><div className={styles.breadcrumb}>Workspace <span>/</span> <strong>{title}</strong></div><div className={styles.topActions}><label className={styles.searchBox}><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lessons, words..."/><kbd>⌘ K</kbd></label>{signedIn && isStudySection ? <span ref={studyTimerRef} className={styles.counterPill} aria-label="Active study time 0 minutes and 0 seconds" title="Active time in this study session">Study · 0:00</span> : null}<button className={styles.iconButton} type="button" aria-label="Notifications">♧<i /></button><div className={styles.topAvatar}>{name.slice(0,1).toUpperCase()}</div>{signedIn ? <button className={styles.signOutButton} onClick={signOut}>Sign out</button> : <Link className={styles.signInButton} href="/login">Sign in</Link>}</div></header>
        <div className={styles.contentArea}>
          {!connected && <div className={styles.previewNotice}><span>●</span> Preview mode <span className={styles.noticeDivider}>·</span> Connect your local Supabase keys to load your saved learning data.</div>}
          {connected && !signedIn && <div className={styles.previewNotice}><span>●</span> Demo content <span className={styles.noticeDivider}>·</span> Sign in to load your personal progress.</div>}
          {active === 'overview' && <Dashboard name={name} signedIn={signedIn} snapshot={snapshot} streak={streak} activityTrackingNotice={signedIn ? activityTrackingNotice : ''} onContinue={() => router.push('/learn/grammar')} />}
          {active !== 'overview' && active !== 'progress' && <Suspense fallback={<div className={styles.emptyState} role="status"><div>読</div><h2>Loading learning tools…</h2></div>}><LazyLearningFeature active={active as LearningFeatureProps['active']} grammarItems={grammarData} vocabularyItems={demoVocabulary} search={search} kanjiItems={demoKanji} flashcardItems={flashcardData} signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} kanaMode={kanaMode} setKanaMode={setKanaMode} kanaQuiz={kanaQuiz} setKanaQuiz={setKanaQuiz} onProgressSaved={refreshLearnerSnapshot} /></Suspense>}
          {active === 'progress' && <Progress snapshot={snapshot} streak={streak} signedIn={signedIn} />}
        </div>
        <footer className={styles.footer}><span>© 2026 Nihongo Labs</span><span>Made for curious minds <b>✳</b></span><span>JLPT N5 · Learning workspace</span></footer>
      </main>
      <QuickRevision signedIn={signedIn} disabled={active === 'practice' || active === 'exams' || (active === 'kana' && kanaQuiz)} />
    </div>
  );
}

type DashboardLevelProgress = {
  level: JlptLevel;
  vocabulary: { completed: number; total: number };
  kanji: { completed: number; total: number };
};

function Dashboard({ name, signedIn, snapshot, streak, activityTrackingNotice, onContinue }: {
  name: string;
  signedIn: boolean;
  snapshot: LearnerSnapshot;
  streak: number;
  activityTrackingNotice: string;
  onContinue: () => void;
}) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [greeting, setGreeting] = useState('こんにちは');
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [levelProgress, setLevelProgress] = useState<DashboardLevelProgress | null>(null);

  useEffect(() => {
    const updateDashboardTime = () => {
      setDaysRemaining(getDaysUntilJlpt('2026-12-06', new Date(), 'Asia/Kolkata'));
      const hour = new Date().getHours();
      setGreeting(hour < 11 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは');
    };
    const initialUpdate = window.setTimeout(updateDashboardTime, 0);
    const timer = window.setInterval(updateDashboardTime, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch(`/api/learning/level-progress?level=${level}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as DashboardLevelProgress & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load level progress.');
        return body;
      })
      .then((body) => { if (active) setLevelProgress(body); })
      .catch(() => { if (active) setLevelProgress(null); });
    return () => { active = false; };
  }, [level, signedIn]);

  const ready = Number(snapshot.overallPercentage ?? 0);
  const words = Number(snapshot.vocabularyCount ?? 0);
  const kanjiCount = Number(snapshot.kanjiCount ?? 0);
  const currentProgress = levelProgress?.level === level ? levelProgress : null;
  const vocabularyCompleted = currentProgress?.vocabulary.completed ?? 0;
  const vocabularyTotal = currentProgress?.vocabulary.total ?? (level === 'N5' ? words : 0);
  const kanjiCompleted = currentProgress?.kanji.completed ?? 0;
  const kanjiTotal = currentProgress?.kanji.total ?? (level === 'N5' ? kanjiCount : 0);
  const vocabularyPercent = vocabularyTotal > 0 ? vocabularyCompleted / vocabularyTotal * 100 : 0;
  const kanjiPercent = kanjiTotal > 0 ? kanjiCompleted / kanjiTotal * 100 : 0;
  const rawStudiedSeconds = Number(snapshot.dailyGoal?.studiedSeconds ?? 0);
  const studiedSeconds = Number.isFinite(rawStudiedSeconds) ? Math.max(0, rawStudiedSeconds) : 0;
  const minutes = Math.floor(studiedSeconds / 60);
  const goal = Math.max(0, Number(snapshot.dailyGoal?.minutes ?? 15) || 0);
  const goalPercent = goal > 0
    ? studiedSeconds >= goal * 60 ? 100 : Math.min(99, Math.round((studiedSeconds / (goal * 60)) * 100))
    : 0;
  const activity = Array.isArray(snapshot.recentActivity) ? snapshot.recentActivity.slice(0, 7).reverse() : [];
  const maximum = Math.max(1, ...activity.map((row) => Number(row.study_seconds ?? 0)));
  const dayLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

  return <>
    <div className={styles.welcomeRow}>
      <div><div className={styles.eyebrow}>YOUR STUDY SPACE</div>
        <h1>{greeting}、{name}さん。 <span>ようこそ！</span></h1>
        <p>A little practice every day adds up. Ready to keep your momentum?</p>
      </div>
      <div className={styles.jlptCountdown} aria-label={`JLPT ${snapshot.preferredJlptLevel} examination countdown`}>
        <span className={styles.jlptCountdownKicker}>NEXT JLPT · {snapshot.preferredJlptLevel}</span>
        <strong>{daysRemaining === null ? '—' : daysRemaining === 0 ? 'Today' : daysRemaining > 0 ? daysRemaining : '—'}</strong>
        <span className={styles.jlptCountdownCopy}>{daysRemaining === 0 ? 'Exam day' : daysRemaining !== null && daysRemaining > 0 ? 'days remaining' : 'Date passed'}</span>
        <small className={styles.jlptCountdownDate}>6 December 2026</small>
      </div>
    </div>
    <section className={styles.heroCard}>
      <div className={styles.heroCopy}>
        <div className={styles.heroTag}><span /> YOUR NEXT STEP</div>
        <h2>Small steps.<br/><em>Fluent moments.</em></h2>
        <p>Pick up where you left off and make today count. Your next lesson is ready when you are.</p>
        <button type="button" className={styles.primaryButton} onClick={onContinue}>Continue learning <span>→</span></button>
        <div className={styles.heroMeta}><span>◷ Daily practice</span><span>•</span><span>JLPT N5 · Beginner</span></div>
      </div>
      <div className={styles.heroArt}><div className={styles.sunDisc} /><div className={styles.heroKanji}>学</div><div className={styles.heroArtNote}>MANABU <span>·</span> TO LEARN</div></div>
    </section>
    <div className={styles.sectionTop}>
      <div><div className={styles.eyebrow}>YOUR LEARNING PULSE</div><h2>Progress at a glance</h2></div>
      <div className={styles.dashboardLevelControl}>
        <JlptLevelSwitch value={level} onChange={setLevel} label="Dashboard JLPT level" />
        <Link href="/learn/progress" className={styles.textLink}>View full report <span>→</span></Link>
      </div>
    </div>
    <section className={styles.statsGrid}>
      <StatCard icon="◉" label="N5 readiness" value={`${ready}%`} note="Based on tracked learning" progress={ready} tone="green" />
      <StatCard icon="語" label={`${level} words learned`} value={`${vocabularyCompleted} / ${vocabularyTotal}`} note="Words marked as learned" progress={vocabularyPercent} tone="orange" />
      <StatCard icon="字" label={`${level} kanji known`} value={`${kanjiCompleted} / ${kanjiTotal}`} note="Characters marked as known" progress={kanjiPercent} tone="blue" />
      <StatCard icon="✳" label="Current streak" value={`${streak} days`} note="Days with learning activity" progress={Math.min(100, streak / 30 * 100)} tone="purple" />
    </section>
    <section className={styles.dashboardGrid}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><div><div className={styles.eyebrow}>CONSISTENCY IS KEY</div><h3>Your study rhythm</h3></div><span className={styles.smallBadge}>Last 7 active days</span></div>
        <div className={styles.chartArea}><div className={styles.chartYAxis}><span>60m</span><span>40m</span><span>20m</span><span>0m</span></div>
          <div className={styles.chartBars}>{(activity.length ? activity : Array.from({ length: 7 }, (_, index) => ({ activity_date: '', study_seconds: 0, key: index }))).map((row, index) => (
            <div className={styles.chartColumn} key={row.activity_date || index}><div className={styles.chartTrack}><span className={styles.chartBar} style={{ height: `${Math.max(2, Math.min(100, Number(row.study_seconds ?? 0) / Math.max(3600, maximum) * 100))}%` }} /></div><small>{row.activity_date ? dayLabel(row.activity_date) : '—'}</small></div>
          ))}</div>
        </div>
        <div className={styles.chartLegend}><span><i className={styles.legendGreen} /> Study time</span><span className={styles.chartAverage}>Tracked total <strong>{Math.floor(Number(snapshot.totalStudySeconds ?? 0) / 60)} min</strong></span></div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><div><div className={styles.eyebrow}>BUILD A DAILY HABIT</div><h3>Your daily goal</h3></div><span className={styles.smallBadge}>Today</span></div>
        <div className={styles.goalContent}>
          <div className={styles.goalRing} role="img" aria-label={`${goalPercent}% of the daily study goal completed`}
            style={{ background: `conic-gradient(#c7695e 0 ${goalPercent}%, #e6e9ed ${goalPercent}% 100%)` }}>
            <div><strong>{minutes}</strong><span>/ {goal} min</span></div>
          </div>
          <div className={styles.goalText}>
            <strong>{goalPercent === 100 ? 'Daily goal reached!' : 'Keep your momentum.'}</strong>
            <p>{goalPercent === 100 ? 'Great work. Your activity has been recorded.' : `${Math.max(0, goal - minutes)} more minutes to reach today's learning goal.`}</p>
            <ProgressBar value={goalPercent} />
            <div className={styles.goalFoot}><span>{goalPercent}% completed</span><span>{Math.max(0, goal - minutes)} min left</span></div>
          </div>
        </div>
      </div>
    </section>
    {activityTrackingNotice ? <div className={styles.activityTrackingNotice} role="status">Study-time tracking: {activityTrackingNotice}</div> : null}
    <div className={styles.sectionTop}><div><div className={styles.eyebrow}>A GOOD PLACE TO START</div><h2>Today&apos;s focus</h2></div><span className={styles.mutedMeta}>Choose a short activity</span></div>
    <section className={styles.focusGrid}>
      <FocusCard number="01" title="Particles: は vs が" description="Understand the difference between topic and subject markers." meta="Grammar · 8 min" tag="CONTINUE" href="/learn/grammar" tone="green"/>
      <FocusCard number="02" title="Everyday essentials" description="Revise useful words about daily routines." meta="Vocabulary · 6 min" tag="REVIEW" href="/learn/vocabulary" tone="orange"/>
      <FocusCard number="03" title="A short N5 story" description="Read a beginner passage and check your understanding." meta="Reading · 6 min" tag="NEW" href="/learn/reading" tone="blue"/>
    </section>
  </>;
}
function StatCard({ icon, label, value, note, progress, tone }: { icon: string; label: string; value: string; note: string; progress: number; tone: Tone }) {
  return <div className={styles.statCard}><div className={styles.statTop}><span className={`${styles.statIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><span className={styles.statMore}>···</span></div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statNote}>{note}</div><ProgressBar value={progress} tone={tone === 'purple' ? 'blue' : tone}/></div>;
}
function FocusCard({ number, title, description, meta, tag, href, tone }: { number: string; title: string; description: string; meta: string; tag: string; href: string; tone: string }) {
  return <Link href={href} className={`${styles.focusCard} ${styles[`focus_${tone}`]}`}><div className={styles.focusTop}><span>{number}</span><small>{tag} ↗</small></div><h3>{title}</h3><p>{description}</p><div className={styles.focusMeta}><span>◷ {meta}</span><span>→</span></div></Link>;
}

import LearningIntelligence from './learning-intelligence';

function Progress({snapshot,streak,signedIn}:{snapshot:LearnerSnapshot;streak:number;signedIn:boolean}) {
  const mastery = snapshot.mastery || { grammar:0, vocabulary:0, kanji:0, reading:0, kana:0, overallLessons:0 };
  const scores = snapshot.recentScores || [];
  const overallPercentage = Math.max(0, Math.min(100, Number(snapshot.overallPercentage) || 0));
  return <><QuickRevisionStats signedIn={signedIn}/><LearningIntelligence signedIn={signedIn}/><SectionHeading eyebrow="YOUR JOURNEY SO FAR" title="Look how far you’ve come." description="A clear view of your learning habits, topic mastery and exam readiness." action={<span className={styles.counterPill}>N5 learner</span>}/><div className={styles.progressHero}><div><div className={styles.eyebrow}>OVERALL N5 READINESS</div><div className={styles.bigPercent}>{overallPercentage}<span>%</span></div><p>Progress is calculated from completed lessons, reviewed vocabulary, mastered kanji and reading practice.</p></div><div className={styles.progressBarWrap}><div className={styles.progressBarTrack} role="progressbar" aria-label="Overall N5 readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPercentage}><span style={{width:`${overallPercentage}%`}} /></div><span className={styles.progressBarLabel}><strong>{overallPercentage}%</strong> complete</span></div></div><div className={styles.masteryGrid}><Mastery label="Grammar" value={mastery.grammar} tone="green"/><Mastery label="Vocabulary" value={mastery.vocabulary} tone="orange"/><Mastery label="Kanji" value={mastery.kanji} tone="blue" detail={`${snapshot.kanjiMastered} of ${snapshot.kanjiCount} N5 characters marked known`}/><Mastery label="Reading" value={mastery.reading} tone="purple"/><Mastery label="Kana" value={mastery.kana} tone="green"/><Mastery label="Lessons" value={mastery.overallLessons} tone="orange"/></div><div className={styles.progressBottom}><div className={styles.panel}><div className={styles.eyebrow}>STUDY CONSISTENCY</div><h3>{streak}-day learning streak</h3><p>Complete a lesson, quiz or revision session to add a learning day.</p><div className={styles.weekDots}>{['M','T','W','T','F','S','S'].map((d,i)=><div className={styles.dayEmpty} key={`${d}${i}`}><span>{d}</span><b>·</b></div>)}</div></div><div className={styles.panel}><div className={styles.eyebrow}>RECENT TEST SCORES</div><h3>{scores.length ? 'Your latest results' : 'Your exam history will appear here.'}</h3><div className={styles.scoreBars}>{scores.slice(0,7).map((value:number,i:number)=><div key={i}><span style={{height:`${value}%`}}/><small>{i+1}</small></div>)}</div></div></div></>;
}
function Mastery({label,value,tone,detail}:{label:string;value:number;tone:Tone;detail?:string}){return <div className={styles.masteryCard}><div><strong>{label}</strong><b>{value}%</b></div><ProgressBar value={value} tone={tone}/><small>{detail ?? (value>=80?'Strong progress':value>=50?'Building confidence':'More practice recommended')}</small></div>}

