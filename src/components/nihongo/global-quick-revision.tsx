'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { QuickRevision } from './quick-revision';

export default function GlobalQuickRevision() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const activeSection = pathname.startsWith('/learn')
    ? pathname.split('/')[2] || 'overview'
    : 'site';

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let alive = true;
    void client.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.user));
    }).catch(() => {
      if (alive) setSignedIn(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) setSignedIn(Boolean(session?.user));
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <QuickRevision signedIn={signedIn} activeSection={activeSection} />;
}
