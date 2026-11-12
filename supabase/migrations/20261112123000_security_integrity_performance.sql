-- Security, integrity, reliability and read-performance controls for Nihongo Labs.
-- The flashcard prerequisite and trusted backend RPCs are installed as separate ordered migrations.
begin;

-- Learner-written state must be produced by trusted, validated server workflows.
-- RLS ownership remains useful for reads, but ownership alone is not permission
-- to author correctness, mastery, scheduling, or graded attempt state.
revoke insert, update, delete on public.lesson_progress from authenticated;
revoke insert, update, delete on public.vocabulary_review_state from authenticated;
revoke insert, update, delete on public.kanji_review_state from authenticated;
revoke insert on public.quiz_attempts from authenticated;
revoke insert on public.quiz_responses from authenticated;
revoke insert on public.sentence_construction_attempts from authenticated;
-- The initial schema grants quiz start/response INSERT at column scope, so
-- explicitly revoke those grants as well as the table-level privileges above.
revoke insert (user_id, quiz_id) on public.quiz_attempts from authenticated;
revoke insert (attempt_id, user_id, question_id, response) on public.quiz_responses from authenticated;

grant select on public.lesson_progress, public.vocabulary_review_state,
  public.kanji_review_state, public.quiz_attempts, public.quiz_responses,
  public.sentence_construction_attempts to authenticated;
grant all privileges on public.lesson_progress, public.vocabulary_review_state,
  public.kanji_review_state, public.quiz_attempts, public.quiz_responses,
  public.sentence_construction_attempts to service_role;

-- Database-backed contact rate limits: callers supply an HMAC of the client
-- address, never the raw address. A row lock inside the upsert makes increments
-- atomic across parallel server instances.
create table if not exists private.api_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  hit_count integer not null check (hit_count > 0),
  updated_at timestamptz not null default now()
);
create index if not exists api_rate_limits_updated_idx
  on private.api_rate_limits(updated_at);
revoke all on private.api_rate_limits from public, anon, authenticated;
grant all privileges on private.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  _bucket_key text,
  _max_hits integer,
  _window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_now timestamptz := clock_timestamp();
