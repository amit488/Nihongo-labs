-- Nihongo Labs trusted backend helpers.
-- Additive SQL: installs restricted backend RPCs and supporting uniqueness indexes; no existing tables or learner data are rewritten.
-- Run in local Supabase Studio after the existing schema is up to date.
begin;

-- A retry from the same authenticated checkout intent maps to one local subscription.
create unique index if not exists invoices_payment_id_uidx
  on public.invoices(payment_id) where payment_id is not null;

create unique index if not exists subscriptions_checkout_idempotency_uidx
  on public.subscriptions(user_id, provider, (metadata->>'client_idempotency_key'))
  where metadata ? 'client_idempotency_key';

-- Idempotent entitlement writes for duplicate provider webhooks.
create unique index if not exists user_entitlements_subscription_feature_start_uidx
  on public.user_entitlements(source_subscription_id, feature_key, starts_at)
  where source_subscription_id is not null;
create unique index if not exists user_entitlements_payment_feature_uidx
  on public.user_entitlements(source_payment_id, feature_key)
  where source_payment_id is not null;

alter table public.payment_refunds add column if not exists idempotency_key text;
create unique index if not exists payment_refunds_provider_refund_uidx
  on public.payment_refunds(provider_refund_id)
  where provider_refund_id is not null;
create unique index if not exists payment_refunds_idempotency_uidx
  on public.payment_refunds(payment_id, idempotency_key)
  where idempotency_key is not null;

-- A heartbeat row rate-limits client activity pings. A browser cannot add
-- arbitrary study time by replaying the endpoint repeatedly.
create table if not exists public.user_activity_heartbeat (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_accepted_at timestamptz not null
);
alter table public.user_activity_heartbeat enable row level security;
revoke all on public.user_activity_heartbeat from public, anon, authenticated;
grant all privileges on public.user_activity_heartbeat to service_role;

