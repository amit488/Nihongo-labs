import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { KEEP_SIGNED_IN_COOKIE } from '@/lib/nihongo/auth-session';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const keepSignedIn = request.cookies.get(KEEP_SIGNED_IN_COOKIE)?.value === 'true';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          const nextOptions = { ...options };
          // A non-remembered session must stay a browser-session cookie
          // after proxy-driven token refreshes too.
          if (!keepSignedIn && name.startsWith('sb-') && value) {
            delete nextOptions.maxAge;
            delete nextOptions.expires;
          }
          response.cookies.set(name, value, nextOptions);
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
