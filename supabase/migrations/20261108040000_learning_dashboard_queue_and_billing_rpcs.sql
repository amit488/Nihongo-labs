-- Consolidate learner dashboard reads, flashcard queue selection and entitlement grants.
-- User-facing RPCs use SECURITY INVOKER so existing table grants and RLS remain authoritative.
-- Billing synchronization is restricted to service_role because it grants paid access.
begin;
create index if not exists flashcards_active_deck_queue_idx on public.flashcards(deck_id, sort_order, created_at, id) where is_active = true;
create index if not exists flashcard_review_state_active_due_queue_idx on public.flashcard_review_state(user_id, due_at, flashcard_id) where suspended_at is null and scheduler_state <> 'new';

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
  select l.id, cu.slug as unit_slug from public.lessons l
  join public.course_units cu on cu.id = l.unit_id where l.publication_status = 'published'
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
  select count(*)::integer as grammar_total from public.grammar_points g
  where g.jlpt_level = 'N5' and g.publication_status = 'published'
),
vocabulary_summary as (
  select count(*)::integer as vocabulary_total,
    count(vs.vocabulary_id) filter (where vs.repetitions >= 3)::integer as vocabulary_mastered,
    count(vs.vocabulary_id) filter (where vs.due_at <= now())::integer as vocabulary_due
  from public.vocabulary_entries v
  left join public.vocabulary_review_state vs on vs.vocabulary_id = v.id and vs.user_id = (select user_id from local_context)
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
flashcard_settings_row as (
  select s.daily_new_limit, s.daily_review_limit, s.show_romaji, s.show_furigana
  from public.user_flashcard_settings s where s.user_id = (select user_id from local_context) limit 1
),
base_metrics as (
  select g.grammar_total, v.vocabulary_total, v.vocabulary_mastered, v.vocabulary_due, k.kanji_total, k.kanji_mastered,
    f.flashcards_tracked, f.flashcards_mastered, f.flashcards_due, l.lessons_total, l.lessons_completed,
    case when l.lessons_total > 0 then round(l.lessons_completed::numeric / l.lessons_total * 100)::integer else 0 end as lesson_percentage,
    case when v.vocabulary_total > 0 then least(100, round(v.vocabulary_mastered::numeric / v.vocabulary_total * 100))::integer else 0 end as vocabulary_percentage,
    case when k.kanji_total > 0 then least(100, round(k.kanji_mastered::numeric / k.kanji_total * 100))::integer else 0 end as kanji_percentage,
    coalesce(us.grammar_percentage, 0) as grammar_unit_percentage,
    coalesce(us.kana_percentage, 0) as kana_unit_percentage,
    coalesce(us.reading_percentage, 0) as reading_unit_percentage
  from grammar_summary g cross join vocabulary_summary v cross join kanji_summary k
  cross join flashcard_summary f cross join lesson_summary l
  cross join lateral (
    select
      coalesce(round(max(case when unit_slug = 'grammar' and lessons_total > 0 then lessons_completed::numeric / lessons_total * 100 end)), 0)::integer as grammar_percentage,
      coalesce(round(max(case when unit_slug = 'kana' and lessons_total > 0 then lessons_completed::numeric / lessons_total * 100 end)), 0)::integer as kana_percentage,
      coalesce(round(max(case when unit_slug = 'reading' and lessons_total > 0 then lessons_completed::numeric / lessons_total * 100 end)), 0)::integer as reading_percentage
    from unit_summary
  ) us
),
mastery_metrics as (
  select coalesce(round(a.grammar_score)::integer, b.grammar_unit_percentage) as grammar,
    b.vocabulary_percentage as vocabulary, b.kanji_percentage as kanji,
    coalesce(round(a.kana_score)::integer, b.kana_unit_percentage) as kana,
    coalesce(round(a.reading_score)::integer, b.reading_unit_percentage) as reading,
    b.lesson_percentage as overall_lessons
  from base_metrics b cross join attempt_summary a
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
    'lessonsTotal', f.lessons_total, 'lessonPercentage', f.lesson_percentage, 'grammarTotal', f.grammar_total,
    'vocabularyTotal', f.vocabulary_total, 'vocabularyMastered', f.vocabulary_mastered, 'kanjiTotal', f.kanji_total,
    'kanjiMastered', f.kanji_mastered, 'flashcardsTracked', f.flashcards_tracked, 'flashcardsMastered', f.flashcards_mastered,
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

create or replace function public.get_due_flashcards(_deck_id uuid, _mode text default 'mixed')
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deck jsonb; v_settings jsonb; v_time_zone text; v_today date;
  v_reviewed_today integer := 0; v_new_today integer := 0;
  v_review_limit integer := 200; v_new_limit integer := 20;
  v_review_remaining integer := 0; v_new_remaining integer := 0;
  v_due jsonb := '[]'::jsonb; v_new_cards jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if _deck_id is null or coalesce(_mode, '') not in ('new', 'review', 'mixed', 'custom') then
    raise exception 'A valid deck and flashcard mode are required' using errcode = '22023';
  end if;
  select jsonb_build_object('id', d.id, 'title', d.title, 'description', d.description,
    'jlpt_level', d.jlpt_level, 'access_level', d.access_level, 'deck_type', d.deck_type)
    into v_deck from public.flashcard_decks d where d.id = _deck_id;
  if v_deck is null then raise exception 'Flashcard deck not found or unavailable' using errcode = 'P0002'; end if;
  select coalesce(p.timezone, 'Asia/Kolkata') into v_time_zone from public.profiles p where p.id = v_user_id;
  v_today := (now() at time zone coalesce(v_time_zone, 'Asia/Kolkata'))::date;
  select jsonb_build_object('daily_new_limit', coalesce(s.daily_new_limit, 20),
      'daily_review_limit', coalesce(s.daily_review_limit, 200), 'desired_retention', coalesce(s.desired_retention, .900),
      'show_romaji', coalesce(s.show_romaji, true), 'show_furigana', coalesce(s.show_furigana, true)),
    coalesce(s.daily_new_limit, 20), coalesce(s.daily_review_limit, 200)
    into v_settings, v_new_limit, v_review_limit
    from (select 1) seed left join public.user_flashcard_settings s on s.user_id = v_user_id;
  select coalesce(a.flashcards_reviewed, 0), coalesce(a.flashcards_new, 0)
    into v_reviewed_today, v_new_today from (select 1) seed
    left join public.user_daily_activity a on a.user_id = v_user_id and a.activity_date = v_today;
  v_review_remaining := greatest(0, v_review_limit - greatest(0, v_reviewed_today - v_new_today));
  v_new_remaining := greatest(0, v_new_limit - v_new_today);

  if _mode <> 'new' and v_review_remaining > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'front_text', q.front_text, 'back_text', q.back_text, 'front_reading', q.front_reading,
      'back_reading', q.back_reading, 'front_romaji', q.front_romaji, 'back_romaji', q.back_romaji,
      'hint', q.hint, 'example_sentence', q.example_sentence, 'example_translation', q.example_translation,
      'source_type', q.source_type, 'vocabulary_id', q.vocabulary_id, 'kanji_id', q.kanji_id,
      'grammar_id', q.grammar_id, 'sort_order', q.sort_order
    ) order by q.due_at, q.sort_order, q.id), '[]'::jsonb) into v_due
    from (
      select c.id, c.front_text, c.back_text, c.front_reading, c.back_reading, c.front_romaji, c.back_romaji,
        c.hint, c.example_sentence, c.example_translation, c.source_type, c.vocabulary_id, c.kanji_id,
        c.grammar_id, c.sort_order, s.due_at
      from public.flashcards c
      join public.flashcard_review_state s on s.flashcard_id = c.id and s.user_id = v_user_id
      where c.deck_id = _deck_id and c.is_active = true and s.scheduler_state <> 'new'
        and s.due_at <= now() and s.suspended_at is null and (s.buried_until is null or s.buried_until <= now())
      order by s.due_at, c.sort_order, c.id limit v_review_remaining
    ) q;
  end if;

  if _mode <> 'review' and v_new_remaining > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'front_text', q.front_text, 'back_text', q.back_text, 'front_reading', q.front_reading,
      'back_reading', q.back_reading, 'front_romaji', q.front_romaji, 'back_romaji', q.back_romaji,
      'hint', q.hint, 'example_sentence', q.example_sentence, 'example_translation', q.example_translation,
      'source_type', q.source_type, 'vocabulary_id', q.vocabulary_id, 'kanji_id', q.kanji_id,
      'grammar_id', q.grammar_id, 'sort_order', q.sort_order
    ) order by q.sort_order, q.created_at, q.id), '[]'::jsonb) into v_new_cards
    from (
      select c.id, c.front_text, c.back_text, c.front_reading, c.back_reading, c.front_romaji, c.back_romaji,
        c.hint, c.example_sentence, c.example_translation, c.source_type, c.vocabulary_id, c.kanji_id,
        c.grammar_id, c.sort_order, c.created_at
      from public.flashcards c
      left join public.flashcard_review_state s on s.flashcard_id = c.id and s.user_id = v_user_id
      where c.deck_id = _deck_id and c.is_active = true
        and (s.flashcard_id is null or (s.scheduler_state = 'new' and s.suspended_at is null
          and (s.buried_until is null or s.buried_until <= now())))
      order by c.sort_order, c.created_at, c.id limit v_new_remaining
    ) q;
  end if;
  return jsonb_build_object('deck', v_deck, 'settings', v_settings, 'due', v_due, 'newCards', v_new_cards,
    'dueCount', jsonb_array_length(v_due), 'newCount', jsonb_array_length(v_new_cards),
    'quota', jsonb_build_object('reviewRemaining', v_review_remaining, 'newRemaining', v_new_remaining));
