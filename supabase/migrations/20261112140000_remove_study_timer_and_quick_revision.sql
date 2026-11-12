-- Remove site-wide study-time tracking and the automatic Quick Revision feature.
-- Quiz attempt countdowns and the separate FSRS vocabulary flashcard review remain.
begin;

create or replace function public.record_user_activity(
  _user_id uuid,
  _activity_date date,
  _increments jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lessons_completed integer := coalesce((_increments->>'lessons_completed')::integer, 0);
  v_quizzes_completed integer := coalesce((_increments->>'quizzes_completed')::integer, 0);
  v_vocabulary_reviewed integer := coalesce((_increments->>'vocabulary_reviewed')::integer, 0);
  v_flashcards_reviewed integer := coalesce((_increments->>'flashcards_reviewed')::integer, 0);
  v_flashcards_again integer := coalesce((_increments->>'flashcards_again')::integer, 0);
  v_flashcards_known integer := coalesce((_increments->>'flashcards_known')::integer, 0);
  v_flashcards_new integer := coalesce((_increments->>'flashcards_new')::integer, 0);
begin
  if _user_id is null or _activity_date is null then
    raise exception 'user_id and activity_date are required';
  end if;
  if least(v_lessons_completed, v_quizzes_completed, v_vocabulary_reviewed,
      v_flashcards_reviewed, v_flashcards_again, v_flashcards_known, v_flashcards_new) < 0 then
    raise exception 'activity increments must be non-negative';
  end if;

  insert into public.user_daily_activity (
    user_id, activity_date, lessons_completed, quizzes_completed,
    vocabulary_reviewed, flashcards_reviewed, flashcards_again,
    flashcards_known, flashcards_new, updated_at
  ) values (
    _user_id, _activity_date, v_lessons_completed, v_quizzes_completed,
    v_vocabulary_reviewed, v_flashcards_reviewed, v_flashcards_again,
    v_flashcards_known, v_flashcards_new, now()
  )
  on conflict (user_id, activity_date) do update set
    lessons_completed = public.user_daily_activity.lessons_completed + excluded.lessons_completed,
    quizzes_completed = public.user_daily_activity.quizzes_completed + excluded.quizzes_completed,
    vocabulary_reviewed = public.user_daily_activity.vocabulary_reviewed + excluded.vocabulary_reviewed,
    flashcards_reviewed = public.user_daily_activity.flashcards_reviewed + excluded.flashcards_reviewed,
    flashcards_again = public.user_daily_activity.flashcards_again + excluded.flashcards_again,
    flashcards_known = public.user_daily_activity.flashcards_known + excluded.flashcards_known,
    flashcards_new = public.user_daily_activity.flashcards_new + excluded.flashcards_new,
    updated_at = now();
end;
$$;
revoke all on function public.record_user_activity(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.record_user_activity(uuid, date, jsonb) to service_role;

-- Remove study-time parameters from activity-producing RPCs. Quiz duration
-- remains stored for quiz history; it is no longer added to study-time totals.
drop function if exists public.finalize_quiz_attempt(uuid, uuid, numeric, numeric, numeric, integer, jsonb, date, integer);
create or replace function public.finalize_quiz_attempt(
  _attempt_id uuid,
  _user_id uuid,
  _total_points numeric,
  _earned_points numeric,
  _score_percentage numeric,
  _duration_seconds integer,
  _responses jsonb,
  _activity_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_question_count integer;
  v_saved_count integer := 0;
  v_distinct_count integer := 0;
  v_item record;
begin
  if _user_id is null or _attempt_id is null or _activity_date is null then
    raise exception 'attempt, user and activity date are required';
  end if;
  if _total_points < 0 or _earned_points < 0 or _earned_points > _total_points
     or _score_percentage < 0 or _score_percentage > 100
     or _duration_seconds < 0 then
    raise exception 'invalid quiz totals';
  end if;
  if jsonb_typeof(_responses) <> 'array' then
    raise exception 'responses must be a JSON array';
  end if;

  select qa.quiz_id into v_quiz_id
  from public.quiz_attempts qa
  where qa.id = _attempt_id and qa.user_id = _user_id and qa.status = 'in_progress'
  for update;
  if not found then
    raise exception 'Quiz attempt has already been finalized or does not belong to this user'
      using errcode = 'P0002';
  end if;

  select count(*) into v_question_count
  from public.quiz_questions qq
  where qq.quiz_id = v_quiz_id and qq.is_active;

  for v_item in
    select * from jsonb_to_recordset(_responses) as r(
      question_id uuid,
      response jsonb,
      is_correct boolean,
      points_awarded numeric,
      answered_at timestamptz
    )
  loop
    if not exists (
      select 1 from public.quiz_questions qq
      where qq.id = v_item.question_id and qq.quiz_id = v_quiz_id and qq.is_active
    ) then
      raise exception 'A response references a question outside this quiz';
    end if;

    insert into public.quiz_responses (
      attempt_id, user_id, question_id, response, is_correct, points_awarded, answered_at
    ) values (
      _attempt_id, _user_id, v_item.question_id, coalesce(v_item.response, 'null'::jsonb),
      coalesce(v_item.is_correct, false), coalesce(v_item.points_awarded, 0),
      coalesce(v_item.answered_at, now())
    )
    on conflict (attempt_id, question_id) do update set
      response = excluded.response,
      is_correct = excluded.is_correct,
      points_awarded = excluded.points_awarded,
      answered_at = excluded.answered_at;
    v_saved_count := v_saved_count + 1;
  end loop;

  select count(distinct x.question_id) into v_distinct_count
  from jsonb_to_recordset(_responses) as x(question_id uuid);
  if v_saved_count <> v_question_count or v_distinct_count <> v_question_count then
    raise exception 'A graded response is required exactly once for every active question';
  end if;

  update public.quiz_attempts set
    status = 'graded',
    total_points = _total_points,
    earned_points = _earned_points,
    score_percentage = _score_percentage,
    submitted_at = now(),
    graded_at = now(),
    duration_seconds = _duration_seconds
  where id = _attempt_id and user_id = _user_id and status = 'in_progress';

  perform public.record_user_activity(
    _user_id,
    _activity_date,
    jsonb_build_object(
      'quizzes_completed', 1
    )
  );
end;
$$;
revoke all on function public.finalize_quiz_attempt(uuid, uuid, numeric, numeric, numeric, integer, jsonb, date) from public, anon, authenticated;
grant execute on function public.finalize_quiz_attempt(uuid, uuid, numeric, numeric, numeric, integer, jsonb, date) to service_role;

drop function if exists public.persist_flashcard_review(uuid, uuid, uuid, public.flashcard_rating, integer, jsonb, jsonb, date, integer, integer, integer);
create or replace function public.persist_flashcard_review(
  _user_id uuid,
  _flashcard_id uuid,
  _session_id uuid,
  _rating public.flashcard_rating,
  _response_time_ms integer,
  _state_before jsonb,
  _state_after jsonb,
  _activity_date date,
  _daily_new_limit integer,
  _daily_review_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_deck uuid;
  v_card_deck uuid;
  v_review_id uuid;
  v_due_at timestamptz;
  v_scheduler_state public.flashcard_scheduler_state;
  v_scheduled_days numeric;
  v_is_new boolean := coalesce((_state_before->>'state')::integer, 0) = 0;
  v_reviewed_today integer := 0;
  v_new_today integer := 0;
begin
  if _user_id is null or _flashcard_id is null or _session_id is null or _activity_date is null then
    raise exception 'user, card, session and activity date are required';
  end if;
  if _response_time_ms is not null and (_response_time_ms < 0 or _response_time_ms > 3600000) then
    raise exception 'invalid response time';
  end if;
  if _daily_new_limit is null or _daily_new_limit < 0 or _daily_new_limit > 500
     or _daily_review_limit is null or _daily_review_limit < 0 or _daily_review_limit > 2000 then
    raise exception 'invalid daily limits';
  end if;

  -- Guarantee a lockable per-user/day row even when this is the first activity.
  insert into public.user_daily_activity(user_id, activity_date)
  values (_user_id, _activity_date)
  on conflict (user_id, activity_date) do nothing;
  select flashcards_reviewed, flashcards_new
  into v_reviewed_today, v_new_today
  from public.user_daily_activity
  where user_id = _user_id and activity_date = _activity_date
  for update;
  v_reviewed_today := coalesce(v_reviewed_today, 0);
  v_new_today := coalesce(v_new_today, 0);
  if v_is_new and v_new_today >= _daily_new_limit then
    raise exception 'Daily new-card limit reached' using errcode = 'P0001';
  end if;
  if not v_is_new and greatest(0, v_reviewed_today - v_new_today) >= _daily_review_limit then
    raise exception 'Daily review limit reached' using errcode = 'P0001';
  end if;

  select fs.deck_id into v_session_deck
  from public.flashcard_sessions fs
  where fs.id = _session_id and fs.user_id = _user_id and fs.finished_at is null
  for update;
  if not found then
    raise exception 'Active flashcard session not found';
  end if;

  -- The scheduler runs in trusted TypeScript, while this RPC owns the write
  -- transaction. Reject stale calculations so two tabs/sessions cannot overwrite
  -- each other's FSRS state for the same learner/card.
  perform 1 from public.flashcard_review_state frs
  where frs.user_id = _user_id and frs.flashcard_id = _flashcard_id
  for update;
  if found then
    if coalesce((_state_before->>'reps')::integer, 0) <> (
         select frs.repetitions from public.flashcard_review_state frs
         where frs.user_id = _user_id and frs.flashcard_id = _flashcard_id
       )
       or nullif(_state_before->>'last_review', '')::timestamptz is distinct from (
         select frs.last_reviewed_at from public.flashcard_review_state frs
         where frs.user_id = _user_id and frs.flashcard_id = _flashcard_id
       ) then
      raise exception 'Flashcard state changed; reload the card and retry.' using errcode = '40001';
    end if;
  elsif coalesce((_state_before->>'reps')::integer, 0) <> 0 then
    raise exception 'Flashcard state changed; reload the card and retry.' using errcode = '40001';
  end if;

  select fc.deck_id into v_card_deck
  from public.flashcards fc
  where fc.id = _flashcard_id and fc.is_active;
  if not found or v_card_deck <> v_session_deck then
    raise exception 'Flashcard does not belong to this active session';
  end if;

  if exists (
    select 1 from public.flashcard_reviews fr
    where fr.session_id = _session_id and fr.flashcard_id = _flashcard_id
  ) then
    raise exception 'This card has already been reviewed in the current session'
      using errcode = '23505';
  end if;

  insert into public.flashcard_reviews (
    user_id, flashcard_id, session_id, rating, response_time_ms,
    reviewed_at, scheduler_version, state_before, state_after, processed_at
  ) values (
    _user_id, _flashcard_id, _session_id, _rating, _response_time_ms,
    now(), 'fsrs-6', _state_before, _state_after, now()
  ) returning id into v_review_id;

  v_scheduler_state := (_state_after->>'scheduler_state')::public.flashcard_scheduler_state;
  v_due_at := (_state_after->>'due_at')::timestamptz;
  v_scheduled_days := coalesce((_state_after->>'scheduled_days')::numeric, 0);

  insert into public.flashcard_review_state (
    user_id, flashcard_id, scheduler_state, due_at, stability_days, difficulty,
    elapsed_days, scheduled_days, learning_step, repetitions, lapses,
    last_rating, last_reviewed_at, last_review_id, updated_at
  ) values (
    _user_id, _flashcard_id, v_scheduler_state, v_due_at,
    nullif(_state_after->>'stability_days','')::numeric,
    nullif(_state_after->>'difficulty','')::numeric,
    coalesce(nullif(_state_after->>'elapsed_days','')::numeric, 0),
    v_scheduled_days,
    coalesce(nullif(_state_after->>'learning_step','')::smallint, 0),
    coalesce(nullif(_state_after->>'repetitions','')::integer, 0),
    coalesce(nullif(_state_after->>'lapses','')::integer, 0),
    _rating,
    (_state_after->>'last_reviewed_at')::timestamptz,
    v_review_id,
    now()
  )
  on conflict (user_id, flashcard_id) do update set
    scheduler_state = excluded.scheduler_state,
    due_at = excluded.due_at,
    stability_days = excluded.stability_days,
    difficulty = excluded.difficulty,
    elapsed_days = excluded.elapsed_days,
    scheduled_days = excluded.scheduled_days,
    learning_step = excluded.learning_step,
    repetitions = excluded.repetitions,
    lapses = excluded.lapses,
    last_rating = excluded.last_rating,
    last_reviewed_at = excluded.last_reviewed_at,
    last_review_id = excluded.last_review_id,
    updated_at = now();

  update public.flashcard_sessions set
    cards_seen = cards_seen + 1,
    again_count = again_count + case when _rating = 'again' then 1 else 0 end,
    hard_count = hard_count + case when _rating = 'hard' then 1 else 0 end,
    good_count = good_count + case when _rating = 'good' then 1 else 0 end,
    easy_count = easy_count + case when _rating = 'easy' then 1 else 0 end,
    elapsed_seconds = elapsed_seconds + ceil(coalesce(_response_time_ms, 0)::numeric / 1000)::integer
  where id = _session_id and user_id = _user_id;

  insert into public.user_flashcard_decks (user_id, deck_id, status, last_studied_at)
  values (_user_id, v_card_deck, 'active', now())
  on conflict (user_id, deck_id) do update set status = 'active', last_studied_at = excluded.last_studied_at;

  perform public.record_user_activity(
    _user_id,
    _activity_date,
    jsonb_build_object(
      'flashcards_reviewed', 1,
      'flashcards_again', case when _rating = 'again' then 1 else 0 end,
      'flashcards_known', case when _rating in ('good','easy') then 1 else 0 end,
      'flashcards_new', case when v_is_new then 1 else 0 end
    )
  );

  return jsonb_build_object(
    'reviewId', v_review_id,
    'rating', _rating,
    'dueAt', v_due_at,
    'schedulerState', v_scheduler_state,
    'intervalDays', v_scheduled_days
  );
end;
$$;
revoke all on function public.persist_flashcard_review(uuid, uuid, uuid, public.flashcard_rating, integer, jsonb, jsonb, date, integer, integer) from public, anon, authenticated;
grant execute on function public.persist_flashcard_review(uuid, uuid, uuid, public.flashcard_rating, integer, jsonb, jsonb, date, integer, integer) to service_role;

drop function if exists public.persist_lesson_progress(uuid, uuid, text, integer, date, integer);
create or replace function public.persist_lesson_progress(
  _user_id uuid,
  _lesson_id uuid,
  _status text,
  _last_position_seconds integer,
  _activity_date date
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.lesson_progress%rowtype;
  v_next_status text;
  v_completed_at timestamptz;
  v_completed_increment integer := 0;
begin
  if _user_id is null or _lesson_id is null or _activity_date is null then
    raise exception 'user, lesson and activity date are required';
  end if;
  if _status not in ('in_progress', 'completed')
     or _last_position_seconds is null or _last_position_seconds < 0 or _last_position_seconds > 86400 then
    raise exception 'invalid lesson progress values';
  end if;
  if not exists (
    select 1 from public.lessons l
    where l.id = _lesson_id and l.publication_status = 'published'
  ) then
    raise exception 'Lesson not found or unavailable' using errcode = 'P0002';
  end if;

  insert into public.lesson_progress(user_id, lesson_id, status)
  values (_user_id, _lesson_id, 'in_progress')
  on conflict (user_id, lesson_id) do nothing;

  select * into v_current
  from public.lesson_progress
  where user_id = _user_id and lesson_id = _lesson_id
  for update;

  v_next_status := case when v_current.status = 'completed' then 'completed' else _status end;
  v_completed_at := case
    when v_next_status = 'completed' then coalesce(v_current.completed_at, now())
    else null
  end;
  if v_current.status <> 'completed' and v_next_status = 'completed' then
    v_completed_increment := 1;
  end if;

  update public.lesson_progress set
    status = v_next_status,
    last_position_seconds = greatest(last_position_seconds, _last_position_seconds),
    completed_at = v_completed_at,
    updated_at = now()
  where user_id = _user_id and lesson_id = _lesson_id
  returning * into v_current;

  if v_completed_increment > 0 then
    perform public.record_user_activity(
      _user_id, _activity_date,
      jsonb_build_object('lessons_completed', v_completed_increment)
    );
  end if;
  return v_current;
end;
$$;
revoke all on function public.persist_lesson_progress(uuid, uuid, text, integer, date) from public, anon, authenticated;
grant execute on function public.persist_lesson_progress(uuid, uuid, text, integer, date) to service_role;


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
  select coalesce(p.preferred_jlpt_level, 'N5'::public.jlpt_level) as preferred_jlpt_level,
    coalesce(p.show_romaji, true) as show_romaji, coalesce(p.show_furigana, true) as show_furigana
  from local_context u left join public.user_preferences p on p.user_id = u.user_id
),
published_lessons as (
  -- Only lessons with a real graded checkpoint are included in this progress
  -- card. Kana's two script lessons share the mixed-script assessment.
  select l.id, cu.slug as unit_slug
  from public.lessons l
  join public.course_units cu on cu.id = l.unit_id
  join public.courses c on c.id = cu.course_id
  where l.publication_status = 'published'
    and c.slug = 'nihongo-n5-foundations'
    and (
      exists (
        select 1 from public.quizzes q
        where q.lesson_id = l.id
          and q.publication_status = 'published'
      )
      or (
        cu.slug = 'kana'
        and l.slug = 'katakana'
        and exists (
          select 1
          from public.lessons hiragana
          join public.quizzes q on q.lesson_id = hiragana.id
          where hiragana.unit_id = cu.id
            and hiragana.slug = 'hiragana'
            and hiragana.publication_status = 'published'
            and q.publication_status = 'published'
        )
      )
    )
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
  select a.activity_date
  from public.user_daily_activity a where a.user_id = (select user_id from local_context)
  order by a.activity_date desc limit 400
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
  'preferences', jsonb_build_object(
    'preferred_jlpt_level', (select preferred_jlpt_level from preference_row),
    'show_romaji', (select show_romaji from preference_row),
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
  'recentAttempts', (select recent_attempts from attempt_summary),
  'flashcardSettings', (select jsonb_build_object('daily_new_limit', daily_new_limit, 'daily_review_limit', daily_review_limit,
    'show_romaji', show_romaji, 'show_furigana', show_furigana) from flashcard_settings_row)
)
from final_metrics f;
$$;
revoke all on function public.get_learning_dashboard() from public, anon;
grant execute on function public.get_learning_dashboard() to authenticated;

create or replace function public.admin_get_dashboard_aggregates(
  _week_start date,
  _month_start timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(_week_start, _week_start + 6, interval '1 day')::date as day
  ),
  activity as (
    select activity_date,
      count(distinct user_id)::integer as active_learners,
      coalesce(sum(lessons_completed), 0)::bigint as lessons_completed,
      coalesce(sum(quizzes_completed), 0)::bigint as quizzes_completed
    from public.user_daily_activity
    where activity_date between _week_start and _week_start + 6
    group by activity_date
  ),
  payment_totals as (
    select currency,
      coalesce(sum(amount_minor), 0)::bigint as gross_minor,
      coalesce(sum(refunded_amount_minor), 0)::bigint as refunded_minor
    from public.payments
    where status in ('captured', 'partially_refunded', 'refunded')
      and captured_at >= _month_start
    group by currency
  )
  select jsonb_build_object(
    'activeLearnersSevenDays',
      (select count(distinct user_id)::integer from public.user_daily_activity
        where activity_date between _week_start and _week_start + 6),
    'weeklyActivity',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'activeLearners', coalesce(a.active_learners, 0),
          'lessonsCompleted', coalesce(a.lessons_completed, 0),
          'quizzesCompleted', coalesce(a.quizzes_completed, 0)
        ) order by d.day)
        from days d left join activity a on a.activity_date = d.day
      ), '[]'::jsonb),
    'monthlyPaymentsByCurrency',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', p.currency,
          'grossMinor', p.gross_minor,
          'refundedMinor', p.refunded_minor,
          'netMinor', p.gross_minor - p.refunded_minor
        ) order by p.currency)
        from payment_totals p
      ), '[]'::jsonb)
  );
