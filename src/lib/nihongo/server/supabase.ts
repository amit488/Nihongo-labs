import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { KEEP_SIGNED_IN_COOKIE } from '@/lib/nihongo/auth-session';
import { HttpError } from '@/lib/nihongo/server/http';

const TRANSIENT_AUTH_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const AUTH_UNAVAILABLE_MESSAGE = 'Authentication is temporarily unavailable. Please try again.';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { name?: unknown; status?: unknown };
  return authError.name === 'AuthRetryableFetchError' ||
    (typeof authError.status === 'number' &&
      (TRANSIENT_AUTH_HTTP_STATUSES.has(authError.status) || authError.status >= 500));
}

/** Cookie-backed client for Server Components, Server Actions and Route Handlers. */
export async function createServerSupabase(options: { persistentSession?: boolean } = {}) {
  const cookieStore = await cookies();
  const persistentSession = options.persistentSession ??
    cookieStore.get(KEEP_SIGNED_IN_COOKIE)?.value === 'true';
  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options: cookieOptions } of cookiesToSet) {
              const nextOptions = { ...cookieOptions };
              // Supabase SSR defaults auth cookies to a long maxAge. Keep
              // non-remembered sessions as browser-session cookies instead.
              // Preserve maxAge=0 on removals so sign-out still deletes cookies.
              if (!persistentSession && cookieOptions?.maxAge !== 0 && value) {
                delete nextOptions.maxAge;
                delete nextOptions.expires;
              }
              cookieStore.set(name, value, nextOptions);
            }
          } catch {
            // Server Components cannot write cookies. src/proxy.ts refreshes them.
          }
        },
      },
    },
  );
}

let adminClient: SupabaseClient | null = null;

/** Server-only service-role client. Never import this module from a Client Component. */
export function createAdminSupabase(): SupabaseClient {
  if (adminClient) return adminClient;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).');
  adminClient = createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'nihongo-labs-server' } },
  });
  return adminClient;
}

export async function requireUser() {
  const supabase = await createServerSupabase();

  // A short Auth/network outage must not be reported as a signed-out user.
  // Retry once for retryable fetch/HTTP failures before deciding whether the
  // cookie-backed session is actually invalid.
  const getUserWithTransientRetry = async () => {
    let result = await supabase.auth.getUser();
    if (result.error && isTransientAuthError(result.error)) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      result = await supabase.auth.getUser();
    }
    return result;
  };

  let authResult = await getUserWithTransientRetry();

  // A stale access token can occasionally survive a concurrent refresh. Use
  // the refresh token held in the same server cookie store, then verify the
  // new access token with Auth before granting access.
  if (authResult.error?.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session) {
      authResult = await getUserWithTransientRetry();
    } else if (isTransientAuthError(refreshError)) {
      throw new HttpError(503, AUTH_UNAVAILABLE_MESSAGE);
    }
  }

  if (authResult.error && isTransientAuthError(authResult.error)) {
    throw new HttpError(503, AUTH_UNAVAILABLE_MESSAGE);
  }

  // getUser() verifies the JWT with Auth; do not use getSession() as an authorization check.
  const user = authResult.data.user;
  // Anonymous Supabase users carry an authenticated JWT, but this app's
  // learner data and Quick Revision features require a permanent account.
  if (authResult.error || !user || user.is_anonymous) {
    return { ok: false as const, supabase, user: null, error: 'Authentication required.' };
  }
  return { ok: true as const, supabase, user, error: null };
}
