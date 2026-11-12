'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './learning-app.module.css';
import { QuickRevisionStats } from './quick-revision';
import Brand from './brand';
import LearningIntelligence from './learning-intelligence';
import LearningPlans from './learning-plans';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { getDaysUntilJlpt } from '@/lib/nihongo/jlpt-countdown';
import { JlptLevelSwitch, ProgressBar, SectionHeading, type JlptLevel, type Tone } from './learning-shared';
import type { LearningFeatureProps } from './learning-features';
import { applyStudyTimeCredit } from '@/lib/nihongo/activity-snapshot';
import { createPreviewSnapshot, getPublishedFlashcards, getPublishedGrammar, loadLearnerSnapshot, type LearnerFlashcard, type LearnerSnapshot } from '@/lib/nihongo/data';
import { grammar as demoGrammar, kanji as demoKanji, vocabulary as demoVocabulary } from '@/lib/nihongo/demo-content';
import type { GrammarItem } from '@/lib/nihongo/demo-content';

type Props = { section?: string[] };
type GlobalSearchResult = { id: string; kind: string; level: string; title: string; detail: string; href: string };
const LazyLearningFeature = lazy(() => import('./learning-features').then((module) => ({ default: module.LearningFeature })));

const navGroups = [
  { label: 'LEARN', items: [
    { key: 'overview', title: 'Overview', href: '/learn', icon: '◫' },
    { key: 'grammar', title: 'Grammar', href: '/learn/grammar', icon: '文' },
    { key: 'vocabulary', title: 'Vocabulary', href: '/learn/vocabulary', icon: '語' },
    { key: 'kanji', title: 'Kanji', href: '/learn/kanji', icon: '字' },
    { key: 'kana', title: 'Hiragana & Katakana', href: '/learn/kana', icon: 'あ' },
  ] },
  { label: 'PRACTICE', items: [
    { key: 'practice', title: 'Daily practice', href: '/learn/practice', icon: '✳' },
    { key: 'sentences', title: 'Sentence construction', href: '/learn/sentences', icon: '文' },
    { key: 'flashcards', title: 'Flashcards', href: '/learn/flashcards', icon: '▤' },
    { key: 'reading', title: 'Reading', href: '/learn/reading', icon: '読' },
    { key: 'exams', title: 'Mock exams', href: '/learn/exams', icon: '◷' },
  ] },
  { label: 'YOUR SPACE', items: [
    { key: 'progress', title: 'My progress', href: '/learn/progress', icon: '↗' },
    { key: 'plans', title: 'Plans', href: '/learn/plans', icon: '₹' },
    { key: 'subscription', title: 'Membership', href: '/learn/subscription', icon: '◇' },
  ] },
];

function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span aria-hidden="true" className={styles.icon + ' ' + className}>{children}</span>;
}