$$;
revoke all on function public.admin_get_dashboard_aggregates(date, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_get_dashboard_aggregates(date, timestamptz) to service_role;

create or replace function public.update_learning_settings(
  _user_id uuid,
  _profile_patch jsonb default '{}'::jsonb,
  _preferences_patch jsonb default '{}'::jsonb,
  _flashcards_patch jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> _user_id then
    raise exception 'Not authorized to update these settings' using errcode = '42501';
  end if;

  if coalesce(_profile_patch, '{}'::jsonb) <> '{}'::jsonb then
    update public.profiles
      set display_name = coalesce(_profile_patch->>'display_name', display_name),
          timezone = coalesce(_profile_patch->>'timezone', timezone),
          updated_at = now()
      where id = _user_id;
  end if;

  if coalesce(_preferences_patch, '{}'::jsonb) <> '{}'::jsonb then
    insert into public.user_preferences (
      user_id, preferred_jlpt_level, show_romaji, show_furigana
    ) values (
      _user_id,
      coalesce((_preferences_patch->>'preferred_jlpt_level')::public.jlpt_level, 'N5'::public.jlpt_level),
      coalesce((_preferences_patch->>'show_romaji')::boolean, true),
      coalesce((_preferences_patch->>'show_furigana')::boolean, true)
    )
    on conflict (user_id) do update set
      preferred_jlpt_level = coalesce((_preferences_patch->>'preferred_jlpt_level')::public.jlpt_level, public.user_preferences.preferred_jlpt_level),
      show_romaji = coalesce((_preferences_patch->>'show_romaji')::boolean, public.user_preferences.show_romaji),
      show_furigana = coalesce((_preferences_patch->>'show_furigana')::boolean, public.user_preferences.show_furigana),
      updated_at = now();
  end if;

  if coalesce(_flashcards_patch, '{}'::jsonb) <> '{}'::jsonb then
    insert into public.user_flashcard_settings (user_id, show_romaji, show_furigana)
    values (
      _user_id,
      coalesce((_flashcards_patch->>'show_romaji')::boolean, true),
      coalesce((_flashcards_patch->>'show_furigana')::boolean, true)
    )
    on conflict (user_id) do update set
      show_romaji = coalesce((_flashcards_patch->>'show_romaji')::boolean, public.user_flashcard_settings.show_romaji),
      show_furigana = coalesce((_flashcards_patch->>'show_furigana')::boolean, public.user_flashcard_settings.show_furigana),
      updated_at = now();
  end if;
end;
$$;
revoke all on function public.update_learning_settings(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_learning_settings(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.get_vocabulary_intelligence(_level text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with learned_count as (
  select count(*)::integer as value
  from public.user_vocabulary_progress p
  join public.vocabulary_entries v on v.id = p.vocabulary_id
  where p.user_id = (select auth.uid())
    and v.jlpt_level = _level::public.jlpt_level
),
fsrs as (
  select
    v.id,
    v.word,
    v.kana,
    v.romaji,
    v.meaning,
    v.part_of_speech,
    v.example_sentence,
    v.example_reading,
    v.example_translation,
    s.due_at,
    s.repetitions,
    s.interval_days,
    s.last_rating,
    (s.due_at <= now()) as due,
    (s.last_rating <= 2 or (s.due_at <= now() and s.repetitions < 2)) as at_risk,
    (s.repetitions >= 3 and s.due_at > now() and s.last_rating >= 3) as mastered
  from public.vocabulary_review_state s
  join public.vocabulary_entries v on v.id = s.vocabulary_id
  where s.user_id = (select auth.uid())
    and v.jlpt_level = _level::public.jlpt_level
    and v.publication_status = 'published'
),
unified as (
  select
    f.id, f.word, f.kana, f.romaji, f.meaning, f.part_of_speech,
    f.example_sentence, f.example_reading, f.example_translation,
    f.due_at, f.repetitions, f.interval_days, f.last_rating,
    f.due, f.at_risk, f.mastered
  from fsrs f
),
summary as (
  select
    count(*)::integer as tracked_count,
    count(*) filter (where due)::integer as due_count,
    count(*) filter (where at_risk)::integer as at_risk_count,
    count(*) filter (where mastered)::integer as mastered_count
  from unified
),
ranked as (
  select
    u.*,
    row_number() over (
      order by
        case when u.at_risk then 0 else 1 end,
        case when u.at_risk then coalesce(u.last_rating, 5) else 0 end,
        u.due_at asc,
        u.id
    ) as position
  from unified u
  where u.at_risk or u.due
)
select jsonb_build_object(
  'level', _level,
  'learnedCount', (select value from learned_count),
  'trackedCount', s.tracked_count,
  'dueCount', s.due_count,
  'atRiskCount', s.at_risk_count,
  'masteredCount', s.mastered_count,
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'word', r.word,
      'kana', r.kana,
      'romaji', r.romaji,
      'meaning', r.meaning,
      'partOfSpeech', r.part_of_speech,
      'example', r.example_sentence,
      'exampleReading', r.example_reading,
      'exampleMeaning', r.example_translation,
      'dueAt', r.due_at,
      'repetitions', r.repetitions,
      'intervalDays', r.interval_days,
      'lastRating', r.last_rating,
      'due', r.due,
      'atRisk', r.at_risk,
      'mastered', r.mastered
    ) order by r.position)
    from ranked r
    where r.position <= 10
  ), '[]'::jsonb)
)
from summary s;
$$;
revoke all on function public.get_vocabulary_intelligence(text) from public, anon;
grant execute on function public.get_vocabulary_intelligence(text) to authenticated;

create or replace function public.get_grammar_intelligence()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with caller as (
  select (select auth.uid()) as user_id
),
tagged_events as (
  select e.skill_tag, e.is_correct, e.created_at, null::text as label_override
  from public.grammar_attempt_events e
  where e.user_id = (select user_id from caller)
),
sentence_events as (
  select
    tags.skill_tag,
    s.is_correct,
    s.created_at,
    null::text as label_override
  from public.sentence_construction_attempts s
  cross join lateral (
    select distinct tag
    from unnest(coalesce(s.grammar_tags, array[]::text[])) as values_by_tag(tag)
    where tag ~ '^[a-z0-9:_-]{2,80}$'
  ) as tags(skill_tag)
  where s.user_id = (select user_id from caller)
),
topic_events as (
  select * from tagged_events
  union all
  select * from sentence_events
),
topic_aggregates as (
  select
    e.skill_tag as tag,
    count(*)::integer as attempts,
    count(*) filter (where not e.is_correct)::integer as misses,
    round(
      count(*) filter (where e.is_correct)::numeric * 100 / nullif(count(*), 0)
    )::integer as accuracy,
    max(e.created_at) filter (where not e.is_correct) as latest_miss,
    (array_agg(e.is_correct order by e.created_at desc))[1] as latest_is_correct,
    max(e.label_override) filter (where e.label_override is not null) as label_override
  from topic_events e
  group by e.skill_tag
),
topic_results as (
  select
    a.*,
    (
      a.misses >= 2
      or (a.attempts >= 2 and a.accuracy < 70)
      or (not a.latest_is_correct and a.attempts >= 1)
    ) as weak
  from topic_aggregates a
),
totals as (
  select
    (
      (select count(*) from public.grammar_attempt_events e where e.user_id = (select user_id from caller))
      + (select count(*) from public.sentence_construction_attempts s where s.user_id = (select user_id from caller))
    )::integer as attempts,
    (
      (select count(*) from public.grammar_attempt_events e where e.user_id = (select user_id from caller) and e.is_correct)
      + (select count(*) from public.sentence_construction_attempts s where s.user_id = (select user_id from caller) and s.is_correct)
    )::integer as correct
),
topic_payload as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'tag', r.tag,
    'attempts', r.attempts,
    'misses', r.misses,
    'accuracy', r.accuracy,
    'latestMiss', r.latest_miss,
    'weak', r.weak,
    'labelOverride', r.label_override
  ) order by r.weak desc, r.misses desc, r.accuracy asc), '[]'::jsonb) as topics
  from (
    select * from topic_results
    order by weak desc, misses desc, accuracy asc
    limit 10
  ) r
)
select jsonb_build_object(
  'totalAttempts', t.attempts,
  'accuracy', case when t.attempts > 0 then round(t.correct::numeric * 100 / t.attempts)::integer else 0 end,
  'weakTopicCount', (select count(*)::integer from topic_results where weak),
  'topics', p.topics,
  'hasTaggedHistory', t.attempts > 0
)
from totals t cross join topic_payload p;
$$;
revoke all on function public.get_grammar_intelligence() from public, anon;
grant execute on function public.get_grammar_intelligence() to authenticated;

