'use client';

import {
  createBrowserClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieMethodsBrowser,
} from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  KEEP_SIGNED_IN_COOKIE_NAME,
  withAuthCookiePersistence,
} from '@/lib/nihongo/auth-session';

let browserClient: SupabaseClient | null = null;

const browserCookieMethods: CookieMethodsBrowser = {
  getAll() {
    return parseCookieHeader(document.cookie);
  },
  setAll(cookiesToSet) {
    const keepSignedIn = parseCookieHeader(document.cookie).some(
      (cookie) => cookie.name === KEEP_SIGNED_IN_COOKIE_NAME && cookie.value === '1',
    );
    for (const { name, value, options } of cookiesToSet) {
      document.cookie = serializeCookieHeader(
        name,
        value,
        withAuthCookiePersistence(options, keepSignedIn, value),
      );
    }
  },
};

/** Read the non-sensitive persistence preference from the browser cookie. */
export function hasKeepSignedInPreference(): boolean {
  if (typeof document === 'undefined') return false;
  return parseCookieHeader(document.cookie).some(
    (cookie) => cookie.name === KEEP_SIGNED_IN_COOKIE_NAME && cookie.value === '1',
  );
}

/** Clear the non-sensitive preference flag after an explicit browser sign-out. */
export function clearKeepSignedInPreference() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${KEEP_SIGNED_IN_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

/** Browser client shares the cookie-based auth session with Next.js server handlers. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(url, key, { cookies: browserCookieMethods });
  }
  return browserClient;
}
