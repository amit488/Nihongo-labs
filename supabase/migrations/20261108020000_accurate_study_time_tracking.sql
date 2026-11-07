-- Improve study-time accounting:
-- - accept measured pending seconds, including a final partial minute;
-- - cap credits using server elapsed time;
-- - serialize requests per learner and make retries idempotent.
begin;

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

  -- First-time accounts can receive at most one normal heartbeat interval.
  -- An unverified offline backlog is retained in the browser and can be credited
  -- only as later server time elapses; it cannot create an arbitrary time jump.
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

  -- Return the original result if the browser retries after a lost response.
  -- Check under the per-user lock so concurrent copies of the same request
  -- cannot both increment the activity aggregate.
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

revoke all on function public.record_user_heartbeat(uuid, date, integer, uuid) from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date, integer, uuid) to service_role;

commit;
