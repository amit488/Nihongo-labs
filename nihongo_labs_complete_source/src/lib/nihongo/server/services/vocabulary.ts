import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http';
import { getUserTimeZone } from '../activity';
import { localDateKey } from '../date';

/**
 * Persist an SM-2 quality rating. The database RPC locks the (user, word) row,
 * recalculates the interval and increments daily activity in the same transaction.
 */
export async function reviewVocabulary(admin: SupabaseClient, userId: string, vocabularyId: string, quality: number) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new HttpError(400, 'Quality must be an integer from 0 to 5.');
  }
  const timezone = await getUserTimeZone(admin, userId);
  const { data, error } = await admin.rpc('persist_vocabulary_review', {
    _user_id: userId,
    _vocabulary_id: vocabularyId,
    _quality: quality,
    _activity_date: localDateKey(new Date(), timezone),
  });
  if (error) {
    if (error.code === 'P0002') throw new HttpError(404, 'Vocabulary item not found or unavailable.');
    throw new HttpError(500, 'Could not save vocabulary review. Run sql/011_backend_rpc.sql first.', error.message);
  }
  return data;
}
