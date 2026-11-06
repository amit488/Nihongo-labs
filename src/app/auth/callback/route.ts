import { connection, NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

export async function GET(request: NextRequest) {
  await connection();

  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const providerError = request.nextUrl.searchParams.get('error_code')
    || request.nextUrl.searchParams.get('error');

  // Supabase redirects expired/invalid confirmation links with error params.
  // Give the user a recoverable path instead of silently dropping them at login.
  if (providerError) {
    return NextResponse.redirect(new URL('/signup?confirmation=failed', request.url));
  }

  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/learn';

  if (code) {
    try {
      const supabase = await createServerSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
    } catch {
      // The link may be expired, already used, or opened in a browser without
      // the PKCE verifier cookie created during signup.
    }
  }

  return NextResponse.redirect(new URL('/signup?confirmation=failed', request.url));
}
