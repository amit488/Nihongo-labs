-- Improve study-time accounting:
-- - accept the measured pending seconds, including a final partial minute;
-- - cap credits using server elapsed time;
-- - serialize concurrent tabs/devices with the per-user heartbeat row lock.
begin;

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

  -- On the first-ever heartbeat, allow no more than one minute. Existing rows
  -- preserve their watermark from the previous heartbeat implementation.
  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (
    _user_id,
    clock_timestamp() - make_interval(secs => least(_observed_seconds, 60))
  )
  on conflict (user_id) do nothing;

  select last_accepted_at
    into v_last_accepted
    from public.user_activity_heartbeat
   where user_id = _user_id
   for update;

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

  return v_credited_seconds;
end;
$$;

revoke all on function public.record_user_heartbeat(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date, integer) to service_role;

commit;
