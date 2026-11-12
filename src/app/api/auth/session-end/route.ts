import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { KEEP_SIGNED_IN_COOKIE } from '@/lib/nihongo/auth-session';
import { assertSameOrigin, HttpError, jsonError } from '@/lib/nihongo/server/http';

/**
 * Called with fetch keepalive when a non-remembered learner closes or leaves
 * the site. Server-side sign-out revokes the Supabase session and clears the
 * cookie even after the originating document has started unloading.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const supabase = await createServerSupabase({ persistentSession: false });
    const { data, error: userError } = await supabase.auth.getUser();

    if (!userError && data.user) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new HttpError(500, 'Could not end the Supabase session.');
    }

    const cookieStore = await cookies();
    cookieStore.set(KEEP_SIGNED_IN_COOKIE, '', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
    });

    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return jsonError(error);
  }
}
