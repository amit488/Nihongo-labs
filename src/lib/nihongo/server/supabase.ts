import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  KEEP_SIGNED_IN_COOKIE_NAME,
  withAuthCookiePersistence,
} from '@/lib/nihongo/auth-session';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Cookie-backed client for Server Components, Server Actions and Route Handlers. */
export async function createServerSupabase(options?: { keepSignedIn?: boolean }) {
  const cookieStore = await cookies();
  const keepSignedIn = options?.keepSignedIn ?? cookieStore.get(KEEP_SIGNED_IN_COOKIE_NAME)?.value === '1';
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
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, withAuthCookiePersistence(options, keepSignedIn, value));
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
  // getUser() verifies the JWT with Auth; do not use getSession() as an authorization check.
  const { data, error } = await supabase.auth.getUser();
  // Anonymous Supabase users carry an authenticated JWT, but this app's
  // learner data and Quick Revision features require a permanent account.
  if (error || !data.user || data.user.is_anonymous) {
    return { ok: false as const, supabase, user: null, error: 'Authentication required.' };
  }
  return { ok: true as const, supabase, user: data.user, error: null };
}
