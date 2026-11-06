import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';


export async function GET() {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const { data, error } = await context.supabase.from('quiz_attempts')
      .select('id,quiz_id,status,total_points,earned_points,score_percentage,started_at,submitted_at,duration_seconds,quizzes(title,slug)')
      .eq('user_id', context.user.id).order('started_at', { ascending: false }).limit(50);
    if (error) throw new HttpError(500, 'Could not load examination history.', error.message);
    return NextResponse.json({ attempts: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
