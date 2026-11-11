'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { QuickRevision } from './quick-revision';

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
  const activeSection = pathname.startsWith('/learn')
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
    window.addEventListener('nihongo:auth-signed-out', handleAppSignOut);

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
      if (error || !data.user) {
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
      listener.subscription.unsubscribe();
    };
  }, []);

  return <QuickRevision signedIn={signedIn} sessionId={sessionId} activeSection={activeSection} />;
}
