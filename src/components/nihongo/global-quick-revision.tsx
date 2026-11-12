'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient, hasKeepSignedInPreference } from '@/lib/nihongo/supabase';
import { TAB_SESSION_STORAGE_KEY } from '@/lib/nihongo/auth-session';
import { QuickRevision } from './quick-revision';

const TIMER_STORAGE_KEY = 'nihongo:quick-revision:timer:v1';
const SESSION_STORAGE_KEY = 'nihongo:quick-revision:session:v1';

type StoredSession = {
  userId: string;
  sessionId: string;
  tabSessionId: string;
};

let fallbackTabSessionId: string | null = null;

function getTabSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    fallbackTabSessionId ??= crypto.randomUUID();
    return fallbackTabSessionId;
  }
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof value.userId !== 'string' || typeof value.sessionId !== 'string' || typeof value.tabSessionId !== 'string') return null;
    return { userId: value.userId, sessionId: value.sessionId, tabSessionId: value.tabSessionId };
  } catch {
    return null;
  }
}

function startOrResumeSession(userId: string): string {
  const tabSessionId = getTabSessionId();
  const existing = readStoredSession();
  if (existing?.userId === userId && existing.tabSessionId === tabSessionId) return existing.sessionId;

  const sessionId = crypto.randomUUID();
  try {
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId, sessionId, tabSessionId }));
  } catch {
    // The current signed-in page still receives a fresh in-memory session.
  }
  window.dispatchEvent(new CustomEvent('nihongo:quick-revision-timer', {
    detail: { sessionElapsedMs: 0, elapsedMs: 0, paused: false, reset: true },
  }));
  return sessionId;
}

function clearSignedInSession() {
  try {
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // The auth state still clears the in-memory timers.
  }
  window.dispatchEvent(new CustomEvent('nihongo:quick-revision-timer', {
    detail: { sessionElapsedMs: 0, elapsedMs: 0, paused: true, reset: true },
  }));
}

export default function GlobalQuickRevision() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/');
  const authRevision = useRef(0);
  // Authentication screens are not study time and must never trigger revision questions.
  const activeSection = isAuthRoute ? 'auth' : pathname.startsWith('/learn')
    ? pathname.split('/')[2] || 'overview'
    : 'site';

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let alive = true;

    // Every auth event invalidates an older getUser() response. Without this
    // guard, an initial lookup can resolve after SIGNED_OUT and turn the
    // Quick Revision UI back on for a signed-out visitor.
    const finishSignOut = () => {
      authRevision.current += 1;
      clearSignedInSession();
      setSessionId(null);
      setSignedIn(false);
    };

    const handleAppSignOut = () => finishSignOut();
    const handlePageHide = () => {
      try {
        window.sessionStorage.removeItem(TAB_SESSION_STORAGE_KEY);
      } catch {
        // The next fresh browser tab still receives a new storage session.
      }
      const currentPath = window.location.pathname;
      const isAuthScreen = currentPath === '/login' || currentPath === '/signup' || currentPath.startsWith('/auth/');
      if (isAuthScreen || hasKeepSignedInPreference()) return;
      const pendingFlushes: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent('nihongo:prepare-session-end', {
        detail: { register: (flush: Promise<unknown>) => pendingFlushes.push(flush) },
      }));
      void Promise.allSettled(pendingFlushes).then(() => fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive: true,
      })).catch(() => {
        // The session-only Supabase cookie also expires when the browser closes.
      });
    };
    window.addEventListener('nihongo:auth-signed-out', handleAppSignOut);
    window.addEventListener('pagehide', handlePageHide);

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'SIGNED_OUT') {
        finishSignOut();
        return;
      }

      // INITIAL_SESSION only reports what was found in browser cookie storage.
      // Do not expose learner-only UI until getUser() has verified that session
      // against Supabase Auth. Other events represent an active auth transition.
      if (event === 'INITIAL_SESSION') return;
      if (session?.user?.is_anonymous) {
        // Anonymous Supabase users have an authenticated JWT but no real
        // account. They must never receive learner revision questions.
        finishSignOut();
        return;
      }
      if (session?.user) {
        authRevision.current += 1;
        const nextSessionId = startOrResumeSession(session.user.id);
        setSessionId(nextSessionId);
        setSignedIn(true);
      }
    });

    const initialAuthRevision = authRevision.current;
    void client.auth.getUser().then(({ data, error }) => {
      if (!alive || initialAuthRevision !== authRevision.current) return;
      if (error || !data.user || data.user.is_anonymous) {
        finishSignOut();
        return;
      }
      const nextSessionId = startOrResumeSession(data.user.id);
      setSessionId(nextSessionId);
      setSignedIn(true);
    }).catch(() => {
      if (alive && initialAuthRevision === authRevision.current) finishSignOut();
    });

    return () => {
      alive = false;
      authRevision.current += 1;
      window.removeEventListener('nihongo:auth-signed-out', handleAppSignOut);
      window.removeEventListener('pagehide', handlePageHide);
      listener.subscription.unsubscribe();
    };
  }, []);

  // Remount the modal controller when auth ends or a different login starts.
  // This discards any pending question/result from the previous user session.
  return (
    <QuickRevision
      key={signedIn && sessionId ? sessionId : 'signed-out'}
      signedIn={signedIn}
      sessionId={sessionId}
      activeSection={activeSection}
    />
  );
}
