import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  KEEP_SIGNED_IN_COOKIE_NAME,
  withAuthCookiePersistence,
} from '@/lib/nihongo/auth-session';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const keepSignedIn = request.cookies.get(KEEP_SIGNED_IN_COOKIE_NAME)?.value === '1';

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, withAuthCookiePersistence(options, keepSignedIn, value));
        }
      },
    },
  });

  // Refresh/verify the cookie-backed session before rendering. Protected data is
  // still checked with auth.getUser() in every server action and API handler.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
