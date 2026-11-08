import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http';
import { getUserTimeZone } from '../activity';
import { localDateKey } from '../date';

type LessonWithUnit = {
  id: string;
  course_units: { slug: string } | Array<{ slug: string }> | null;
};
type FlashcardProgressRow = {
  repetitions: number;
  due_at: string;
  scheduler_state: string;
  flashcards: { source_type: string } | Array<{ source_type: string }> | null;
};
type QuizAttemptAreaRow = {
  score_percentage: number | null;
  quizzes: { slug: string | null; title: string | null } | Array<{ slug: string | null; title: string | null }> | null;
};

export async function saveLessonProgress(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  input: { lessonId: string; status: 'in_progress' | 'completed'; lastPositionSeconds: number; studySeconds?: number },
) {
  const { data: lesson, error: lessonError } = await userClient.from('lessons')
    .select('id,access_level,course_units!inner(course_id,courses!inner(access_level))')
    .eq('id', input.lessonId).eq('publication_status', 'published').maybeSingle();
  if (lessonError || !lesson) throw new HttpError(404, 'Lesson not found or not published.');

  const nested = lesson.course_units as unknown as { courses?: { access_level?: string } };
  const premium = lesson.access_level === 'premium' || nested?.courses?.access_level === 'premium';
  if (premium) {
    const now = new Date().toISOString();
    const { data: entitlement, error: entitlementError } = await userClient.from('user_entitlements').select('id')
      .eq('feature_key', 'premium_content').eq('status', 'active')
      .lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`)
      .limit(1).maybeSingle();
    if (entitlementError) throw new HttpError(500, 'Could not verify lesson access.', entitlementError.message);
    if (!entitlement) throw new HttpError(403, 'This lesson requires an active Premium subscription.');
  }

  const timezone = await getUserTimeZone(admin, userId);
  const { data, error } = await admin.rpc('persist_lesson_progress', {
    _user_id: userId,
    _lesson_id: input.lessonId,
    _status: input.status,
    _last_position_seconds: input.lastPositionSeconds,
    _activity_date: localDateKey(new Date(), timezone),
    _study_seconds: Math.min(Math.max(0, Math.floor(input.studySeconds ?? 0)), 3600),
  });
  if (error) {
    if (error.code === 'P0002') throw new HttpError(404, 'Lesson not found or not published.');
    throw new HttpError(500, 'Could not atomically save lesson progress. Run sql/011_backend_rpc.sql first.', error.message);
  }
  return data;
}

export async function getDashboard(userClient: SupabaseClient, _userId: string) {
  const { data, error } = await userClient.rpc('get_learning_dashboard');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(500, 'Could not load learning dashboard.', error?.message);
  return data as {
    profile: { displayName: string; timezone: string };
    preferences: { daily_study_goal_minutes: number; preferred_jlpt_level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'; show_romaji: boolean; show_furigana: boolean };
    progress: Record<string, unknown> & { mastery: Record<string, number> };
    streak: number; due: { vocabulary: number; flashcards: number; total: number };
    dailyGoal: { minutes: number; studiedSeconds: number }; totalStudySeconds: number;
    recentActivity: Array<Record<string, unknown> & { activity_date: string; study_seconds: number }>;
    recentAttempts: Array<Record<string, unknown> & { score_percentage: number | null }>;
    flashcardSettings: { daily_new_limit: number; daily_review_limit: number; show_romaji: boolean; show_furigana: boolean } | null;
  };
}
