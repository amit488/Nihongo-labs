'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { QuickRevision } from './quick-revision';
import { clearKeepSignedInPreferenceInBrowser, shouldKeepSignedInInBrowser } from '@/lib/nihongo/auth-session';

const TIMER_STORAGE_KEY = 'nihongo:quick-revision:timer:v1';
const SESSION_STORAGE_KEY = 'nihongo:quick-revision:session:v1';

type StoredSession = {
  userId: string;
  sessionId: string;
};

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof value.userId !== 'string' || typeof value.sessionId !== 'string') return null;
    return { userId: value.userId, sessionId: value.sessionId };
  } catch {
    return null;
  }
}

function startOrResumeSession(userId: string): string {
  const existing = readStoredSession();
  if (existing?.userId === userId) return existing.sessionId;

  const sessionId = crypto.randomUUID();
  try {
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId, sessionId }));
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
  const authRevision = useRef(0);
  // Authentication screens are not study time and must never trigger revision questions.
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/');
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
      clearKeepSignedInPreferenceInBrowser();
      setSessionId(null);
      setSignedIn(false);
    };

    const handleAppSignOut = () => finishSignOut();
    // A real document unload ends this tab's study session even if the user
    // never clicked Sign out. Ordinary tab switching does not fire pagehide.
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      authRevision.current += 1;
      clearSignedInSession();
      // Every real document close ends the study timer and flushes pending activity.
      const detail: { beforeSessionEnd?: () => Promise<void> } = {};
      window.dispatchEvent(new CustomEvent('nihongo:before-auth-session-end', { detail }));
      if (shouldKeepSignedInInBrowser()) {
        void detail.beforeSessionEnd?.().catch(() => undefined);
        return;
      }

      // The global fallback also signs out admin and other authenticated pages.
      void (async () => {
        try { await detail.beforeSessionEnd?.(); } catch { /* The server sign-out is still attempted. */ }
        try {
          await fetch('/api/auth/session-end', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            keepalive: true,
          });
        } catch {
          // The non-remembered Supabase cookie is also a browser-session cookie.
        }
      })();
    };
    const handleAppSignIn = () => {
      authRevision.current += 1;
      const revision = authRevision.current;
      void client.auth.getUser().then(({ data, error }) => {
        if (!alive || revision !== authRevision.current) return;
        if (error || !data.user || data.user.is_anonymous) {
          finishSignOut();
          return;
        }
        const nextSessionId = startOrResumeSession(data.user.id);
        setSessionId(nextSessionId);
        setSignedIn(true);
      }).catch(() => {
        if (alive && revision === authRevision.current) finishSignOut();
      });
    };
    window.addEventListener('nihongo:auth-signed-out', handleAppSignOut);
    window.addEventListener('nihongo:auth-signed-in', handleAppSignIn);
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
      window.removeEventListener('nihongo:auth-signed-in', handleAppSignIn);
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
