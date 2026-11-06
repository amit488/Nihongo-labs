import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function GET(request: NextRequest) {
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const level = request.nextUrl.searchParams.get('level') || 'N5';
    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');
    const { data, error } = await context.supabase
      .from('kanji_review_state')
      .select('kanji_id,status')
      .eq('user_id', context.user.id)
      .in('kanji_id', (
        await context.supabase.from('kanji_entries').select('id')
          .eq('jlpt_level', level).eq('publication_status', 'published')
      ).data?.map((row) => row.id) || []);
    if (error) throw new HttpError(500, 'Could not load kanji progress.', error.message);
    return NextResponse.json({ progress: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
