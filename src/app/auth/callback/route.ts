import { connection, NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';

export async function GET(request: NextRequest) {
  await connection();
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/learn';
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
  }
  return NextResponse.redirect(new URL('/login?error=auth_callback', request.url));
}