export default function LearningApp({ section = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = section[0] || 'overview';
  const focusedVocabularyId = active === 'vocabulary' ? searchParams.get('focus') || undefined : undefined;
  const focusedVocabularyLevel = focusedVocabularyId
    ? (searchParams.get('level') === 'N4' ? 'N4' : searchParams.get('level') === 'N5' ? 'N5' : undefined)
    : undefined;
  const isExcludedStudySection = active === 'reading' || active === 'exams';
  const isExcludedStudySectionRef = useRef(isExcludedStudySection);
  const studyEligibilityChangeRef = useRef<(() => void) | null>(null);
  const [name, setName] = useState('Learner');
  const [signedIn, setSignedIn] = useState(false);
  const [activityTrackingNotice, setActivityTrackingNotice] = useState('');
  const studyTimerRef = useRef<HTMLSpanElement>(null);
  const [connected, setConnected] = useState(false);
  const authGenerationRef = useRef(0);
  const [authViewKey, setAuthViewKey] = useState(0);
  const [snapshot, setSnapshot] = useState<LearnerSnapshot>({
    displayName: 'Learner', preferredJlptLevel: 'N5',
    grammarCount: 0, grammarUnderstood: 0,
    vocabularyCount: 0, vocabularyMastered: 0,
    kanjiCount: 0, kanjiMastered: 0,
    grammarAttempts: 0, kanaAttempts: 0, readingAttempts: 0,
    activeDays: [], lessonsCompleted: 0, lessonsTotal: 0, recentScores: [], overallPercentage: 0,
    mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
    streak: 0, due: { vocabulary: 0, flashcards: 0, total: 0 },
    dailyGoal: { minutes: 15, studiedSeconds: 0 }, totalStudySeconds: 0,
    premiumActive: false, showRomaji: true, showFurigana: true, recentActivity: [], source: 'preview',
  });
  const [grammarData, setGrammarData] = useState<GrammarItem[]>(demoGrammar);
  const [flashcardData, setFlashcardData] = useState<LearnerFlashcard[]>([]);
  const [romaji, setRomaji] = useState(true);
  const refreshLearnerSnapshot = useCallback(async () => {
    const generation = authGenerationRef.current;
    try {
      const nextSnapshot = await loadLearnerSnapshot();
      // Ignore a response that started before the latest sign-in/sign-out event.
      if (generation !== authGenerationRef.current) return;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [kanaMode, setKanaMode] = useState<'hiragana' | 'katakana'>('hiragana');
  const [kanaQuiz, setKanaQuiz] = useState(false);

  useEffect(() => {
    isExcludedStudySectionRef.current = isExcludedStudySection;
    studyEligibilityChangeRef.current?.();
  }, [isExcludedStudySection]);

  useEffect(() => {
    const renderTimer = (elapsedMilliseconds: number) => {
      if (!studyTimerRef.current) return;
      const elapsedSeconds = isExcludedStudySection ? 0 : Math.floor(Math.max(0, elapsedMilliseconds) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      studyTimerRef.current.textContent = `Study · ${minutes}:${String(seconds).padStart(2, '0')}`;
      studyTimerRef.current.setAttribute(
        'aria-label',
        isExcludedStudySection
          ? 'Study timer paused'
          : `Elapsed website study time ${minutes} minutes and ${seconds} seconds`,
      );
    };
    const readSavedTimer = () => {
      try {
        const raw = window.localStorage.getItem('nihongo:quick-revision:timer:v1');
        if (!raw) return 0;
        const saved = JSON.parse(raw) as { sessionElapsedMs?: unknown };
        return typeof saved.sessionElapsedMs === 'number' && Number.isFinite(saved.sessionElapsedMs)
          ? Math.max(0, saved.sessionElapsedMs)
          : 0;
      } catch {
        return 0;
      }
    };
    const handleTimerUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionElapsedMs?: number }>).detail;
      renderTimer(typeof detail?.sessionElapsedMs === 'number' ? detail.sessionElapsedMs : readSavedTimer());
    };
    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key === 'nihongo:quick-revision:timer:v1') renderTimer(readSavedTimer());
    };
    window.addEventListener('nihongo:quick-revision-timer', handleTimerUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    renderTimer(readSavedTimer());
    return () => {
      window.removeEventListener('nihongo:quick-revision-timer', handleTimerUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [signedIn, isExcludedStudySection]);


  useEffect(() => {
    const query = search.trim();
    if (!searchOpen || query.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');
      fetch('/api/learning/search?q=' + encodeURIComponent(query), {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      }).then(async (response) => {
        const body = await response.json() as { items?: GlobalSearchResult[]; error?: string };
        if (!response.ok) throw new Error(body.error || 'Search is unavailable right now.');
        return body.items ?? [];
      }).then(setSearchResults).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search is unavailable right now.');
      }).finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    }, 220);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [search, searchOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      } else if (event.key === 'Escape') {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    let alive = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const load = async () => {
      const generation = authGenerationRef.current;
      try {
        const authPromise = client.auth.getUser();
        const [authResult, dataSnapshot] = await Promise.all([
          authPromise,
          authPromise.then(({ data }) => loadLearnerSnapshot(data.user)),
        ]);
        const user = authResult.data.user;
        if (!alive || generation !== authGenerationRef.current) return;
        setConnected(true);
        setSignedIn(Boolean(user));
        if (user) {
          setName(dataSnapshot.displayName || user.email?.split('@')[0] || 'Learner');
        } else {
          setName('Learner');
          setActivityTrackingNotice('');
        }
        setRomaji(dataSnapshot.showRomaji);
        setSnapshot(dataSnapshot);
      } catch {
        // Keep the public demo available if session lookup temporarily fails.
        if (!alive || generation !== authGenerationRef.current) return;
        setConnected(true);
        setSignedIn(false);
        setName('Learner');
        setRomaji(true);
        setSnapshot(createPreviewSnapshot());
      }
    };
    void load();
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      authGenerationRef.current += 1;
      setAuthViewKey((current) => current + 1);
      setConnected(true);
      setSignedIn(Boolean(session?.user));
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          // Do not show a previous account's snapshot while the new profile loads.
          setSnapshot(createPreviewSnapshot());
          setName('Learner');
          setRomaji(true);
        }
        // Supabase may emit TOKEN_REFRESHED when a background tab becomes active.
        // Reload the profile rather than replacing the saved display name with email.
        window.setTimeout(() => {
          if (alive) void refreshLearnerSnapshot();
        }, 0);
      } else {
        // A signed-out workspace is demo mode, never the last account's dashboard.
        setSnapshot(createPreviewSnapshot());
        setRomaji(true);
        setName('Learner');
        setActivityTrackingNotice('');
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [refreshLearnerSnapshot]);

  const grammarContentLoaded = useRef(false);
  const flashcardContentLoaded = useRef(false);

  useEffect(() => {
    if (active === 'grammar' && !grammarContentLoaded.current) {
      grammarContentLoaded.current = true;
      void getPublishedGrammar().then((rows) => {
        if (rows.length) setGrammarData(rows);
      });
    }
    if (active === 'flashcards' && !flashcardContentLoaded.current) {
      flashcardContentLoaded.current = true;
      void getPublishedFlashcards().then((rows) => setFlashcardData(rows));
    }
  }, [active]);

  useEffect(() => {
    if (!signedIn) return;

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

    // Count only while this site tab is visible and focused; Reading and Mock Exams are exempt.
    const isEligible = () => !isExcludedStudySectionRef.current &&
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

    const isStudyEligible = () => isEligible();

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
          // Count only time accumulated by the foreground, focused browser tab.
          const sampledMilliseconds = elapsed;
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
      if (isEligible()) acquireStudyLock();
      else stopActiveLoop?.();
    };
    const handlePageHide = () => stopActiveLoop?.();

    studyEligibilityChangeRef.current = handleEligibilityChange;
    document.addEventListener('visibilitychange', handleEligibilityChange);
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
      if (studyEligibilityChangeRef.current === handleEligibilityChange) {
        studyEligibilityChangeRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleEligibilityChange);
      window.removeEventListener('focus', handleEligibilityChange);
      window.removeEventListener('blur', handleEligibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      stopActiveLoop?.();
    };
  }, [signedIn]);

  const titleMap: Record<string, string> = { overview: 'Overview', grammar: 'Grammar studio', vocabulary: 'Vocabulary', kanji: 'Kanji library', kana: 'Kana practice', practice: 'Daily practice', flashcards: 'Flashcard review', reading: 'Reading room', exams: 'Mock examinations', sentences: 'Sentence construction lab', progress: 'Your progress', plans: 'Learning plans', subscription: 'Membership' };
  const title = titleMap[active] || 'Overview';

  const changePreferredLevel = useCallback(async (level: JlptLevel) => {
    setSnapshot((current) => ({ ...current, preferredJlptLevel: level }));
    if (!signedIn) return;
    try {
      const response = await fetch('/api/learning/settings', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredJlptLevel: level }),
      });
      if (!response.ok) throw new Error('Could not save your selected JLPT level.');
    } catch {
      await refreshLearnerSnapshot();
      setActivityTrackingNotice('Your JLPT level preference could not be saved. Please try again.');
    }
  }, [signedIn, refreshLearnerSnapshot]);

  function openSearchResult(result: GlobalSearchResult) {
    router.push(result.href);
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setActivityTrackingNotice('Authentication is temporarily unavailable. Please try again.');
      return;
    }
    const { error } = await client.auth.signOut();
    if (error) {
      setActivityTrackingNotice(error.message);
      return;
    }
    // Browser signOut clears the same cookie-backed storage used by the
    // persistent client and emits SIGNED_OUT to GlobalQuickRevision.
    window.dispatchEvent(new Event('nihongo:auth-signed-out'));
    authGenerationRef.current += 1;
    setAuthViewKey((current) => current + 1);
    setSignedIn(false);
    setSnapshot(createPreviewSnapshot());
    setRomaji(true);
    setName('Learner');
    setActivityTrackingNotice('');
    router.push('/login');
  }



    const streak = signedIn ? snapshot.streak : 0;

  return (
    <div className={styles.appFrame}>
      <aside className={styles.sidebar}>
        <Brand href="/learn" tone="dark" className={styles.sidebarBrand} />
        <div className={styles.levelCard}><div className={styles.levelKicker}>YOUR CURRENT FOCUS</div><div className={styles.levelTitle}>JLPT {snapshot.preferredJlptLevel} <span>SELECTED</span></div><div className={styles.levelFoot}><span>Learn at your pace</span><span>✳</span></div></div>
        <nav className={styles.navigation} aria-label="Learning navigation">
          {navGroups.map((group) => <div className={styles.navGroup} key={group.label}><div className={styles.navLabel}>{group.label}</div>{group.items.map((item) => {
            const selected = item.key === 'overview' ? active === 'overview' : active === item.key;
            return <Link key={item.key} href={item.href} className={`${styles.navLink} ${selected ? styles.navActive : ''}`}><Icon>{item.icon}</Icon><span>{item.title}</span>{item.key === 'flashcards' && snapshot.due.flashcards > 0 && <em>{snapshot.due.flashcards}</em>}</Link>;
          })}</div>)}
        </nav>
        <div className={styles.sidebarBottom}><div className={styles.helpCard}><div className={styles.helpIcon}>?</div><strong>Ideas or issues?</strong><p>Share a suggestion, report a problem or tell us how we can improve.</p><Link href="/contact">Send feedback <span>↗</span></Link><Link href="/learn/reading">Open study guide <span>↗</span></Link></div><div className={styles.sidebarUser}><div className={styles.avatar}>{name.slice(0,1).toUpperCase()}</div><div className={styles.userMeta}><strong>{name}</strong><span>{signedIn ? (snapshot.premiumActive ? 'Premium member' : 'Free learner') : 'Preview learner'}</span></div><button type="button" aria-label="Account" onClick={() => router.push(signedIn ? '/learn/subscription' : '/login')}>···</button></div></div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}><div className={styles.breadcrumb}>Workspace <span>/</span> <strong>{title}</strong></div><div className={styles.topActions}><div className={styles.searchWrap}><label className={styles.searchBox}><span>⌕</span><input ref={searchInputRef} value={search} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter" && searchResults[0]) { event.preventDefault(); openSearchResult(searchResults[0]); } }} placeholder="Search lessons, words..."/><kbd>⌘ K</kbd></label>{searchOpen && search.trim().length >= 2 ? <div className={styles.searchResults} role="listbox" aria-label="Search results">{searchLoading ? <div className={styles.searchState}>Searching your learning library…</div> : searchError ? <div className={styles.searchState} role="status">{searchError}</div> : searchResults.length ? searchResults.map((result) => <button type="button" role="option" aria-selected="false" key={result.kind + "-" + result.id} className={styles.searchResult} onClick={() => openSearchResult(result)}><span className={styles.searchResultMeta}>{result.kind}{result.level ? " · " + result.level : ""}</span><strong>{result.title}</strong><small>{result.detail}</small></button>) : <div className={styles.searchState}>No matches found. Try a Japanese word, meaning or grammar pattern.</div>}</div> : null}</div>{signedIn ? <Link href="/contact" className={styles.feedbackLink}>Contact us</Link> : null}{signedIn ? <span ref={studyTimerRef} className={styles.counterPill} aria-label={isExcludedStudySection ? 'Study timer paused' : 'Elapsed website study time'} title={isExcludedStudySection ? 'Study timer paused in this section' : 'Elapsed active time on Nihongo Labs'}>Study · 0:00</span> : null}<button className={styles.iconButton} type="button" aria-label="Notifications">♧<i /></button><div className={styles.topAvatar}>{name.slice(0,1).toUpperCase()}</div>{signedIn ? <button className={styles.signOutButton} onClick={signOut}>Sign out</button> : <Link className={styles.signInButton} href="/login">Sign in</Link>}</div></header>
        <div className={styles.contentArea}>
          {!connected && <div className={styles.previewNotice}><span>●</span> Preview mode <span className={styles.noticeDivider}>·</span> Connect your local Supabase keys to load your saved learning data.</div>}
          {connected && !signedIn && <div className={styles.previewNotice}><span>●</span> Demo content <span className={styles.noticeDivider}>·</span> Sign in to load your personal progress.</div>}
          {active === 'overview' && <Dashboard key={`${signedIn ? 'signed-in' : 'demo'}-${authViewKey}-${snapshot.preferredJlptLevel}`} name={name} signedIn={signedIn} snapshot={snapshot} streak={streak} activityTrackingNotice={signedIn ? activityTrackingNotice : ''} onLevelChange={changePreferredLevel} onContinue={() => router.push('/learn/grammar')} />}
          {active === 'plans' && <LearningPlans signedIn={signedIn} />}
          {active !== 'overview' && active !== 'progress' && active !== 'plans' && <Suspense fallback={<div className={styles.emptyState} role="status"><div>読</div><h2>Loading learning tools…</h2></div>}><LazyLearningFeature key={`${snapshot.preferredJlptLevel}-${focusedVocabularyId ?? ''}-${focusedVocabularyLevel ?? ''}`} active={active as LearningFeatureProps['active']} grammarItems={grammarData} vocabularyItems={demoVocabulary} search={search} focusedVocabularyId={focusedVocabularyId} focusedVocabularyLevel={focusedVocabularyLevel} kanjiItems={demoKanji} flashcardItems={flashcardData} signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} kanaMode={kanaMode} setKanaMode={setKanaMode} kanaQuiz={kanaQuiz} setKanaQuiz={setKanaQuiz} preferredLevel={snapshot.preferredJlptLevel === 'N4' ? 'N4' : 'N5'} onPreferredLevelChange={changePreferredLevel} onProgressSaved={refreshLearnerSnapshot} /></Suspense>}
          {active === 'progress' && <Progress key={`${signedIn ? 'signed-in' : 'demo'}-${authViewKey}`} snapshot={snapshot} streak={streak} signedIn={signedIn} />}
        </div>
        <footer className={styles.footer}><span>© 2026 Nihongo Labs</span><span>Made for curious minds <b>✳</b></span><span>Japanese learning, at your pace</span></footer>
      </main>
    </div>
  );
}

