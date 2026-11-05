import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http';
import { localDateKey } from './date';

export async function getUserTimeZone(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('timezone').eq('id', userId).maybeSingle();
  return data?.timezone || 'Asia/Kolkata';
}

/**
 * Activity table is an aggregate with a composite primary key. Updates are done by
 * trusted server code because authenticated clients have read-only access to it.
 * A restricted SECURITY DEFINER RPC performs atomic increments; only trusted
 * service-role code can call it, while learners can read their own aggregates.
 */
export async function bumpDailyActivity(
  admin: SupabaseClient,
  userId: string,
  timezone: string,
  increments: Partial<Record<'study_seconds' | 'lessons_completed' | 'quizzes_completed' | 'vocabulary_reviewed' | 'flashcards_reviewed' | 'flashcards_again' | 'flashcards_known' | 'flashcards_new', number>>,
) {
  const date = localDateKey(new Date(), timezone);
  const allowed = new Set([
    'study_seconds', 'lessons_completed', 'quizzes_completed', 'vocabulary_reviewed',
    'flashcards_reviewed', 'flashcards_again', 'flashcards_known', 'flashcards_new',
  ]);
  for (const [key, value] of Object.entries(increments)) {
    if (!allowed.has(key) || !Number.isFinite(value) || Number(value) < 0) {
      throw new HttpError(400, 'Invalid activity increment.');
    }
  }
  const { error } = await admin.rpc('record_user_activity', {
    _user_id: userId,
    _activity_date: date,
    _increments: increments,
  });
  if (error) throw new HttpError(500, 'Could not save daily activity. Run sql/011_backend_rpc.sql first.', error.message);
  return date;
}
