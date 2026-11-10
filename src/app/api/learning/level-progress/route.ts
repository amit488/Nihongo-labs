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

    const [vocabularyTotal, vocabularyCompleted, kanjiTotal, grammarTotal, grammarCompleted, lessonRows] = await Promise.all([
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
      context.supabase.from('grammar_points')
        .select('id', { count: 'exact', head: true })
        .eq('jlpt_level', level)
        .eq('publication_status', 'published'),
      context.supabase.from('user_grammar_progress')
        .select('grammar_id,grammar_points!inner(jlpt_level,publication_status)', { count: 'exact', head: true })
        .eq('user_id', context.user.id)
        .eq('grammar_points.jlpt_level', level)
        .eq('grammar_points.publication_status', 'published'),
      context.supabase.from('lessons')
        .select('id,course_units!inner(courses!inner(jlpt_level,publication_status))')
        .eq('publication_status', 'published')
        .eq('course_units.publication_status', 'published')
        .eq('course_units.courses.publication_status', 'published')
        .eq('course_units.courses.jlpt_level', level)
        .limit(2000),
    ]);

    const failedQuery = vocabularyTotal.error || vocabularyCompleted.error || kanjiTotal.error
      || grammarTotal.error || grammarCompleted.error || lessonRows.error;
    if (failedQuery) throw new HttpError(500, 'Could not calculate progress for this JLPT level.', failedQuery.message);

    const kanjiIds = (kanjiTotal.data ?? []).map((row) => row.id);
    let kanjiCompleted = 0;
    if (kanjiIds.length) {
      const { data: knownRows, error } = await context.supabase.from('kanji_review_state')
        .select('kanji_id')
        .eq('user_id', context.user.id)
        .eq('status', 'known')
        .in('kanji_id', kanjiIds);
      if (error) throw new HttpError(500, 'Could not load known kanji progress.', error.message);
      kanjiCompleted = knownRows?.length ?? 0;
    }

    const lessonIds = (lessonRows.data ?? []).map((row) => row.id);
    let lessonsCompleted = 0;
    if (lessonIds.length) {
      const { data: completedRows, error } = await context.supabase.from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', context.user.id)
        .eq('status', 'completed')
        .in('lesson_id', lessonIds);
      if (error) throw new HttpError(500, 'Could not load completed lesson progress.', error.message);
      lessonsCompleted = completedRows?.length ?? 0;
    }

    const vocabulary = { completed: vocabularyCompleted.count ?? 0, total: vocabularyTotal.count ?? 0 };
    const kanji = { completed: kanjiCompleted, total: kanjiTotal.count ?? 0 };
    const grammar = { completed: grammarCompleted.count ?? 0, total: grammarTotal.count ?? 0 };
    const lessons = { completed: lessonsCompleted, total: lessonIds.length };
    const categories = [vocabulary, kanji, grammar, lessons].filter((item) => item.total > 0);
    const readiness = categories.length
      ? Math.round(categories.reduce((sum, item) => sum + Math.min(100, item.completed / item.total * 100), 0) / categories.length)
      : 0;

    return NextResponse.json({
      level, vocabulary, kanji, grammar, lessons, readiness,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
