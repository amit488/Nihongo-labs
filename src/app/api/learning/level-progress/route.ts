import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const level = request.nextUrl.searchParams.get('level') || 'N5';
    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');

    const [vocabularyTotal, vocabularyCompleted, kanjiTotal] = await Promise.all([
      context.supabase.from('vocabulary_entries')
        .select('id', { count: 'exact', head: true })
        .eq('jlpt_level', level)
        .eq('publication_status', 'published'),
      context.supabase.from('user_vocabulary_progress')
        .select('vocabulary_id,vocabulary_entries!inner(jlpt_level,publication_status)', { count: 'exact', head: true })
        .eq('user_id', context.user.id)
        .eq('vocabulary_entries.jlpt_level', level)
        .eq('vocabulary_entries.publication_status', 'published'),
      context.supabase.from('kanji_entries')
        .select('id', { count: 'exact', head: true })
        .eq('jlpt_level', level)
        .eq('publication_status', 'published'),
    ]);

    if (vocabularyTotal.error) throw new HttpError(500, 'Could not count published vocabulary.', vocabularyTotal.error.message);
    if (vocabularyCompleted.error) throw new HttpError(500, 'Could not count learned vocabulary.', vocabularyCompleted.error.message);
    if (kanjiTotal.error) throw new HttpError(500, 'Could not count published kanji.', kanjiTotal.error.message);

    const { data: kanjiRows, error: kanjiRowsError } = await context.supabase
      .from('kanji_entries')
      .select('id')
      .eq('jlpt_level', level)
      .eq('publication_status', 'published');
    if (kanjiRowsError) throw new HttpError(500, 'Could not load the kanji catalogue.', kanjiRowsError.message);

    const kanjiIds = (kanjiRows ?? []).map((row) => row.id);
    let kanjiCompleted = 0;
    if (kanjiIds.length) {
      const { data: progressRows, error: progressError } = await context.supabase
        .from('kanji_review_state')
        .select('kanji_id,status')
        .eq('user_id', context.user.id)
        .eq('status', 'known')
        .in('kanji_id', kanjiIds);
      if (progressError) throw new HttpError(500, 'Could not load known kanji progress.', progressError.message);
      kanjiCompleted = progressRows?.length ?? 0;
    }

    return NextResponse.json({
      level,
      vocabulary: {
        completed: vocabularyCompleted.count ?? 0,
        total: vocabularyTotal.count ?? 0,
      },
      kanji: {
        completed: kanjiCompleted,
        total: kanjiTotal.count ?? 0,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