-- The answer-key table lives in the non-exposed `private` schema. PostgREST cannot
-- query it when `private` is correctly excluded from exposed schemas. This narrow
-- RPC is available only to service_role and returns keys only to trusted backend code.
create or replace function public.get_quiz_answer_keys(_question_ids uuid[])
returns table(question_id uuid, answer_key jsonb, explanation jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select qak.question_id, qak.answer_key, qak.explanation
  from private.quiz_answer_keys as qak
  where qak.question_id = any(coalesce(_question_ids, '{}'::uuid[]));
$$;
revoke all on function public.get_quiz_answer_keys(uuid[]) from public, anon, authenticated;
grant execute on function public.get_quiz_answer_keys(uuid[]) to service_role;

-- Activity increments are atomic (upsert + increments) so concurrent lesson,
-- quiz and review requests cannot overwrite one another's daily counters.
-- This extra counter enforces the daily 'new cards' quota independently from reviews.
alter table public.user_daily_activity
  add column if not exists flashcards_new integer not null default 0 check (flashcards_new >= 0);
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
  v_study_seconds integer := coalesce((_increments->>'study_seconds')::integer, 0);
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
  if least(v_study_seconds, v_lessons_completed, v_quizzes_completed,
      v_vocabulary_reviewed, v_flashcards_reviewed, v_flashcards_again,
      v_flashcards_known, v_flashcards_new) < 0 then
    raise exception 'activity increments must be non-negative';
  end if;

  insert into public.user_daily_activity (
    user_id, activity_date, study_seconds, lessons_completed,
    quizzes_completed, vocabulary_reviewed, flashcards_reviewed,
    flashcards_again, flashcards_known, flashcards_new, updated_at
  ) values (
    _user_id, _activity_date, v_study_seconds, v_lessons_completed,
    v_quizzes_completed, v_vocabulary_reviewed, v_flashcards_reviewed,
    v_flashcards_again, v_flashcards_known, v_flashcards_new, now()
  )
  on conflict (user_id, activity_date) do update set
    study_seconds = public.user_daily_activity.study_seconds + excluded.study_seconds,
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

create or replace function public.record_user_heartbeat(
  _user_id uuid,
  _activity_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_accepted timestamptz;
begin
  if _user_id is null or _activity_date is null then
    raise exception 'user_id and activity_date are required';
  end if;

  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (_user_id, now() - interval '60 seconds')
  on conflict (user_id) do nothing;

  select last_accepted_at into v_last_accepted
  from public.user_activity_heartbeat
  where user_id = _user_id
  for update;

  if v_last_accepted > now() - interval '58 seconds' then
    return false;
  end if;

  update public.user_activity_heartbeat
  set last_accepted_at = now()
  where user_id = _user_id;

  perform public.record_user_activity(
    _user_id, _activity_date, jsonb_build_object('study_seconds', 60)
  );
  return true;
end;
$$;
revoke all on function public.record_user_heartbeat(uuid, date) from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date) to service_role;


-- Prevent a card from being reviewed twice in the same session, including concurrent requests.
create unique index if not exists flashcard_reviews_session_card_uidx
  on public.flashcard_reviews(session_id, flashcard_id)
  where session_id is not null;

-- Serialize quiz starts per user/quiz so simultaneous browser tabs cannot bypass max_attempts.
create or replace function public.reserve_quiz_attempt(
  _user_id uuid,
  _quiz_id uuid
)
returns table(attempt_id uuid, started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes%rowtype;
  v_attempt_count integer;
  v_attempt_id uuid;
  v_started_at timestamptz;
begin
  if _user_id is null or _quiz_id is null then
    raise exception 'user and quiz are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_user_id::text || ':' || _quiz_id::text, 0)
  );

  select * into v_quiz
  from public.quizzes
  where id = _quiz_id and publication_status = 'published';
  if not found then
    raise exception 'Quiz not found or unavailable' using errcode = 'P0002';
  end if;
  if v_quiz.max_attempts is not null then
    select count(*) into v_attempt_count
    from public.quiz_attempts qa
    where qa.user_id = _user_id and qa.quiz_id = _quiz_id;
    if v_attempt_count >= v_quiz.max_attempts then
      raise exception 'Quiz attempt limit reached' using errcode = '42501';
    end if;
  end if;

  insert into public.quiz_attempts(user_id, quiz_id, status)
  values (_user_id, _quiz_id, 'in_progress')
  returning id, quiz_attempts.started_at into v_attempt_id, v_started_at;

  return query select v_attempt_id, v_started_at;
end;
$$;
revoke all on function public.reserve_quiz_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_quiz_attempt(uuid, uuid) to service_role;

-- Make quiz response persistence, attempt finalization and activity increments one transaction.
create or replace function public.finalize_quiz_attempt(
  _attempt_id uuid,
  _user_id uuid,
  _total_points numeric,
  _earned_points numeric,
  _score_percentage numeric,
  _duration_seconds integer,
  _responses jsonb,
  _activity_date date,
  _study_seconds integer
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
     or _duration_seconds < 0 or _study_seconds < 0 then
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
      'quizzes_completed', 1,
      'study_seconds', least(_study_seconds, 7200)
    )
  );
end;
$$;
revoke all on function public.finalize_quiz_attempt(uuid, uuid, numeric, numeric, numeric, integer, jsonb, date, integer) from public, anon, authenticated;
grant execute on function public.finalize_quiz_attempt(uuid, uuid, numeric, numeric, numeric, integer, jsonb, date, integer) to service_role;

