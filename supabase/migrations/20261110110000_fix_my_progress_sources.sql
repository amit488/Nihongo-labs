-- Link My Progress cards to the learner actions that actually persist completion.
-- Grammar uses the explicit "Mark as understood" records; vocabulary uses "Mark learned"
-- and spaced-repetition mastery. Reading and Kana scores use all graded attempts.
-- Recent test history remains a separate ten-attempt feed.
begin;

create or replace function public.get_learning_dashboard()
returns jsonb language sql stable security invoker set search_path = ''
as $$
with user_context as (
  select (select auth.uid()) as user_id,
    coalesce((select p.timezone from public.profiles p where p.id = (select auth.uid())), 'Asia/Kolkata') as time_zone
),
local_context as (
  select user_id, time_zone, (now() at time zone time_zone)::date as local_today from user_context
),
profile_row as (
  select coalesce(p.display_name, 'Learner') as display_name, coalesce(p.timezone, 'Asia/Kolkata') as time_zone
  from local_context u left join public.profiles p on p.id = u.user_id
),
preference_row as (
  select coalesce(p.daily_study_goal_minutes, 15) as daily_study_goal_minutes,
    coalesce(p.preferred_jlpt_level, 'N5'::public.jlpt_level) as preferred_jlpt_level,
    coalesce(p.show_romaji, true) as show_romaji, coalesce(p.show_furigana, true) as show_furigana
  from local_context u left join public.user_preferences p on p.user_id = u.user_id
),
published_lessons as (
  select l.id, cu.slug as unit_slug
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  join public.courses c on c.id = cu.course_id
  where l.publication_status = 'published'
    and c.slug = 'nihongo-n5-foundations'
),
lesson_progress_rows as (
  select lp.lesson_id, lp.status from public.lesson_progress lp
  join local_context u on u.user_id = lp.user_id
),
lesson_summary as (
  select count(*)::integer as lessons_total,
    count(*) filter (where lp.status = 'completed')::integer as lessons_completed
  from published_lessons l left join lesson_progress_rows lp on lp.lesson_id = l.id
),
unit_summary as (
  select l.unit_slug, count(*)::integer as lessons_total,
    count(*) filter (where lp.status = 'completed')::integer as lessons_completed
  from published_lessons l left join lesson_progress_rows lp on lp.lesson_id = l.id group by l.unit_slug
),
grammar_summary as (
  select count(*)::integer as grammar_total,
    count(gp.grammar_id)::integer as grammar_understood
  from public.grammar_points g
  left join public.user_grammar_progress gp
    on gp.grammar_id = g.id and gp.user_id = (select user_id from local_context)
  where g.jlpt_level = 'N5' and g.publication_status = 'published'
),
vocabulary_progress_union as (
  select p.vocabulary_id
  from public.user_vocabulary_progress p
  join public.vocabulary_entries v on v.id = p.vocabulary_id
  where p.user_id = (select user_id from local_context)
    and v.jlpt_level = 'N5' and v.publication_status = 'published'
  union
  select s.vocabulary_id
  from public.vocabulary_review_state s
  join public.vocabulary_entries v on v.id = s.vocabulary_id
  where s.user_id = (select user_id from local_context)
    and s.repetitions >= 3
    and v.jlpt_level = 'N5' and v.publication_status = 'published'
),
vocabulary_summary as (
  select count(*)::integer as vocabulary_total,
    (select count(*)::integer from vocabulary_progress_union) as vocabulary_mastered,
    (select count(*)::integer
      from public.vocabulary_review_state vs
      join public.vocabulary_entries v on v.id = vs.vocabulary_id
      where vs.user_id = (select user_id from local_context)
        and vs.due_at <= now()
        and v.jlpt_level = 'N5' and v.publication_status = 'published') as vocabulary_due
  from public.vocabulary_entries v
  where v.jlpt_level = 'N5' and v.publication_status = 'published'
),
kanji_summary as (
  select
    (select count(*)::integer from public.kanji_entries k where k.jlpt_level = 'N5' and k.publication_status = 'published') as kanji_total,
    (select count(*)::integer from public.kanji_review_state ks join public.kanji_entries k on k.id = ks.kanji_id
      where ks.user_id = (select user_id from local_context) and ks.status = 'known'
        and k.jlpt_level = 'N5' and k.publication_status = 'published') as kanji_mastered
),
flashcard_summary as (
  select count(*)::integer as flashcards_tracked,
    count(*) filter (where s.repetitions >= 3)::integer as flashcards_mastered,
    count(*) filter (where s.due_at <= now() and s.scheduler_state <> 'new')::integer as flashcards_due
  from public.flashcard_review_state s join public.flashcards c on c.id = s.flashcard_id
  where s.user_id = (select user_id from local_context)
),
recent_activity_rows as (
  select a.activity_date, a.study_seconds, a.lessons_completed, a.quizzes_completed, a.vocabulary_reviewed,
    a.flashcards_reviewed, a.flashcards_again, a.flashcards_known
  from public.user_daily_activity a where a.user_id = (select user_id from local_context)
  order by a.activity_date desc limit 400
),
activity_summary as (
  select coalesce(sum(a.study_seconds), 0)::bigint as total_study_seconds,
    coalesce(max(a.study_seconds) filter (where a.activity_date = (select local_today from local_context)), 0)::integer as today_study_seconds,
    coalesce(jsonb_agg(jsonb_build_object(
      'activity_date', a.activity_date, 'study_seconds', a.study_seconds, 'lessons_completed', a.lessons_completed,
      'quizzes_completed', a.quizzes_completed, 'vocabulary_reviewed', a.vocabulary_reviewed,
      'flashcards_reviewed', a.flashcards_reviewed, 'flashcards_again', a.flashcards_again, 'flashcards_known', a.flashcards_known
    ) order by a.activity_date desc), '[]'::jsonb) as recent_activity
  from recent_activity_rows a
),
attempt_rows as (
  select a.id, a.quiz_id, a.score_percentage, a.submitted_at, a.status, q.title as quiz_title, q.slug as quiz_slug
  from public.quiz_attempts a left join public.quizzes q on q.id = a.quiz_id
  where a.user_id = (select user_id from local_context) and a.status = 'graded'
  order by a.submitted_at desc limit 10
),
attempt_summary as (
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'quiz_id', a.quiz_id, 'score_percentage', a.score_percentage, 'submitted_at', a.submitted_at,
      'status', a.status, 'quizzes', jsonb_build_object('title', a.quiz_title, 'slug', a.quiz_slug)
    ) order by a.submitted_at desc), '[]'::jsonb) as recent_attempts,
    avg(a.score_percentage) filter (where position('grammar' in lower(coalesce(a.quiz_slug, '') || ' ' || coalesce(a.quiz_title, ''))) > 0) as grammar_score,
    avg(a.score_percentage) filter (where position('kana' in lower(coalesce(a.quiz_slug, '') || ' ' || coalesce(a.quiz_title, ''))) > 0) as kana_score,
    avg(a.score_percentage) filter (where position('reading' in lower(coalesce(a.quiz_slug, '') || ' ' || coalesce(a.quiz_title, ''))) > 0) as reading_score
  from attempt_rows a
),
mastery_attempt_summary as (
  -- Mastery scores use the complete graded history. The recent-attempt feed below
  -- remains capped at ten, but old Kana/Reading attempts must not disappear
  -- simply because the learner completes newer quizzes in other categories.
  select
    avg(a.score_percentage) filter (
      where lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) ~ '(grammar|particle|conjugation)'
    ) as grammar_score,
    avg(a.score_percentage) filter (
      where lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) like '%kana%'
    ) as kana_score,
    avg(a.score_percentage) filter (
      where lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) like '%reading%'
    ) as reading_score,
    count(*) filter (
      where lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) ~ '(grammar|particle|conjugation)'
    )::integer as grammar_attempts,
    count(*) filter (
      where lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) like '%kana%'
    )::integer as kana_attempts,
    count(*) filter (
      where lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) like '%reading%'
    )::integer as reading_attempts
  from public.quiz_attempts a
  left join public.quizzes q on q.id = a.quiz_id
  where a.user_id = (select user_id from local_context)
    and a.status = 'graded'
),
flashcard_settings_row as (
  select s.daily_new_limit, s.daily_review_limit, s.show_romaji, s.show_furigana
  from public.user_flashcard_settings s where s.user_id = (select user_id from local_context) limit 1
),
base_metrics as (
  select g.grammar_total, g.grammar_understood,
    v.vocabulary_total, v.vocabulary_mastered, v.vocabulary_due,
    k.kanji_total, k.kanji_mastered,
    f.flashcards_tracked, f.flashcards_mastered, f.flashcards_due,
    l.lessons_total, l.lessons_completed,
    case when l.lessons_total > 0 then round(l.lessons_completed::numeric / l.lessons_total * 100)::integer else 0 end as lesson_percentage,
    case when g.grammar_total > 0 then least(100, round(g.grammar_understood::numeric / g.grammar_total * 100))::integer else 0 end as grammar_percentage,
    case when v.vocabulary_total > 0 then least(100, round(v.vocabulary_mastered::numeric / v.vocabulary_total * 100))::integer else 0 end as vocabulary_percentage,
    case when k.kanji_total > 0 then least(100, round(k.kanji_mastered::numeric / k.kanji_total * 100))::integer else 0 end as kanji_percentage,
    coalesce(us.kana_percentage, 0) as kana_unit_percentage,
    coalesce(us.reading_percentage, 0) as reading_unit_percentage
  from grammar_summary g cross join vocabulary_summary v cross join kanji_summary k
  cross join flashcard_summary f cross join lesson_summary l
  cross join lateral (
    select
      coalesce(round(max(case when unit_slug = 'kana' and lessons_total > 0 then lessons_completed::numeric / lessons_total * 100 end)), 0)::integer as kana_percentage,
      coalesce(round(max(case when unit_slug = 'reading' and lessons_total > 0 then lessons_completed::numeric / lessons_total * 100 end)), 0)::integer as reading_percentage
    from unit_summary
  ) us
),
mastery_metrics as (
  select b.grammar_percentage as grammar,
    b.vocabulary_percentage as vocabulary, b.kanji_percentage as kanji,
    coalesce(round(a.kana_score)::integer, b.kana_unit_percentage) as kana,
    coalesce(round(a.reading_score)::integer, b.reading_unit_percentage) as reading,
    b.lesson_percentage as overall_lessons
  from base_metrics b cross join mastery_attempt_summary a
),
streak_anchor as (
  select case when exists(select 1 from recent_activity_rows a where a.activity_date = u.local_today)
    then u.local_today else u.local_today - 1 end as anchor_day from local_context u
),
streak_count as (
  select count(*)::integer as streak
  from (
    select a.activity_date, row_number() over(order by a.activity_date desc) as position
    from recent_activity_rows a cross join streak_anchor s where a.activity_date <= s.anchor_day
  ) ranked cross join streak_anchor s
  where ranked.activity_date = s.anchor_day - (ranked.position::integer - 1)
),
final_metrics as (
  select b.*, m.grammar, m.vocabulary, m.kanji, m.kana, m.reading, m.overall_lessons,
    round(m.grammar * .20 + m.vocabulary * .20 + m.kanji * .20 + m.kana * .10 + m.reading * .10 + m.overall_lessons * .20)::integer as overall_percentage
  from base_metrics b cross join mastery_metrics m
)
select jsonb_build_object(
  'profile', jsonb_build_object('displayName', (select display_name from profile_row), 'timezone', (select time_zone from profile_row)),
  'preferences', jsonb_build_object('daily_study_goal_minutes', (select daily_study_goal_minutes from preference_row),
    'preferred_jlpt_level', (select preferred_jlpt_level from preference_row), 'show_romaji', (select show_romaji from preference_row),
    'show_furigana', (select show_furigana from preference_row)),
  'progress', jsonb_build_object('overallPercentage', f.overall_percentage, 'lessonsCompleted', f.lessons_completed,
    'lessonsTotal', f.lessons_total, 'lessonPercentage', f.lesson_percentage,
    'grammarTotal', f.grammar_total, 'grammarUnderstood', f.grammar_understood,
    'vocabularyTotal', f.vocabulary_total, 'vocabularyMastered', f.vocabulary_mastered,
    'kanjiTotal', f.kanji_total, 'kanjiMastered', f.kanji_mastered,
    'grammarAttempts', (select grammar_attempts from mastery_attempt_summary),
    'kanaAttempts', (select kana_attempts from mastery_attempt_summary),
    'readingAttempts', (select reading_attempts from mastery_attempt_summary),
    'flashcardsTracked', f.flashcards_tracked, 'flashcardsMastered', f.flashcards_mastered,
    'mastery', jsonb_build_object('grammar', f.grammar, 'vocabulary', f.vocabulary, 'kanji', f.kanji,
      'kana', f.kana, 'reading', f.reading, 'overallLessons', f.overall_lessons)),
  'streak', (select streak from streak_count),
  'due', jsonb_build_object('vocabulary', f.vocabulary_due, 'flashcards', f.flashcards_due, 'total', f.vocabulary_due + f.flashcards_due),
  'dailyGoal', jsonb_build_object('minutes', (select daily_study_goal_minutes from preference_row), 'studiedSeconds', (select today_study_seconds from activity_summary)),
  'totalStudySeconds', (select total_study_seconds from activity_summary),
  'recentActivity', (select recent_activity from activity_summary),
  'recentAttempts', (select recent_attempts from attempt_summary),
  'flashcardSettings', (select jsonb_build_object('daily_new_limit', daily_new_limit, 'daily_review_limit', daily_review_limit,
    'show_romaji', show_romaji, 'show_furigana', show_furigana) from flashcard_settings_row)
)
from final_metrics f;
$$;
revoke all on function public.get_learning_dashboard() from public, anon;
grant execute on function public.get_learning_dashboard() to authenticated;

commit;