drop function if exists public.persist_quick_revision_attempt(uuid, uuid, text, uuid, text, text, boolean, boolean, integer);
drop function if exists public.get_admin_cron_monitoring(integer);
drop function if exists public.get_admin_cron_monitoring();
drop function if exists public.cleanup_expired_user_activity_heartbeat_requests();
drop function if exists public.record_user_heartbeat(uuid, date, integer, uuid, timestamptz);
drop function if exists public.record_user_heartbeat(uuid, date, integer, uuid);
drop function if exists public.record_user_heartbeat(uuid, date, integer);
drop function if exists public.record_user_heartbeat(uuid, date);

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job_id in execute
      'select jobid from cron.job where jobname = ''nihongo-labs-heartbeat-request-retention'''
    loop
      execute 'select cron.unschedule($1)' using v_job_id;
    end loop;
  end if;
end;
$$;

drop table if exists public.quick_revision_attempts;
drop table if exists public.quick_revision_state;
drop table if exists public.user_activity_heartbeat_requests;
drop table if exists public.user_activity_heartbeat;
drop table if exists nihongo_admin_private.cron_job_run_audit;

-- Remove timer-only dates so they are not counted as historical learning streaks.
delete from public.user_daily_activity
where study_seconds > 0
  and lessons_completed = 0
  and quizzes_completed = 0
  and vocabulary_reviewed = 0
  and flashcards_reviewed = 0
  and flashcards_again = 0
  and flashcards_known = 0
  and flashcards_new = 0;

alter table if exists public.user_daily_activity drop column if exists study_seconds;
alter table if exists public.user_preferences drop column if exists daily_study_goal_minutes;

commit;
