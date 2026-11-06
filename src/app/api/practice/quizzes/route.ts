import { connection, NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type QuizListRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  time_limit_seconds: number | null;
  pass_percentage: number;
  access_level: string;
  quiz_questions: Array<{ count: number }> | null;
};

export async function GET(request: NextRequest) {
  await connection();
  try {
    const kind = request.nextUrl.searchParams.get('kind') || 'practice';
    const supabase = await createServerSupabase();
    let query = supabase.from('quizzes')
      .select('id,slug,title,description,time_limit_seconds,pass_percentage,access_level,max_attempts,quiz_questions(count)')
      .eq('publication_status', 'published').order('sort_order').limit(50);
    if (kind === 'mock') query = query.ilike('slug', '%mock%');
    else if (kind === 'reading') query = query.ilike('slug', '%reading%');
    else if (kind === 'kana') query = query.ilike('slug', '%kana%');
    else query = query.not('slug', 'ilike', '%mock%').not('slug', 'ilike', '%reading%').not('slug', 'ilike', '%kana%');
    const { data, error } = await query;
    if (error) throw new HttpError(500, 'Could not load practice sets.', error.message);
    const quizRows = (data ?? []) as unknown as QuizListRow[];
    return NextResponse.json({ quizzes: quizRows.map((quiz) => ({
      id: quiz.id, slug: quiz.slug, title: quiz.title, description: quiz.description,
      timeLimitSeconds: quiz.time_limit_seconds, passPercentage: Number(quiz.pass_percentage),
      accessLevel: quiz.access_level, questionCount: quiz.quiz_questions?.[0]?.count ?? 0,
    })) }, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (error) { return jsonError(error); }
}