type DashboardLevelProgress = {
  level: JlptLevel;
  vocabulary: { completed: number; total: number };
  kanji: { completed: number; total: number };
  grammar: { completed: number; total: number };
  lessons: { completed: number; total: number };
  readiness: number;
};

function Dashboard({ name, signedIn, snapshot, streak, activityTrackingNotice, onLevelChange, onContinue }: {
  name: string;
  signedIn: boolean;
  snapshot: LearnerSnapshot;
  streak: number;
  activityTrackingNotice: string;
  onContinue: () => void;
  onLevelChange: (level: JlptLevel) => Promise<void>;
}) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [greeting, setGreeting] = useState('こんにちは');
  const [level, setLevel] = useState<JlptLevel>(snapshot.preferredJlptLevel === 'N4' ? 'N4' : 'N5');
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

  const words = Number(snapshot.vocabularyCount ?? 0);
  const kanjiCount = Number(snapshot.kanjiCount ?? 0);
  const currentProgress = signedIn && levelProgress?.level === level ? levelProgress : null;
  const ready = currentProgress?.readiness ?? 0;
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
      <div className={styles.jlptCountdown} aria-label={`JLPT ${level} examination countdown`}>
        <span className={styles.jlptCountdownKicker}>NEXT JLPT · {level}</span>
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
        <div className={styles.heroMeta}><span>◷ Daily practice</span><span>•</span><span>JLPT {level} · Your pace</span></div>
      </div>
      <div className={styles.heroArt}><div className={styles.sunDisc} /><div className={styles.heroKanji}>学</div><div className={styles.heroArtNote}>MANABU <span>·</span> TO LEARN</div></div>
    </section>
    <div className={styles.sectionTop}>
      <div><div className={styles.eyebrow}>YOUR LEARNING PULSE</div><h2>Progress at a glance</h2></div>
      <div className={styles.dashboardLevelControl}>
        <JlptLevelSwitch value={level} onChange={(nextLevel) => { setLevel(nextLevel); void onLevelChange(nextLevel); }} label="Dashboard JLPT level" />
        <Link href="/learn/progress" className={styles.textLink}>View full report <span>→</span></Link>
      </div>
    </div>
    <section className={styles.statsGrid}>
      <StatCard icon="◉" label={`${level} learning progress`} value={`${ready}%`} note="Grammar, words, kanji and lessons" progress={ready} tone="green" />
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
      <FocusCard number="03" title="A short Japanese story" description="Read a graded passage and check your understanding." meta="Reading · 6 min" tag="NEW" href="/learn/reading" tone="blue"/>
    </section>
  </>;
}
function StatCard({ icon, label, value, note, progress, tone }: { icon: string; label: string; value: string; note: string; progress: number; tone: Tone }) {
  return <div className={styles.statCard}><div className={styles.statTop}><span className={`${styles.statIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><span className={styles.statMore}>···</span></div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statNote}>{note}</div><ProgressBar value={progress} tone={tone === 'purple' ? 'blue' : tone}/></div>;
}
function FocusCard({ number, title, description, meta, tag, href, tone }: { number: string; title: string; description: string; meta: string; tag: string; href: string; tone: string }) {
  return <Link href={href} className={`${styles.focusCard} ${styles[`focus_${tone}`]}`}><div className={styles.focusTop}><span>{number}</span><small>{tag} ↗</small></div><h3>{title}</h3><p>{description}</p><div className={styles.focusMeta}><span>◷ {meta}</span><span>→</span></div></Link>;
}


type GrammarLevelProgress = { grammarIds: string[]; total: number; understood: number; attempts: number; correct: number; accuracy: number };
type SentenceProgressSummary = { totalSentences:number; totalAttempts:number; correctAttempts:number; accuracy:number; attemptedSentences:number; solvedSentences:number; migrationRequired?:boolean };

function Progress({snapshot,streak,signedIn}:{snapshot:LearnerSnapshot;streak:number;signedIn:boolean}) {
  const [sentenceProgress, setSentenceProgress] = useState<Record<'N5'|'N4', SentenceProgressSummary> | null>(null);
  const [grammarProgress, setGrammarProgress] = useState<Record<'N5'|'N4', GrammarLevelProgress> | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void Promise.all((['N5', 'N4'] as const).map(async (level) => {
      const response = await fetch('/api/learning/sentence-construction?level=' + level, { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json() as SentenceProgressSummary & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Sentence progress is unavailable.');
      return [level, body] as const;
    })).then(([n5, n4]) => {
      if (active) setSentenceProgress({ N5: n5[1], N4: n4[1] });
    }).catch(() => { if (active) setSentenceProgress(null); });
  
  useEffect(() => {
    if (!signedIn) { setGrammarProgress(null); return; }
    let active = true;
    void Promise.all((['N5', 'N4'] as const).map(async (level) => {
      const response = await fetch('/api/learning/grammar-progress?level=' + level, {
        credentials: 'same-origin', cache: 'no-store',
      });
      const body = await response.json() as GrammarLevelProgress & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Grammar progress is unavailable.');
      return [level, body] as const;
    })).then(([n5, n4]) => {
      if (active) setGrammarProgress({ N5: n5[1], N4: n4[1] });
    }).catch(() => { if (active) setGrammarProgress(null); });
    return () => { active = false; };
  }, [signedIn]);

  return () => { active = false; };
  }, [signedIn]);
  const mastery = snapshot.mastery || { grammar:0, vocabulary:0, kanji:0, reading:0, kana:0, overallLessons:0 };
  const scores = snapshot.recentScores || [];
  const overallPercentage = Math.max(0, Math.min(100, Number(snapshot.overallPercentage) || 0));
  const weekDays = useMemo(() => {
    const activeDates = new Set(snapshot.activeDays ?? []);
    const timeZone = snapshot.timeZone || 'Asia/Kolkata';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    const year = Number(part('year'));
    const month = Number(part('month'));
    const day = Number(part('day'));
    const today = new Date(Date.UTC(year, month - 1, day));
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const firstDay = new Date(today.getTime() - 6 * millisecondsPerDay);
    const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(firstDay.getTime() + index * millisecondsPerDay);
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      return { date: dateKey, label: weekdayLabels[date.getUTCDay()], active: activeDates.has(dateKey) };
    });
  }, [snapshot.activeDays, snapshot.timeZone]);
  return <><QuickRevisionStats signedIn={signedIn}/><LearningIntelligence signedIn={signedIn}/><SectionHeading eyebrow="YOUR JOURNEY SO FAR" title="Look how far you’ve come." description="A clear view of your learning habits, topic mastery and exam readiness." action={<span className={styles.counterPill}>N5 learner</span>}/><div className={styles.progressHero}><div><div className={styles.eyebrow}>OVERALL N5 READINESS</div><div className={styles.bigPercent}>{overallPercentage}<span>%</span></div><p>Progress is calculated from assessed lessons, learned vocabulary, understood grammar, known kanji and graded reading/Kana practice.</p></div><div className={styles.progressBarWrap}><div className={styles.progressBarTrack} role="progressbar" aria-label="Overall N5 readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPercentage}><span style={{width:`${overallPercentage}%`}} /></div><span className={styles.progressBarLabel}><strong>{overallPercentage}%</strong> complete</span></div></div><div className={styles.masteryGrid}><Mastery label="Grammar" value={mastery.grammar} tone="green" detail={`${snapshot.grammarUnderstood} of ${snapshot.grammarCount} N5 grammar points marked understood`}/><Mastery label="Vocabulary" value={mastery.vocabulary} tone="orange" detail={`${snapshot.vocabularyMastered} of ${snapshot.vocabularyCount} N5 words learned or mastered`}/><Mastery label="Kanji" value={mastery.kanji} tone="blue" detail={`${snapshot.kanjiMastered} of ${snapshot.kanjiCount} N5 characters marked known`}/><Mastery label="Reading" value={mastery.reading} tone="purple" detail={snapshot.readingAttempts ? `${snapshot.readingAttempts} graded reading attempts` : 'Complete a graded reading check to record progress'}/><Mastery label="Kana" value={mastery.kana} tone="green" detail={snapshot.kanaAttempts ? `${snapshot.kanaAttempts} graded Kana attempts` : 'Complete a Kana challenge to record progress'}/><Mastery label="Lessons" value={mastery.overallLessons} tone="orange" detail={`${snapshot.lessonsCompleted} of ${snapshot.lessonsTotal} assessed N5 lessons completed`}/></div><section className={styles.grammarProgressPanel}>
      <div className={styles.sentenceProgressHeading}>
        <div><div className={styles.eyebrow}>GRAMMAR MASTERY</div><h2>Grammar progress by JLPT level</h2><p>Lesson completion and practice performance are tracked separately.</p></div>
        <Link href="/learn/grammar" className={styles.textLink}>Study grammar <span>→</span></Link>
      </div>
      {!signedIn ? <p className={styles.sentenceProgressEmpty}>Sign in to track your grammar lessons and practice attempts.</p>
        : grammarProgress ? <div className={styles.grammarProgressLevels}>
          {(['N5', 'N4'] as const).map((level) => {
            const row = grammarProgress[level];
            const percent = row.total ? Math.min(100, (row.understood / row.total) * 100) : 0;
            return <article className={styles.grammarProgressLevel} key={level}>
              <div className={styles.grammarProgressTop}><strong>{level}</strong><span>{row.understood} / {row.total} understood</span></div>
              <div className={styles.sentenceProgressBar}><span style={{ width: percent + '%' }} /></div>
              <footer><span>{row.attempts} attempts</span><span>{row.accuracy}% accuracy</span></footer>
            </article>;
          })}
        </div> : <p className={styles.sentenceProgressEmpty}>Grammar progress is loading. Apply the grammar migrations locally to enable this report.</p>}
    </section><section className={styles.sentenceProgressPanel}>
    <div className={styles.sentenceProgressHeading}>
      <div><div className={styles.eyebrow}>SENTENCE CONSTRUCTION</div><h2>Build confidence, one sentence at a time.</h2><p>Your saved sentence attempts are included in your learning profile and grammar weakness analysis.</p></div>
      <Link href="/learn/sentences" className={styles.textLink}>Practise sentences <span>→</span></Link>
    </div>
    {!signedIn ? <p className={styles.sentenceProgressEmpty}>Sign in to track sentence construction across N5 and N4.</p>
      : sentenceProgress ? <div className={styles.sentenceProgressLevels}>{(['N5', 'N4'] as const).map((level) => {
        const row = sentenceProgress[level];
        const solvedPercent = row.totalSentences ? Math.min(100, row.solvedSentences / row.totalSentences * 100) : 0;
        return <article className={styles.sentenceProgressLevel} key={level}>
          <div><strong>{level}</strong><span>{row.solvedSentences} / {row.totalSentences} solved</span></div>
          <div className={styles.sentenceProgressBar}><span style={{width: solvedPercent + '%'}} /></div>
          <footer><span>{row.accuracy}% accuracy</span><span>{row.totalAttempts} attempts</span></footer>
        </article>;
      })}</div>
      : <p className={styles.sentenceProgressEmpty}>Sentence progress is loading.</p>}
    {signedIn && (sentenceProgress?.N5.migrationRequired || sentenceProgress?.N4.migrationRequired) ? <p className={styles.sentenceProgressEmpty}>Apply <code>20261110120000_sentence_construction_intelligence.sql</code> to enable saved attempts.</p> : null}
  </section><div className={styles.progressBottom}><div className={styles.panel}><div className={styles.eyebrow}>STUDY CONSISTENCY</div><h3>{streak}-day learning streak</h3><p>Complete a lesson, quiz or revision session to add a learning day.</p><div className={styles.weekDots}>{weekDays.map((day)=><div className={day.active ? styles.dayDone : styles.dayEmpty} key={day.date} title={`${day.label} · ${day.date} · ${day.active ? 'Learning activity recorded' : 'No learning activity recorded'}`}><span>{day.label}</span><b aria-hidden="true">{day.active ? '✓' : '·'}</b></div>)}</div></div><div className={styles.panel}><div className={styles.eyebrow}>RECENT TEST SCORES</div><h3>{scores.length ? 'Your latest results' : 'Your exam history will appear here.'}</h3><div className={styles.scoreBars}>{scores.slice(0,7).map((value:number,i:number)=><div key={i}><span style={{height:`${value}%`}}/><small>{i+1}</small></div>)}</div></div></div></>;
}
function Mastery({label,value,tone,detail}:{label:string;value:number;tone:Tone;detail?:string}){return <div className={styles.masteryCard}><div><strong>{label}</strong><b>{value}%</b></div><ProgressBar value={value} tone={tone}/><small>{detail ?? (value>=80?'Strong progress':value>=50?'Building confidence':'More practice recommended')}</small></div>}