-- Save a review event, the new FSRS state, session counters and daily activity atomically.
-- Drop the earlier service-only signature so PostgREST cannot ambiguously resolve
-- an overload after the daily-limit arguments were added.
drop function if exists public.persist_flashcard_review(uuid, uuid, uuid, public.flashcard_rating, integer, jsonb, jsonb, date, integer);
create or replace function public.persist_flashcard_review(
  _user_id uuid,
  _flashcard_id uuid,
  _session_id uuid,
  _rating public.flashcard_rating,
  _response_time_ms integer,
  _state_before jsonb,
  _state_after jsonb,
  _activity_date date,
  _study_seconds integer,
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
  v_seconds integer := greatest(0, coalesce(_study_seconds, 0));
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
  if v_seconds < 0 or v_seconds > 3600
     or _daily_new_limit is null or _daily_new_limit < 0 or _daily_new_limit > 500
     or _daily_review_limit is null or _daily_review_limit < 0 or _daily_review_limit > 2000 then
    raise exception 'invalid study seconds or daily limits';
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
      'flashcards_new', case when v_is_new then 1 else 0 end,
      'study_seconds', v_seconds
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
revoke all on function public.persist_flashcard_review(uuid, uuid, uuid, public.flashcard_rating, integer, jsonb, jsonb, date, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.persist_flashcard_review(uuid, uuid, uuid, public.flashcard_rating, integer, jsonb, jsonb, date, integer, integer, integer) to service_role;


-- Vocabulary SM-2 review is computed while holding the user's word row lock,
-- preventing simultaneous reviews from losing repetition/interval updates.
create or replace function public.persist_vocabulary_review(
  _user_id uuid,
  _vocabulary_id uuid,
  _quality smallint,
  _activity_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.vocabulary_review_state%rowtype;
  v_repetitions integer;
  v_ease numeric(4,2);
  v_interval numeric(8,2);
  v_interval_days integer;
  v_due_at timestamptz;
begin
  if _user_id is null or _vocabulary_id is null or _activity_date is null then
    raise exception 'user, vocabulary item and activity date are required';
  end if;
  if _quality is null or _quality < 0 or _quality > 5 then
    raise exception 'quality must be between 0 and 5';
  end if;
  if not exists (
    select 1 from public.vocabulary_entries v
    where v.id = _vocabulary_id and v.jlpt_level = 'N5'
      and v.publication_status = 'published'
  ) then
    raise exception 'Vocabulary item not found or unavailable' using errcode = 'P0002';
  end if;

  insert into public.vocabulary_review_state (user_id, vocabulary_id)
  values (_user_id, _vocabulary_id)
  on conflict (user_id, vocabulary_id) do nothing;

  select * into v_current
  from public.vocabulary_review_state
  where user_id = _user_id and vocabulary_id = _vocabulary_id
  for update;

  v_repetitions := v_current.repetitions;
  v_ease := v_current.ease_factor;
  v_interval := v_current.interval_days;
  if _quality < 3 then
    v_repetitions := 0;
    v_interval := 1;
  else
    if v_repetitions = 0 then
      v_interval := 1;
    elsif v_repetitions = 1 then
      v_interval := 6;
    else
      v_interval := greatest(1, round(v_interval * v_ease));
    end if;
    v_repetitions := v_repetitions + 1;
  end if;
  v_ease := greatest(1.30, least(4.00,
    v_ease + (0.1 - (5 - _quality) * (0.08 + (5 - _quality) * 0.02))
  ));
  v_interval_days := greatest(1, round(v_interval)::integer);
  v_due_at := now() + make_interval(days => v_interval_days);

  update public.vocabulary_review_state set
    due_at = v_due_at,
    interval_days = v_interval_days,
    ease_factor = round(v_ease, 2),
    repetitions = v_repetitions,
    last_rating = _quality,
    last_reviewed_at = now(),
    updated_at = now()
  where user_id = _user_id and vocabulary_id = _vocabulary_id
  returning * into v_current;

  perform public.record_user_activity(
    _user_id, _activity_date, jsonb_build_object('vocabulary_reviewed', 1)
  );
  return to_jsonb(v_current);
end;
$$;
revoke all on function public.persist_vocabulary_review(uuid, uuid, smallint, date) from public, anon, authenticated;
grant execute on function public.persist_vocabulary_review(uuid, uuid, smallint, date) to service_role;

-- Persist lesson progress and the completion/activity counters in one transaction.
-- The app checks publication and entitlements before calling this service-role-only RPC.
create or replace function public.persist_lesson_progress(
  _user_id uuid,
  _lesson_id uuid,
  _status text,
  _last_position_seconds integer,
  _activity_date date,
  _study_seconds integer default 0
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
     or _last_position_seconds is null or _last_position_seconds < 0 or _last_position_seconds > 86400
     or _study_seconds is null or _study_seconds < 0 or _study_seconds > 3600 then
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

  if _study_seconds > 0 or v_completed_increment > 0 then
    perform public.record_user_activity(
      _user_id, _activity_date,
      jsonb_build_object('study_seconds', _study_seconds, 'lessons_completed', v_completed_increment)
    );
  end if;
  return v_current;
end;
$$;
revoke all on function public.persist_lesson_progress(uuid, uuid, text, integer, date, integer) from public, anon, authenticated;
grant execute on function public.persist_lesson_progress(uuid, uuid, text, integer, date, integer) to service_role;

-- Refund ledger + cumulative payment amount is serialized by a payment-row lock.
-- Duplicate provider refund IDs are treated as already processed.
create or replace function public.record_payment_refund(
  _payment_id uuid,
  _provider_refund_id text,
  _amount_minor bigint,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_refund public.payment_refunds%rowtype;
  v_refunded bigint;
  v_refund_id uuid;
  v_status public.payment_status;
begin
  if _payment_id is null or _amount_minor is null or _amount_minor <= 0 then
    raise exception 'payment and positive refund amount are required';
  end if;

  select * into v_payment
  from public.payments
  where id = _payment_id
  for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  if _provider_refund_id is not null then
    select * into v_refund
    from public.payment_refunds
    where provider_refund_id = _provider_refund_id
    for update;
    if found then
      if v_refund.payment_id <> v_payment.id then
        raise exception 'Refund identifier is already associated with another payment';
      end if;
      if v_refund.status = 'processed' then
        return jsonb_build_object('alreadyProcessed', true, 'refundId', v_refund.id,
          'refundedAmountMinor', v_payment.refunded_amount_minor, 'status', v_payment.status);
      end if;
      -- An admin may have opened a pending local row before calling Razorpay.
      -- Finalize that row instead of inserting a duplicate when the webhook arrives.
      update public.payment_refunds
      set status = 'processed', amount_minor = _amount_minor,
          reason = coalesce(nullif(left(_reason, 1000), ''), reason), processed_at = now()
      where id = v_refund.id
      returning * into v_refund;
      v_refund_id := v_refund.id;
    else
      v_refund_id := null;
    end if;
  end if;

  v_refunded := v_payment.refunded_amount_minor + _amount_minor;
  if v_refunded > v_payment.amount_minor then
    raise exception 'Refund exceeds the captured payment amount';
  end if;

  if v_refund_id is null then
    insert into public.payment_refunds (
      payment_id, user_id, provider_refund_id, amount_minor, currency,
      status, reason, processed_at
    ) values (
      v_payment.id, v_payment.user_id, _provider_refund_id, _amount_minor,
      v_payment.currency, 'processed', nullif(left(_reason, 1000), ''), now()
    ) returning id into v_refund_id;
  end if;

  v_status := case when v_refunded >= v_payment.amount_minor
    then 'refunded'::public.payment_status
    else 'partially_refunded'::public.payment_status end;

  update public.payments
  set refunded_amount_minor = v_refunded,
      status = v_status,
      updated_at = now()
  where id = v_payment.id;

  if v_status = 'refunded' then
    update public.user_entitlements
    set status = 'revoked'
    where source_payment_id = v_payment.id and status = 'active';
  end if;

  return jsonb_build_object('alreadyProcessed', false, 'refundId', v_refund_id,
    'refundedAmountMinor', v_refunded, 'status', v_status);
end;
$$;
revoke all on function public.record_payment_refund(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_payment_refund(uuid, text, bigint, text) to service_role;


-- Accurate study-time heartbeat overload. Credits measured pending seconds only
-- up to the time elapsed on the server, serializing simultaneous account sessions.
create or replace function public.record_user_heartbeat(
  _user_id uuid,
  _activity_date date,
  _observed_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_accepted timestamptz;
  v_elapsed_seconds integer;
  v_credited_seconds integer;
begin
  if _user_id is null or _activity_date is null then
    raise exception 'user_id and activity_date are required';
  end if;
  if _observed_seconds is null or _observed_seconds < 1 or _observed_seconds > 3600 then
    raise exception 'observed study seconds must be between 1 and 3600';
  end if;

  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (
    _user_id,
    clock_timestamp() - make_interval(secs => _observed_seconds)
  )
  on conflict (user_id) do nothing;

  select last_accepted_at into v_last_accepted
    from public.user_activity_heartbeat
   where user_id = _user_id
   for update;

  v_elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_last_accepted)))::integer
  );
  if v_elapsed_seconds < 1 then return 0; end if;

  v_credited_seconds := least(_observed_seconds, v_elapsed_seconds);
  if v_credited_seconds < 1 then return 0; end if;

  update public.user_activity_heartbeat
     set last_accepted_at = clock_timestamp()
   where user_id = _user_id;

  perform public.record_user_activity(
    _user_id, _activity_date,
    jsonb_build_object('study_seconds', v_credited_seconds)
  );
  return v_credited_seconds;
end;
$$;
revoke all on function public.record_user_heartbeat(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date, integer) to service_role;


-- Idempotency ledger for study-time heartbeats whose HTTP response may be lost.
create table if not exists public.user_activity_heartbeat_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  credited_seconds integer not null check (credited_seconds > 0),
  created_at timestamptz not null default now()
);
create index if not exists user_activity_heartbeat_requests_user_created_idx
  on public.user_activity_heartbeat_requests(user_id, created_at);
alter table public.user_activity_heartbeat_requests enable row level security;
revoke all on public.user_activity_heartbeat_requests from public, anon, authenticated;
grant all privileges on public.user_activity_heartbeat_requests to service_role;

-- Idempotent, server-capped heartbeat used by the learning workspace.
create or replace function public.record_user_heartbeat(
  _user_id uuid,
  _activity_date date,
  _observed_seconds integer,
  _request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_accepted timestamptz;
  v_elapsed_seconds integer;
  v_credited_seconds integer;
  v_prior_user_id uuid;
  v_prior_credited_seconds integer;
begin
  if _user_id is null or _activity_date is null or _request_id is null then
    raise exception 'user_id, activity_date and request_id are required';
  end if;
  if _observed_seconds is null or _observed_seconds < 1 or _observed_seconds > 3600 then
    raise exception 'observed study seconds must be between 1 and 3600';
  end if;

  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (_user_id, clock_timestamp() - make_interval(secs => least(_observed_seconds, 30)))
  on conflict (user_id) do nothing;

  select last_accepted_at into v_last_accepted
    from public.user_activity_heartbeat
   where user_id = _user_id
   for update;

  select user_id, credited_seconds
    into v_prior_user_id, v_prior_credited_seconds
    from public.user_activity_heartbeat_requests
   where request_id = _request_id;

  if found then
    if v_prior_user_id <> _user_id then
      raise exception 'request_id is already associated with another user';
    end if;
    return v_prior_credited_seconds;
  end if;

  v_elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_last_accepted)))::integer
  );
  if v_elapsed_seconds < 1 then return 0; end if;

  v_credited_seconds := least(_observed_seconds, v_elapsed_seconds);
  if v_credited_seconds < 1 then return 0; end if;

  update public.user_activity_heartbeat
     set last_accepted_at = clock_timestamp()
   where user_id = _user_id;

  perform public.record_user_activity(
    _user_id, _activity_date,
    jsonb_build_object('study_seconds', v_credited_seconds)
  );

  insert into public.user_activity_heartbeat_requests(request_id, user_id, credited_seconds)
  values (_request_id, _user_id, v_credited_seconds);

  return v_credited_seconds;
