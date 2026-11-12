import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { KEEP_SIGNED_IN_COOKIE_NAME } from '@/lib/nihongo/auth-session';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();

    // A remembered session is intentionally allowed to survive page exit.
    if (cookieStore.get(KEEP_SIGNED_IN_COOKIE_NAME)?.value === '1') {
      return NextResponse.json({ signedOut: false, keptSignedIn: true }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const supabase = await createServerSupabase({ keepSignedIn: false });
    const { error } = await supabase.auth.signOut();
    if (error) throw new HttpError(500, 'Could not end the Supabase session.', error.message);

    return NextResponse.json({ signedOut: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return jsonError(error);
  }
}
