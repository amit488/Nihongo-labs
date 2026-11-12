'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/** Browser client shares the cookie-based auth session with Next.js server handlers. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    // The Next.js proxy is responsible for refreshing cookie-backed sessions.
    // Keeping browser auto-refresh off prevents it from rewriting temporary
    // sessions as long-lived cookies after a token refresh.
    browserClient = createBrowserClient(url, key, { auth: { autoRefreshToken: false } });
  }
  return browserClient;
}
