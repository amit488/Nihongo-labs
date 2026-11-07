'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './learning-app.module.css';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { getDaysUntilJlpt } from '@/lib/nihongo/jlpt-countdown';
import { getPublishedFlashcards, getPublishedGrammar, getPublishedKanji, getPublishedVocabulary, getReadingPassages, loadLearnerSnapshot, type LearnerFlashcard, type LearnerSnapshot, type ReadingPassage } from '@/lib/nihongo/data';
import { signOutAction } from '@/app/actions/auth';
import { grammar as demoGrammar, kanji as demoKanji, vocabulary as demoVocabulary, kanaRows, katakanaRows, kanaRomajiRows, hiraganaVoicedRows, hiraganaVoicedRomajiRows, katakanaVoicedRows, katakanaVoicedRomajiRows } from '@/lib/nihongo/demo-content';
import type { GrammarItem, KanjiItem, VocabularyItem } from '@/lib/nihongo/demo-content';

type Props = { section?: string[] };
type Tone = 'green' | 'orange' | 'blue' | 'purple';
type RazorpayPaymentResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayFailure = { error?: { description?: string } };
type RazorpayCheckoutOptions = {
  key: string; amount: number; currency: string; name: string; description: string;
  order_id: string; theme: { color: string };
  handler: (payment: RazorpayPaymentResult) => void | Promise<void>;
};
type RazorpayCheckout = {
  open: () => void;
  on: (event: 'payment.failed', callback: (payload: RazorpayFailure) => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckout;
  }
}
type MembershipPlan = {
  id: string; code: string; name: string; description: string | null;
  planKind: string; amountMinor: number; currency: string;
  billingInterval: string; intervalCount: number;
  features: Array<{ key: string; value: unknown }>;
};
type MembershipSubscription = {
  id: string; status: string; current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscription_plans: { name: string | null; billing_interval: string | null } | null;
};
type MembershipStatus = { hasPremium: boolean; subscriptions: MembershipSubscription[] };
type CheckoutResponse = {
  mode: 'subscription' | 'order'; checkoutUrl?: string; orderId?: string; keyId?: string;
  amountMinor?: number; currency?: string; planName?: string; error?: string;
};


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
  return <span aria-hidden="true" className={`${styles.icon} ${className}`}>{children}</span>;
}

function ProgressBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'orange' | 'blue' | 'purple' }) {
  return <div className={`${styles.progressTrack} ${tone === 'orange' ? styles.progressOrange : tone === 'blue' ? styles.progressBlue : tone === 'purple' ? styles.progressPurple : ''}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export default function LearningApp({ section = [] }: Props) {
  const router = useRouter();
  const active = section[0] || 'overview';
  const isStudySection = ['grammar', 'vocabulary', 'kanji', 'kana', 'practice', 'flashcards', 'reading', 'exams'].includes(active);
  const [name, setName] = useState('Learner');
  const [signedIn, setSignedIn] = useState(false);
  const [activityTrackingNotice, setActivityTrackingNotice] = useState('');
  const [liveStudySeconds, setLiveStudySeconds] = useState(0);
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
  const [vocabData, setVocabData] = useState<VocabularyItem[]>(demoVocabulary);
  const [kanjiData, setKanjiData] = useState<KanjiItem[]>(demoKanji);
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
      const [{ data: { user } }, dataSnapshot, grammarRows, vocabRows, kanjiRows, flashcardRows] = await Promise.all([
        client.auth.getUser(), loadLearnerSnapshot(), getPublishedGrammar(), getPublishedVocabulary(), getPublishedKanji(), getPublishedFlashcards(),
      ]);
      if (!alive) return;
      setConnected(true);
      if (user) {
        setSignedIn(true);
        setName(dataSnapshot.displayName || user.email?.split('@')[0] || 'Learner');
      }
      setRomaji(dataSnapshot.showRomaji);
      setSnapshot(dataSnapshot);
      if (grammarRows.length) setGrammarData(grammarRows);
      if (vocabRows.length) setVocabData(vocabRows);
      if (kanjiRows.length) setKanjiData(kanjiRows);
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
    let fallbackPendingState: { milliseconds: number; requestId: string | null } = { milliseconds: 0, requestId: null };
    let lockRequestPending = false;
    let currentSend: Promise<void> | null = null;
    let retryAfter = 0;
    let retryTimer: number | null = null;
    let stopActiveLoop: (() => void) | null = null;

    const isEligible = () =>
      document.visibilityState === 'visible' && document.hasFocus();

    // Persist the pending duration and its idempotency key together in one
    // localStorage write. This avoids a crash window between subtracting
    // credited seconds and clearing the request key.
    const readPendingState = () => {
      if (!storageKey) return fallbackPendingState;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return fallbackPendingState;
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'number') {
          // Migrate values saved by the first version of this branch.
          return {
            milliseconds: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
            requestId: null,
          };
        }
        if (typeof parsed === 'object' && parsed !== null) {
          const value = parsed as { milliseconds?: unknown; requestId?: unknown };
          return {
            milliseconds:
              typeof value.milliseconds === 'number' &&
              Number.isFinite(value.milliseconds) &&
              value.milliseconds > 0
                ? Math.floor(value.milliseconds)
                : 0,
            requestId:
              typeof value.requestId === 'string' &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)
                ? value.requestId
                : null,
          };
        }
        return { milliseconds: 0, requestId: null };
      } catch {
        return fallbackPendingState;
      }
    };

    const writePendingState = (milliseconds: number, requestId: string | null) => {
      const next = {
        milliseconds: Math.max(0, Math.floor(milliseconds)),
        requestId,
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
        // Continue in memory when storage is unavailable; server-side
        // accounting still limits credits to measured server elapsed time.
      }
    };

    const readPendingMilliseconds = () => readPendingState().milliseconds;

    const getOrCreateRequestId = () => {
      const state = readPendingState();
      if (state.requestId) return state.requestId;
      const requestId = crypto.randomUUID();
      writePendingState(state.milliseconds, requestId);
      return requestId;
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

      const pendingSeconds = Math.floor(readPendingMilliseconds() / 1000);
      if (pendingSeconds < 1 || (!includePartialBatch && pendingSeconds < 30)) return;

      // The server validates this amount against its own heartbeat timestamp.
      // A larger batch lets a previously queued, measured session recover after
      // a temporary network outage or browser restart.
      const requestedSeconds = Math.min(pendingSeconds, 3600);
      const requestId = getOrCreateRequestId();

      const operation = (async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch('/api/learning/activity', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds: requestedSeconds, requestId }),
            keepalive: true,
            cache: 'no-store',
            signal: controller.signal,
          });
          const body = await response.json().catch(() => ({})) as {
            error?: string;
            creditedSeconds?: number;
          };

          if (!response.ok) {
            throw new Error(body.error || 'Study time could not be recorded.');
          }

          const creditedSeconds = Math.max(
            0,
            Math.min(requestedSeconds, Math.floor(Number(body.creditedSeconds ?? 0))),
          );

          if (creditedSeconds > 0) {
            // Subtract only what the database confirms it credited. Any
            // remainder stays queued for a later, server-approved heartbeat.
            writePendingState(
              readPendingMilliseconds() - creditedSeconds * 1000,
              null,
            );
            retryAfter = 0;
            if (!disposed) {
              setActivityTrackingNotice('');
              void refreshLearnerSnapshot();
            }
          } else {
            // Another tab/device may have written more recently. Keep the queue
            // intact and retry instead of losing the learner's measured time.
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
          if (!disposed) setLiveStudySeconds(Math.floor(sessionMilliseconds / 1000));
          const pending = readPendingState();
          writePendingState(
            pending.milliseconds + sampledMilliseconds,
            pending.requestId,
          );
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



  const filteredVocabulary = useMemo(() => vocabData.filter((item) => `${item.word} ${item.kana} ${item.romaji} ${item.meaning}`.toLowerCase().includes(search.toLowerCase())), [vocabData, search]);
  const filteredKanji = useMemo(() => kanjiData.filter((item) => `${item.character} ${item.meaning} ${item.radical}`.toLowerCase().includes(search.toLowerCase())), [kanjiData, search]);
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
        <header className={styles.topbar}><div className={styles.breadcrumb}>Workspace <span>/</span> <strong>{title}</strong></div><div className={styles.topActions}><label className={styles.searchBox}><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lessons, words..."/><kbd>⌘ K</kbd></label>{signedIn && isStudySection ? <span className={styles.counterPill} aria-label={`Active study time ${Math.floor(liveStudySeconds / 60)} minutes and ${liveStudySeconds % 60} seconds`} title="Active time in this study session">Study · {Math.floor(liveStudySeconds / 60)}:{String(liveStudySeconds % 60).padStart(2, '0')}</span> : null}<button className={styles.iconButton} type="button" aria-label="Notifications">♧<i /></button><div className={styles.topAvatar}>{name.slice(0,1).toUpperCase()}</div>{signedIn ? <button className={styles.signOutButton} onClick={signOut}>Sign out</button> : <Link className={styles.signInButton} href="/login">Sign in</Link>}</div></header>
        <div className={styles.contentArea}>
          {!connected && <div className={styles.previewNotice}><span>●</span> Preview mode <span className={styles.noticeDivider}>·</span> Connect your local Supabase keys to load your saved learning data.</div>}
          {connected && !signedIn && <div className={styles.previewNotice}><span>●</span> Demo content <span className={styles.noticeDivider}>·</span> Sign in to load your personal progress.</div>}
          {active === 'overview' && <Dashboard name={name} snapshot={snapshot} streak={streak} activityTrackingNotice={signedIn ? activityTrackingNotice : ''} onContinue={() => router.push('/learn/grammar')} />}
          {active === 'grammar' && <GrammarStudio items={grammarData} romaji={romaji} setRomaji={setRomajiPreference} signedIn={signedIn} />}
          {active === 'practice' && <Practice signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} />}
          {active === 'vocabulary' && <Vocabulary items={filteredVocabulary} romaji={romaji} setRomaji={setRomajiPreference} />}
          {active === 'kanji' && <Kanji items={filteredKanji} onProgressSaved={refreshLearnerSnapshot} />}
          {active === 'kana' && <Kana mode={kanaMode} setMode={setKanaMode} quiz={kanaQuiz} setQuiz={setKanaQuiz} signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} />}
          {active === 'flashcards' && <Flashcards items={flashcardData} signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} />}
          {active === 'reading' && <Reading romaji={romaji} setRomaji={setRomajiPreference} signedIn={signedIn} />}
          {active === 'exams' && <Exams signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} />}
          {active === 'progress' && <Progress snapshot={snapshot} streak={streak} />}
          {active === 'subscription' && <Membership signedIn={signedIn} />}
        </div>
        <footer className={styles.footer}><span>© 2026 Nihongo Labs</span><span>Made for curious minds <b>✳</b></span><span>JLPT N5 · Learning workspace</span></footer>
      </main>
    </div>
  );
}

function Dashboard({ name, snapshot, streak, activityTrackingNotice, onContinue }: { name: string; snapshot: LearnerSnapshot; streak: number; activityTrackingNotice: string; onContinue: () => void }) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  useEffect(() => {
    const updateCountdown = () => setDaysRemaining(getDaysUntilJlpt('2026-12-06', new Date(), 'Asia/Kolkata'));
    const initialUpdate = window.setTimeout(updateCountdown, 0);
    const timer = window.setInterval(updateCountdown, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, []);
  const ready = Number(snapshot.overallPercentage ?? 0);
  const words = Number(snapshot.vocabularyCount ?? 0);
  const kanjiCount = Number(snapshot.kanjiCount ?? 0);
  const minutes = Math.floor(Number(snapshot.dailyGoal?.studiedSeconds ?? 0) / 60);
  const goal = Number(snapshot.dailyGoal?.minutes ?? 15);
  const goalPercent = goal ? Math.min(100, Math.round((minutes / goal) * 100)) : 0;
  const activity = Array.isArray(snapshot.recentActivity) ? snapshot.recentActivity.slice(0, 7).reverse() : [];
  const maximum = Math.max(1, ...activity.map((row) => Number(row.study_seconds ?? 0)));
  const dayLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
  return <>
    <div className={styles.welcomeRow}><div><div className={styles.eyebrow}>YOUR STUDY SPACE</div><h1>おかえりなさい, {name}. <span>ようこそ!</span></h1><p>A little practice every day adds up. Ready to keep your momentum?</p></div><div className={styles.jlptCountdown} aria-label={`JLPT ${snapshot.preferredJlptLevel} examination countdown`}><span className={styles.jlptCountdownKicker}>NEXT JLPT · {snapshot.preferredJlptLevel}</span><strong>{daysRemaining === null ? '—' : daysRemaining === 0 ? 'Today' : daysRemaining > 0 ? daysRemaining : '—'}</strong><span className={styles.jlptCountdownCopy}>{daysRemaining === 0 ? 'Exam day' : daysRemaining !== null && daysRemaining > 0 ? 'days remaining' : 'Date passed'}</span><small className={styles.jlptCountdownDate}>6 December 2026</small></div></div>
    <section className={styles.heroCard}><div className={styles.heroCopy}><div className={styles.heroTag}><span /> YOUR NEXT STEP</div><h2>Small steps.<br/><em>Fluent moments.</em></h2><p>Pick up where you left off and make today count. Your next lesson is ready when you are.</p><button type="button" className={styles.primaryButton} onClick={onContinue}>Continue learning <span>→</span></button><div className={styles.heroMeta}><span>◷ Daily practice</span><span>•</span><span>JLPT N5 · Beginner</span></div></div><div className={styles.heroArt}><div className={styles.sunDisc} /><div className={styles.heroKanji}>学</div><div className={styles.heroArtNote}>MANABU <span>·</span> TO LEARN</div></div></section>
    <div className={styles.sectionTop}><div><div className={styles.eyebrow}>YOUR LEARNING PULSE</div><h2>Progress at a glance</h2></div><Link href="/learn/progress" className={styles.textLink}>View full report <span>→</span></Link></div>
    <section className={styles.statsGrid}>
      <StatCard icon="◉" label="N5 readiness" value={`${ready}%`} note="Based on tracked learning" progress={ready} tone="green" />
      <StatCard icon="語" label="N5 words in library" value={`${words}`} note="Published vocabulary" progress={Math.min(100, words / 800 * 100)} tone="orange" />
      <StatCard icon="字" label="N5 kanji in library" value={`${kanjiCount}`} note="Published kanji" progress={Math.min(100, kanjiCount / 100 * 100)} tone="blue" />
      <StatCard icon="✳" label="Current streak" value={`${streak} days`} note="Days with learning activity" progress={Math.min(100, streak / 30 * 100)} tone="purple" />
    </section>
    <section className={styles.dashboardGrid}><div className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.eyebrow}>CONSISTENCY IS KEY</div><h3>Your study rhythm</h3></div><span className={styles.smallBadge}>Last 7 active days</span></div><div className={styles.chartArea}><div className={styles.chartYAxis}><span>60m</span><span>40m</span><span>20m</span><span>0m</span></div><div className={styles.chartBars}>{(activity.length ? activity : Array.from({length:7},(_,i)=>({activity_date:'',study_seconds:0,key:i}))).map((row,i)=><div className={styles.chartColumn} key={row.activity_date || i}><div className={styles.chartTrack}><span className={styles.chartBar} style={{height:`${Math.max(2,Math.min(100,Number(row.study_seconds ?? 0)/Math.max(3600,maximum)*100))}%`}} /></div><small>{row.activity_date ? dayLabel(row.activity_date) : '—'}</small></div>)}</div></div><div className={styles.chartLegend}><span><i className={styles.legendGreen} /> Study time</span><span className={styles.chartAverage}>Tracked total <strong>{Math.floor(Number(snapshot.totalStudySeconds ?? 0)/60)} min</strong></span></div></div>
      <div className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.eyebrow}>BUILD A DAILY HABIT</div><h3>Your daily goal</h3></div><span className={styles.smallBadge}>Today</span></div><div className={styles.goalContent}><div className={styles.goalRing}><div><strong>{minutes}</strong><span>/ {goal} min</span></div></div><div className={styles.goalText}><strong>{goalPercent >= 100 ? 'Daily goal reached!' : 'Keep your momentum.'}</strong><p>{goalPercent >= 100 ? 'Great work. Your activity has been recorded.' : `${Math.max(0,goal-minutes)} more minutes to reach today's learning goal.`}</p><ProgressBar value={goalPercent} /><div className={styles.goalFoot}><span>{goalPercent}% completed</span><span>{Math.max(0,goal-minutes)} min left</span></div></div></div></div></section>
    {activityTrackingNotice ? <div className={styles.activityTrackingNotice} role="status">Study-time tracking: {activityTrackingNotice}</div> : null}
    <div className={styles.sectionTop}><div><div className={styles.eyebrow}>A GOOD PLACE TO START</div><h2>Today&apos;s focus</h2></div><span className={styles.mutedMeta}>Choose a short activity</span></div>
    <section className={styles.focusGrid}><FocusCard number="01" title="Particles: は vs が" description="Understand the difference between topic and subject markers." meta="Grammar · 8 min" tag="CONTINUE" href="/learn/grammar" tone="green"/><FocusCard number="02" title="Everyday essentials" description="Revise useful words about daily routines." meta="Vocabulary · 6 min" tag="REVIEW" href="/learn/vocabulary" tone="orange"/><FocusCard number="03" title="A short N5 story" description="Read a beginner passage and check your understanding." meta="Reading · 6 min" tag="NEW" href="/learn/reading" tone="blue"/></section>
  </>;
}

function StatCard({ icon, label, value, note, progress, tone }: { icon: string; label: string; value: string; note: string; progress: number; tone: Tone }) {
  return <div className={styles.statCard}><div className={styles.statTop}><span className={`${styles.statIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><span className={styles.statMore}>···</span></div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statNote}>{note}</div><ProgressBar value={progress} tone={tone === 'purple' ? 'blue' : tone}/></div>;
}
function FocusCard({ number, title, description, meta, tag, href, tone }: { number: string; title: string; description: string; meta: string; tag: string; href: string; tone: string }) {
  return <Link href={href} className={`${styles.focusCard} ${styles[`focus_${tone}`]}`}><div className={styles.focusTop}><span>{number}</span><small>{tag} ↗</small></div><h3>{title}</h3><p>{description}</p><div className={styles.focusMeta}><span>◷ {meta}</span><span>→</span></div></Link>;
}

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


function Vocabulary({ items, romaji, setRomaji }: { items: VocabularyItem[]; romaji: boolean; setRomaji: (value: boolean) => void }) {
  const [expanded, setExpanded] = useState<string|null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function review(id: string, quality: number) {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/learning/vocabulary-review', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vocabularyId: id, quality }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save vocabulary review.');
      setNotice(`Revision saved · next review ${new Date(body.state.due_at).toLocaleDateString()}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save review.'); }
    finally { setBusy(false); }
  }
  return <><SectionHeading eyebrow="N5 WORD BANK" title="Words you’ll use every day." description="Build a useful vocabulary with pronunciation, context and examples." action={<button type="button" className={styles.ghostButton} onClick={()=>setRomaji(!romaji)}>{romaji?'Hide':'Show'} romaji</button>}/><div className={styles.toolbar}><span>{items.length} words shown · spaced revision available when signed in</span><div className={styles.filterPills}><button className={styles.filterActive}>All words</button></div></div>{notice?<div className={styles.billingNote}>{notice}</div>:null}<div className={styles.vocabGrid}>{items.map((item)=> <article key={item.id} className={`${styles.vocabCard} ${expanded===item.id?styles.vocabExpanded:''}`}><button type="button" className={styles.vocabCardTop} onClick={()=>setExpanded(expanded===item.id?null:item.id)}><span className={styles.wordType}>{item.partOfSpeech}</span><span className={styles.bookmark}>{expanded===item.id?'⌃':'⌄'}</span></button><button type="button" className={styles.vocabCardBody} onClick={()=>setExpanded(expanded===item.id?null:item.id)}><div className={styles.vocabWord}>{item.word}</div><div className={styles.vocabKana}>{item.kana}</div>{romaji&&<div className={styles.vocabRomaji}>{item.romaji}</div>}<div className={styles.vocabMeaning}>{item.meaning}</div></button>{expanded===item.id&&<div className={styles.vocabExample}><strong>{item.example}</strong>{romaji&&<small>{item.exampleRomaji}</small>}<span>{item.exampleMeaning}</span><div className={styles.ratingRow}><span>How well do you remember it?</span><div><button type="button" className={styles.rateAgain} disabled={busy} onClick={()=>void review(item.id,1)}>Again</button><button type="button" className={styles.rateGood} disabled={busy} onClick={()=>void review(item.id,4)}>Good</button><button type="button" className={styles.rateEasy} disabled={busy} onClick={()=>void review(item.id,5)}>Easy</button></div></div></div>}<div className={styles.vocabFooter}><button type="button" onClick={()=>setExpanded(expanded===item.id?null:item.id)}>{expanded===item.id?'Close example':'View example'}</button><span>↗</span></div></article>)}</div></>;
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

function Progress({snapshot,streak}:{snapshot:LearnerSnapshot;streak:number}) {
  const mastery = snapshot.mastery || { grammar:0, vocabulary:0, kanji:0, reading:0, kana:0, overallLessons:0 };
  const scores = snapshot.recentScores || [];
  return <><SectionHeading eyebrow="YOUR JOURNEY SO FAR" title="Look how far you’ve come." description="A clear view of your learning habits, topic mastery and exam readiness." action={<span className={styles.counterPill}>N5 learner</span>}/><div className={styles.progressHero}><div><div className={styles.eyebrow}>OVERALL N5 READINESS</div><div className={styles.bigPercent}>{snapshot.overallPercentage || 0}<span>%</span></div><p>Progress is calculated from completed lessons, reviewed vocabulary, mastered kanji and reading practice.</p></div><div className={styles.progressRingLarge}><strong>{snapshot.overallPercentage || 0}%</strong><span>complete</span></div></div><div className={styles.masteryGrid}><Mastery label="Grammar" value={mastery.grammar} tone="green"/><Mastery label="Vocabulary" value={mastery.vocabulary} tone="orange"/><Mastery label="Kanji" value={mastery.kanji} tone="blue" detail={`${snapshot.kanjiMastered} of ${snapshot.kanjiCount} N5 characters marked known`}/><Mastery label="Reading" value={mastery.reading} tone="purple"/><Mastery label="Kana" value={mastery.kana} tone="green"/><Mastery label="Lessons" value={mastery.overallLessons} tone="orange"/></div><div className={styles.progressBottom}><div className={styles.panel}><div className={styles.eyebrow}>STUDY CONSISTENCY</div><h3>{streak}-day learning streak</h3><p>Complete a lesson, quiz or revision session to add a learning day.</p><div className={styles.weekDots}>{['M','T','W','T','F','S','S'].map((d,i)=><div className={styles.dayEmpty} key={`${d}${i}`}><span>{d}</span><b>·</b></div>)}</div></div><div className={styles.panel}><div className={styles.eyebrow}>RECENT TEST SCORES</div><h3>{scores.length ? 'Your latest results' : 'Your exam history will appear here.'}</h3><div className={styles.scoreBars}>{scores.slice(0,7).map((value:number,i:number)=><div key={i}><span style={{height:`${value}%`}}/><small>{i+1}</small></div>)}</div></div></div></>;
}
function Mastery({label,value,tone,detail}:{label:string;value:number;tone:Tone;detail?:string}){return <div className={styles.masteryCard}><div><strong>{label}</strong><b>{value}%</b></div><ProgressBar value={value} tone={tone}/><small>{detail ?? (value>=80?'Strong progress':value>=50?'Building confidence':'More practice recommended')}</small></div>}

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

function EmptyState({title,description}:{title:string;description:string}){return <div className={styles.emptyState}><div>日</div><h2>{title}</h2><p>{description}</p></div>}
