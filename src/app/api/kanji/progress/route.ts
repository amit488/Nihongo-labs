import { connection, NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function GET(request: NextRequest) {
  // Keep the prerender bailout outside the application error handler.
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const level = request.nextUrl.searchParams.get('level') || 'N5';
    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');

    const { data, error } = await context.supabase.from('kanji_review_state')
      .select('kanji_id,status,kanji_entries!inner(jlpt_level,publication_status)')
      .eq('user_id', context.user.id)
      .eq('kanji_entries.jlpt_level', level)
      .eq('kanji_entries.publication_status', 'published');
    if (error) throw new HttpError(500, 'Could not load kanji progress.', error.message);

    const progress = (data ?? []).map((row) => ({
      kanji_id: row.kanji_id,
      status: row.status,
    }));
    return NextResponse.json({ progress }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    unstable_rethrow(error);
    return jsonError(error);
  }
}
