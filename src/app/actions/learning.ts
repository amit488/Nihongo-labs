'use server';

import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { HttpError } from '@/lib/nihongo/server/http';
import { progressSchema, submitAttemptSchema, flashcardReviewSchema } from '@/lib/nihongo/server/validation';
import { saveLessonProgress } from '@/lib/nihongo/server/services/progress';
import { submitQuizAttempt } from '@/lib/nihongo/server/services/practice';
import { reviewFlashcard } from '@/lib/nihongo/server/services/flashcards';

export async function saveLessonProgressAction(input: unknown) {
  const context = await requireUser();
  if (!context.ok) throw new HttpError(401, context.error);
  const parsed = progressSchema.parse(input);
  return saveLessonProgress(context.supabase, createAdminSupabase(), context.user.id, parsed);
}

export async function submitQuizAction(input: unknown) {
  const context = await requireUser();
  if (!context.ok) throw new HttpError(401, context.error);
  const parsed = submitAttemptSchema.parse(input);
  return submitQuizAttempt(context.supabase, createAdminSupabase(), context.user.id, parsed);
}

export async function reviewFlashcardAction(input: unknown) {
  const context = await requireUser();
  if (!context.ok) throw new HttpError(401, context.error);
  const parsed = flashcardReviewSchema.parse(input);
  return reviewFlashcard(context.supabase, createAdminSupabase(), context.user.id, parsed);
}