end;
$$;
revoke all on function public.record_user_heartbeat(uuid, date, integer, uuid) from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date, integer, uuid) to service_role;


-- Eight-day heartbeat retry window with immutable request metadata.
create index if not exists user_activity_heartbeat_requests_created_at_idx
  on public.user_activity_heartbeat_requests(created_at);

create or replace function public.record_user_heartbeat(
  _user_id uuid,
  _activity_date date,
  _observed_seconds integer,
  _request_id uuid,
  _request_created_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $
declare
  v_last_accepted timestamptz;
  v_elapsed_seconds integer;
  v_credited_seconds integer;
  v_prior_user_id uuid;
  v_prior_credited_seconds integer;
begin
  if _user_id is null or _activity_date is null or _request_id is null
     or _request_created_at is null then
    raise exception 'user_id, activity_date, request_id and request_created_at are required';
  end if;
  if _observed_seconds is null or _observed_seconds < 1 or _observed_seconds > 3600 then
    raise exception 'observed study seconds must be between 1 and 3600';
  end if;
  if _request_created_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'HEARTBEAT_REQUEST_CREATED_AT_IN_FUTURE';
  end if;

  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (
    _user_id,
    clock_timestamp() - make_interval(secs => least(_observed_seconds, 30))
  )
  on conflict (user_id) do nothing;

  select last_accepted_at into v_last_accepted
    from public.user_activity_heartbeat
   where user_id = _user_id
   for update;

  select user_id, credited_seconds
    into v_prior_user_id, v_prior_credited_seconds
    from public.user_activity_heartbeat_requests
   where request_id = _request_id;

  if found then
    if v_prior_user_id <> _user_id then
      raise exception 'request_id is already associated with another user';
    end if;
    return v_prior_credited_seconds;
  end if;

  if _request_created_at < clock_timestamp() - interval '8 days' then
    raise exception 'HEARTBEAT_REQUEST_EXPIRED' using errcode = 'P0001';
  end if;

  v_elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_last_accepted)))::integer
  );
  if v_elapsed_seconds < 1 then return 0; end if;

  v_credited_seconds := least(_observed_seconds, v_elapsed_seconds);
  if v_credited_seconds < 1 then return 0; end if;

  update public.user_activity_heartbeat
     set last_accepted_at = clock_timestamp()
   where user_id = _user_id;

  perform public.record_user_activity(
    _user_id, _activity_date,
    jsonb_build_object('study_seconds', v_credited_seconds)
  );

  insert into public.user_activity_heartbeat_requests (
    request_id, user_id, credited_seconds
  ) values (
    _request_id, _user_id, v_credited_seconds
  );

  return v_credited_seconds;
end;
$;
revoke all on function public.record_user_heartbeat(uuid, date, integer, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date, integer, uuid, timestamptz)
  to service_role;

create or replace function public.cleanup_expired_user_activity_heartbeat_requests()
returns bigint
language plpgsql
security definer
set search_path = ''
as $
declare
  v_deleted bigint;
begin
  delete from public.user_activity_heartbeat_requests
   where created_at < clock_timestamp() - interval '8 days';
  get diagnostics v_deleted = row_count;

  delete from cron.job_run_details
   where jobid in (
     select jobid from cron.job
      where jobname = 'nihongo-labs-heartbeat-request-retention'
   )
     and end_time < clock_timestamp() - interval '8 days';

  return v_deleted;
end;
$;
revoke all on function public.cleanup_expired_user_activity_heartbeat_requests()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_user_activity_heartbeat_requests()
  to postgres, service_role;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'nihongo-labs-heartbeat-request-retention',
  '15 * * * *',
  $select public.cleanup_expired_user_activity_heartbeat_requests();$
);

commit;
