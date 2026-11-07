import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http';
import { getUserTimeZone } from '../activity';
import { localDateKey } from '../date';
import { calculateKanjiMastery } from '../kanji-progress';

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

export async function getDashboard(userClient: SupabaseClient, userId: string) {
  const now = new Date();
  const [profile, preferences, lessonList, grammar, vocabulary, kanji, progress, activity, attempts, vocabState, flashcardState, flashcardSettings] = await Promise.all([
    userClient.from('profiles').select('display_name,timezone').eq('id', userId).maybeSingle(),
    userClient.from('user_preferences').select('daily_study_goal_minutes,show_romaji,show_furigana').eq('user_id', userId).maybeSingle(),
    userClient.from('lessons').select('id,course_units!inner(slug)').eq('publication_status', 'published'),
    userClient.from('grammar_points').select('id', { count: 'exact', head: true }).eq('jlpt_level', 'N5').eq('publication_status', 'published'),
    userClient.from('vocabulary_entries').select('id', { count: 'exact', head: true }).eq('jlpt_level', 'N5').eq('publication_status', 'published'),
    userClient.from('kanji_entries').select('id').eq('jlpt_level', 'N5').eq('publication_status', 'published').limit(5000),
    userClient.from('lesson_progress').select('lesson_id,status,updated_at').eq('user_id', userId),
    userClient.from('user_daily_activity').select('activity_date,study_seconds,lessons_completed,quizzes_completed,vocabulary_reviewed,flashcards_reviewed,flashcards_again,flashcards_known').eq('user_id', userId).order('activity_date', { ascending: false }).limit(400),
    userClient.from('quiz_attempts').select('id,quiz_id,score_percentage,submitted_at,status,quizzes(title,slug)').eq('user_id', userId).eq('status', 'graded').order('submitted_at', { ascending: false }).limit(10),
    userClient.from('vocabulary_review_state').select('vocabulary_id,repetitions,due_at').eq('user_id', userId).limit(5000),
    userClient.from('flashcard_review_state').select('flashcard_id,repetitions,due_at,scheduler_state,flashcards!inner(source_type)').eq('user_id', userId).limit(5000),
    userClient.from('user_flashcard_settings').select('daily_new_limit,daily_review_limit,show_romaji,show_furigana').eq('user_id', userId).maybeSingle(),
  ]);

  const firstError = [profile, preferences, lessonList, grammar, vocabulary, kanji, progress, activity, attempts, vocabState, flashcardState, flashcardSettings].find((item) => item.error)?.error;
  if (firstError) throw new HttpError(500, 'Could not load learning dashboard.', firstError.message);

  const kanjiIds = (kanji.data ?? []).map((row) => row.id);
  let kanjiReviewRows: Array<{ kanji_id: string; status: string }> = [];
  if (kanjiIds.length) {
    const { data: reviewRows, error: reviewError } = await userClient.from('kanji_review_state')
      .select('kanji_id,status').eq('user_id', userId).eq('status', 'known').in('kanji_id', kanjiIds);
    if (reviewError) throw new HttpError(500, 'Could not load kanji mastery progress.', reviewError.message);
    kanjiReviewRows = (reviewRows ?? []) as Array<{ kanji_id: string; status: string }>;
  }
  const kanjiMastery = calculateKanjiMastery(kanjiIds, kanjiReviewRows);

  const lessons = (lessonList.data ?? []) as unknown as LessonWithUnit[];
  const lessonProgress = progress.data ?? [];
  const completedIds = new Set(lessonProgress.filter((row) => row.status === 'completed').map((row) => row.lesson_id));
  const completed = completedIds.size;
  const lessonPercent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const unitLessons = new Map<string, { total: number; completed: number }>();
  for (const lesson of lessons) {
    const courseUnit = Array.isArray(lesson.course_units) ? lesson.course_units[0] : lesson.course_units;
    const unitSlug = String(courseUnit?.slug ?? '');
    const entry = unitLessons.get(unitSlug) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (completedIds.has(lesson.id)) entry.completed += 1;
    unitLessons.set(unitSlug, entry);
  }
  const percentForUnit = (slug: string) => {
    const row = unitLessons.get(slug);
    return row?.total ? Math.round((row.completed / row.total) * 100) : 0;
  };

  const vocabRows = vocabState.data ?? [];
  const masteredVocabulary = vocabRows.filter((row) => Number(row.repetitions) >= 3).length;
  const totalVocabulary = vocabulary.count ?? 0;
  const vocabularyPercent = totalVocabulary ? Math.min(100, Math.round((masteredVocabulary / totalVocabulary) * 100)) : 0;
  const flashRows = (flashcardState.data ?? []) as unknown as FlashcardProgressRow[];
  const { mastered: masteredKanji, total: totalKanji, percentage: kanjiPercent } = kanjiMastery;
  const masteredFlashcards = flashRows.filter((row) => Number(row.repetitions) >= 3).length;

  const recentActivity = activity.data ?? [];
  const dateKeys = recentActivity.map((row) => String(row.activity_date));
  const timezone = profile.data?.timezone || 'Asia/Kolkata';
  const { localDateKey, consecutiveStreak } = await import('../date');
  const todayKey = localDateKey(now, timezone);
  const streak = consecutiveStreak(dateKeys, todayKey);
  const dueVocabulary = vocabRows.filter((row) => new Date(row.due_at) <= now).length;
  const dueFlashcards = flashRows.filter((row) => new Date(row.due_at) <= now && row.scheduler_state !== 'new').length;
  const totalStudySeconds = recentActivity.reduce((sum, row) => sum + Number(row.study_seconds ?? 0), 0);
  const attemptRows = (attempts.data ?? []) as unknown as QuizAttemptAreaRow[];
  const scoreByArea = (needle: string) => {
    const matching = attemptRows.filter((row) => {
      const quiz = Array.isArray(row.quizzes) ? row.quizzes[0] : row.quizzes;
      return `${quiz?.slug ?? ''} ${quiz?.title ?? ''}`.toLowerCase().includes(needle);
    });
    return matching.length
      ? Math.round(matching.reduce((sum, row) => sum + Number(row.score_percentage ?? 0), 0) / matching.length)
      : null;
  };
  const mastery = {
    grammar: scoreByArea('grammar') ?? percentForUnit('grammar'),
    vocabulary: vocabularyPercent,
    kanji: kanjiPercent,
    kana: scoreByArea('kana') ?? percentForUnit('kana'),
    reading: scoreByArea('reading') ?? percentForUnit('reading'),
    overallLessons: lessonPercent,
  };
  const overallPercentage = Math.round(
    mastery.grammar * 0.20 + mastery.vocabulary * 0.20 + mastery.kanji * 0.20 +
    mastery.kana * 0.10 + mastery.reading * 0.10 + mastery.overallLessons * 0.20,
  );

  return {
    profile: { displayName: profile.data?.display_name || 'Learner', timezone },
    preferences: preferences.data ?? { daily_study_goal_minutes: 15, show_romaji: true, show_furigana: true },
    progress: {
      overallPercentage,
      lessonsCompleted: completed,
      lessonsTotal: lessons.length,
      lessonPercentage: lessonPercent,
      grammarTotal: grammar.count ?? 0,
      vocabularyTotal: totalVocabulary,
      vocabularyMastered: masteredVocabulary,
      kanjiTotal: totalKanji,
      kanjiMastered: masteredKanji,
      flashcardsTracked: flashRows.length,
      flashcardsMastered: masteredFlashcards,
      mastery,
    },
    streak,
    due: { vocabulary: dueVocabulary, flashcards: dueFlashcards, total: dueVocabulary + dueFlashcards },
    dailyGoal: {
      minutes: preferences.data?.daily_study_goal_minutes ?? 15,
      studiedSeconds: Number(recentActivity.find((row) => row.activity_date === todayKey)?.study_seconds ?? 0),
    },
    totalStudySeconds,
    recentActivity,
    recentAttempts: attempts.data ?? [],
    flashcardSettings: flashcardSettings.data ?? null,
  };
}