begin
  if _bucket_key is null or _bucket_key !~ '^[0-9a-f]{64}$'
     or _max_hits < 1 or _window_seconds < 1 or _window_seconds > 86400 then
    raise exception 'Invalid rate-limit arguments' using errcode = '22023';
  end if;

  insert into private.api_rate_limits (bucket_key, window_started_at, hit_count, updated_at)
  values (_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update set
    window_started_at = case
      when private.api_rate_limits.window_started_at
        <= v_now - make_interval(secs => _window_seconds)
      then v_now
      else private.api_rate_limits.window_started_at
    end,
    hit_count = case
      when private.api_rate_limits.window_started_at
        <= v_now - make_interval(secs => _window_seconds)
      then 1
      else private.api_rate_limits.hit_count + 1
    end,
    updated_at = v_now
  returning hit_count <= _max_hits into v_allowed;

  return v_allowed;
end;
$$;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
-- Retain only recent hashed buckets; raw client addresses are never persisted.
select cron.schedule(
  'cleanup-contact-api-rate-limits',
  '15 3 * * *',
  'delete from private.api_rate_limits where updated_at < now() - interval ''7 days'';'
);


-- Batch lookup of auth emails replaces one admin Auth request per payment row.
create or replace function public.admin_user_emails(_user_ids uuid[])
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users as u
  where u.id = any(coalesce(_user_ids, '{}'::uuid[]));
$$;
revoke all on function public.admin_user_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_user_emails(uuid[]) to service_role;

-- A status change and its audit event are one transaction. No success response
-- can be returned after the state changed but the corresponding audit insert failed.
create or replace function public.admin_update_inbox_status_with_audit(
  _kind text,
  _record_id uuid,
  _status text,
  _actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
begin
  if _actor_user_id is null then
    raise exception 'An audit actor is required' using errcode = '22023';
  end if;

  if _kind = 'contact' then
    if _status not in ('new', 'read', 'replied', 'closed') then
      raise exception 'Invalid contact status' using errcode = '22023';
    end if;
    update public.contact_messages set status = _status where id = _record_id;
    v_table := 'contact_messages';
  elsif _kind = 'ticket' then
    if _status not in ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed') then
      raise exception 'Invalid ticket status' using errcode = '22023';
    end if;
    update public.support_tickets
      set status = _status::public.ticket_status,
          updated_at = now(),
          resolved_at = case when _status = 'resolved' then now() else resolved_at end
      where id = _record_id;
    v_table := 'support_tickets';
  else
    raise exception 'Invalid inbox item kind' using errcode = '22023';
  end if;

  if not found then
    raise exception 'Inbox item not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs(actor_user_id, action, target_table, target_id, details)
  values (_actor_user_id, 'admin.inbox.status_updated', v_table, _record_id::text,
          jsonb_build_object('status', _status));
end;
$$;
revoke all on function public.admin_update_inbox_status_with_audit(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_inbox_status_with_audit(text, uuid, text, uuid) to service_role;

-- One small aggregate response avoids transferring every activity/payment row to
-- Node just to count and sum it. Financial amounts remain separated by currency.
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
      coalesce(sum(study_seconds), 0)::bigint as study_seconds,
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
          'studySeconds', coalesce(a.study_seconds, 0),
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

-- Atomic profile/preferences/flashcard preference update.
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
      user_id, daily_study_goal_minutes, preferred_jlpt_level, show_romaji, show_furigana
    ) values (
      _user_id,
      coalesce((_preferences_patch->>'daily_study_goal_minutes')::integer, 15),
      coalesce((_preferences_patch->>'preferred_jlpt_level')::public.jlpt_level, 'N5'::public.jlpt_level),
      coalesce((_preferences_patch->>'show_romaji')::boolean, true),
      coalesce((_preferences_patch->>'show_furigana')::boolean, true)
    )
    on conflict (user_id) do update set
      daily_study_goal_minutes = coalesce((_preferences_patch->>'daily_study_goal_minutes')::integer, public.user_preferences.daily_study_goal_minutes),
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
revoke all on function public.update_learning_settings(uuid, jsonb, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.update_learning_settings(uuid, jsonb, jsonb, jsonb) to authenticated;

-- Vocabulary queue selection, due filtering and counts happen in PostgreSQL.
-- SECURITY INVOKER preserves table privileges and RLS for the authenticated learner.
create or replace function public.get_due_vocabulary(
  _level public.jlpt_level,
  _limit integer default 30
)
returns table(item jsonb, total_due bigint, total_unreviewed bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with all_words as (
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
      s.vocabulary_id as reviewed_vocabulary_id,
      s.due_at,
      s.repetitions,
      s.interval_days,
      s.last_rating
    from public.vocabulary_entries v
    left join public.vocabulary_review_state s
      on s.vocabulary_id = v.id and s.user_id = (select auth.uid())
    where (select auth.uid()) is not null
      and v.jlpt_level = _level
      and v.publication_status = 'published'
  ),
  counts as (
    select
      count(*) filter (where reviewed_vocabulary_id is null) as total_unreviewed
    from all_words
  ),
  due_words as (
    select *
    from all_words
    where reviewed_vocabulary_id is null or due_at <= now()
  )
  select
    jsonb_build_object(
      'id', d.id,
      'word', d.word,
      'kana', d.kana,
      'romaji', d.romaji,
      'meaning', d.meaning,
      'part_of_speech', d.part_of_speech,
      'example_sentence', d.example_sentence,
      'example_reading', d.example_reading,
      'example_translation', d.example_translation,
      'reviewState', case when d.reviewed_vocabulary_id is null then null else jsonb_build_object(
        'vocabulary_id', d.reviewed_vocabulary_id,
        'due_at', d.due_at,
        'repetitions', d.repetitions,
        'interval_days', d.interval_days,
        'last_rating', d.last_rating
      ) end
    ) as item,
    count(*) over () as total_due,
    counts.total_unreviewed
  from due_words d
  cross join counts
  order by d.due_at nulls first, d.word, d.id
  limit least(greatest(coalesce(_limit, 30), 1), 100);
$$;
revoke all on function public.get_due_vocabulary(public.jlpt_level, integer) from public, anon;
grant execute on function public.get_due_vocabulary(public.jlpt_level, integer) to authenticated;

-- Provider event ordering is serialized on each subscription row. Older events
-- and attempts to reactivate a terminal subscription are ignored.
create or replace function public.apply_subscription_provider_event(
  _subscription_id uuid,
  _new_status public.subscription_status,
  _event text,
  _provider_status text,
  _event_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status public.subscription_status;
  v_metadata jsonb;
  v_last_event_at timestamptz;
begin
  select s.status, coalesce(s.metadata, '{}'::jsonb)
    into v_current_status, v_metadata
  from public.subscriptions s
  where s.id = _subscription_id
  for update;

  if not found then return false; end if;
  v_last_event_at := nullif(v_metadata->>'provider_event_created_at', '')::timestamptz;
  if _event_at is not null and v_last_event_at is not null and _event_at < v_last_event_at then
    return false;
  end if;
  if v_current_status in ('canceled', 'expired')
     and _new_status not in ('canceled', 'expired') then
    return false;
  end if;

  update public.subscriptions
  set status = _new_status,
      metadata = v_metadata || jsonb_build_object(
        'provider_event', _event,
        'provider_status', coalesce(_provider_status, ''),
        'provider_event_created_at', coalesce(_event_at, clock_timestamp())
      ),
      updated_at = now()
  where id = _subscription_id;
  return true;
end;
$$;
revoke all on function public.apply_subscription_provider_event(uuid, public.subscription_status, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_provider_event(uuid, public.subscription_status, text, text, timestamptz) to service_role;

-- Subscription payment upserts have monotonic status precedence. A stale
-- authorized/failed notification can never downgrade a captured or refunded row.
create or replace function public.record_subscription_payment_monotonic(
  _user_id uuid,
  _subscription_id uuid,
  _provider_payment_id text,
  _amount_minor bigint,
  _currency text,
  _status public.payment_status,
  _payment_method text,
  _captured_at timestamptz,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.payments(
    user_id, subscription_id, provider, provider_payment_id,
    amount_minor, currency, status, payment_method, captured_at, metadata
  ) values (
    _user_id, _subscription_id, 'razorpay', _provider_payment_id,
    _amount_minor, coalesce(nullif(_currency, ''), 'INR'), _status,
    _payment_method, _captured_at, coalesce(_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_payment_id) do update set
    status = case
      when public.payments.status in ('captured', 'partially_refunded', 'refunded') then public.payments.status
      when excluded.status = 'captured' then 'captured'::public.payment_status
      when public.payments.status = 'failed' then 'failed'::public.payment_status
      else excluded.status
    end,
    amount_minor = greatest(public.payments.amount_minor, excluded.amount_minor),
    payment_method = coalesce(excluded.payment_method, public.payments.payment_method),
    captured_at = coalesce(public.payments.captured_at, excluded.captured_at),
    metadata = coalesce(public.payments.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.record_subscription_payment_monotonic(uuid, uuid, text, bigint, text, public.payment_status, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_subscription_payment_monotonic(uuid, uuid, text, bigint, text, public.payment_status, text, timestamptz, jsonb) to service_role;

commit;
