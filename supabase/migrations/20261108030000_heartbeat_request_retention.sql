-- Keep heartbeat idempotency records for an eight-day retry window.
-- Daily learner aggregates are intentionally retained; only the retry ledger is purged.
begin;

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
as $$
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

  -- First-time accounts can receive at most one normal heartbeat interval.
  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (
    _user_id,
    clock_timestamp() - make_interval(secs => least(_observed_seconds, 30))
  )
  on conflict (user_id) do nothing;

  -- This per-user lock serializes requests from multiple tabs and devices.
  select last_accepted_at
    into v_last_accepted
    from public.user_activity_heartbeat
   where user_id = _user_id
   for update;

  -- A still-retained request always wins over expiry: retries return the
  -- original credit, even if the client retries close to the cleanup boundary.
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

  -- Once a request is older than eight days and its idempotency record has
  -- been cleaned up, it must never be accepted as a fresh batch.
  if _request_created_at < clock_timestamp() - interval '8 days' then
    raise exception 'HEARTBEAT_REQUEST_EXPIRED' using errcode = 'P0001';
  end if;

  v_elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_last_accepted)))::integer
  );
  if v_elapsed_seconds < 1 then
    return 0;
  end if;

  v_credited_seconds := least(_observed_seconds, v_elapsed_seconds);
  if v_credited_seconds < 1 then
    return 0;
  end if;

  update public.user_activity_heartbeat
     set last_accepted_at = clock_timestamp()
   where user_id = _user_id;

  perform public.record_user_activity(
    _user_id,
    _activity_date,
    jsonb_build_object('study_seconds', v_credited_seconds)
  );

  insert into public.user_activity_heartbeat_requests (
    request_id, user_id, credited_seconds
  ) values (
    _request_id, _user_id, v_credited_seconds
  );

  return v_credited_seconds;
end;
$$;

revoke all on function public.record_user_heartbeat(uuid, date, integer, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date, integer, uuid, timestamptz)
  to service_role;

create or replace function public.cleanup_expired_user_activity_heartbeat_requests()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from public.user_activity_heartbeat_requests
   where created_at < clock_timestamp() - interval '8 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_user_activity_heartbeat_requests()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_user_activity_heartbeat_requests()
  to postgres, service_role;

-- Supabase Cron uses pg_cron. Schedule the retention task once per day.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'nihongo-labs-heartbeat-request-retention',
  '15 3 * * *',
  $$select public.cleanup_expired_user_activity_heartbeat_requests();$$
);

commit;