end;
$$;
revoke all on function public.get_due_flashcards(uuid, text) from public, anon;
grant execute on function public.get_due_flashcards(uuid, text) to authenticated;

create or replace function public.sync_plan_entitlements(
  _user_id uuid, _plan_id uuid, _subscription_id uuid, _payment_id uuid,
  _starts_at timestamptz, _ends_at timestamptz, _lifetime boolean default false
)
returns text[] language plpgsql security definer set search_path = ''
as $$
declare v_feature_keys text[];
begin
  if _user_id is null or _plan_id is null or _subscription_id is null or _starts_at is null then
    raise exception 'User, plan, subscription and start timestamp are required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_user_id::text || ':' || _subscription_id::text, 0));
  select coalesce(array_agg(pf.feature_key order by pf.feature_key), array[]::text[]) into v_feature_keys
    from public.plan_features pf where pf.plan_id = _plan_id
      and (pf.feature_value = 'true'::jsonb or pf.feature_value = '1'::jsonb or pf.feature_value = '"true"'::jsonb
        or (jsonb_typeof(pf.feature_value) = 'object' and
          (pf.feature_value -> 'enabled' = 'true'::jsonb or pf.feature_value -> 'value' = 'true'::jsonb)));
  if cardinality(v_feature_keys) = 0 then return v_feature_keys; end if;
  insert into public.user_entitlements(user_id, feature_key, source_subscription_id, source_payment_id, status, starts_at, ends_at)
  select _user_id, pf.feature_key, _subscription_id, _payment_id, 'active', _starts_at, _ends_at
  from public.plan_features pf where pf.plan_id = _plan_id and pf.feature_key = any(v_feature_keys)
    and not exists (
      select 1 from public.user_entitlements e where e.user_id = _user_id and e.feature_key = pf.feature_key
        and e.source_subscription_id = _subscription_id
        and ((_lifetime and _payment_id is not null and e.source_payment_id = _payment_id)
          or ((not _lifetime or _payment_id is null) and e.starts_at = _starts_at))
    );
  return v_feature_keys;
end;
$$;
revoke all on function public.sync_plan_entitlements(uuid, uuid, uuid, uuid, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.sync_plan_entitlements(uuid, uuid, uuid, uuid, timestamptz, timestamptz, boolean) to service_role;

drop function if exists public.record_user_heartbeat(uuid, date);
drop function if exists public.record_user_heartbeat(uuid, date, integer);
drop function if exists public.record_user_heartbeat(uuid, date, integer, uuid);
commit;
