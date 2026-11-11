-- Improve per-run cleanup-count correlation and support paged admin Cron history.
begin;

create index if not exists cron_job_run_audit_job_started_at_idx
  on nihongo_admin_private.cron_job_run_audit (job_name, started_at desc);

create or replace function public.cleanup_expired_user_activity_heartbeat_requests()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint := 0;
  v_cron_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_finished_at timestamptz;
  v_job_name constant text := 'nihongo-labs-heartbeat-request-retention';
begin
  -- Prefer the exact live pg_cron run id where the scheduler exposes it.
  -- The stored start timestamp below is also used as a fallback correlation
  -- key because some pg_cron builds only publish run_details after completion.
  select d.runid, d.start_time
    into v_cron_run_id, v_started_at
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
   where j.jobname::text = v_job_name
     and d.status in ('starting', 'running')
   order by d.start_time desc
   limit 1;

  if not found then
    v_cron_run_id := null;
    v_started_at := clock_timestamp();
  end if;

  delete from public.user_activity_heartbeat_requests
   where created_at < clock_timestamp() - interval '8 days';
  get diagnostics v_deleted = row_count;

  -- Keep this job's own execution history bounded; do not touch other jobs.
  delete from cron.job_run_details
   where jobid in (
     select jobid from cron.job where jobname::text = v_job_name
   )
     and end_time < clock_timestamp() - interval '8 days';

  delete from nihongo_admin_private.cron_job_run_audit
   where job_name = v_job_name
     and finished_at < clock_timestamp() - interval '8 days';

  v_finished_at := clock_timestamp();

  insert into nihongo_admin_private.cron_job_run_audit (
    cron_run_id, job_name, started_at, finished_at, deleted_rows
  ) values (
    v_cron_run_id, v_job_name, v_started_at, v_finished_at, v_deleted
  )
  on conflict (cron_run_id) do update
    set started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        deleted_rows = excluded.deleted_rows,
        recorded_at = clock_timestamp();

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_user_activity_heartbeat_requests()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_user_activity_heartbeat_requests()
  to postgres, service_role;

-- Limit the amount of history returned to the admin UI. Pass 0 for all rows
-- retained by the existing eight-day execution-history policy.
create or replace function public.get_admin_cron_monitoring(p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cron_config as (
    select coalesce(
      nullif(pg_catalog.current_setting('cron.timezone', true), ''),
      'GMT'
    ) as cron_timezone
  ),
  jobs as (
    select
      j.jobid,
      j.jobname::text as jobname,
      j.schedule,
      j.active,
      c.cron_timezone,
      case
        when j.schedule = '15 * * * *'
          and upper(c.cron_timezone) in ('GMT', 'UTC')
          then 'Every hour at minute 45 (IST)'
        else 'Cron expression ' || j.schedule ||
          ' · source timezone ' || c.cron_timezone ||
          ' · run timestamps below are shown in IST'
      end as schedule_ist
    from cron.job j
    cross join cron_config c
    where j.jobname::text = 'nihongo-labs-heartbeat-request-retention'
  )
  select jsonb_build_object(
    'display_timezone', 'Asia/Kolkata',
    'cron_timezone', (select cron_timezone from cron_config),
    'jobs',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'job_id', j.jobid,
            'job_name', j.jobname,
            'schedule_ist', j.schedule_ist,
            'schedule_expression', j.schedule,
            'active', j.active,
            'runs',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'run_id', r.runid,
                    'status', r.status,
                    'started_at_ist', pg_catalog.to_char(
                      pg_catalog.timezone('Asia/Kolkata', r.start_time),
                      'YYYY-MM-DD"T"HH24:MI:SS.MS'
                    ) || '+05:30',
                    'ended_at_ist', case when r.end_time is null then null else
                      pg_catalog.to_char(
                        pg_catalog.timezone('Asia/Kolkata', r.end_time),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS'
                      ) || '+05:30' end,
                    'duration_ms',
                      case when r.end_time is null then null
                        else greatest(
                          0,
                          round(extract(epoch from (r.end_time - r.start_time)) * 1000)::bigint
                        )
                      end,
                    'deleted_rows',
                      case
                        when r.status = 'failed' then 0
                        else a.deleted_rows
                      end,
                    'deleted_rows_state',
                      case
                        when r.status = 'failed' then 'rolled_back'
                        when a.id is not null then 'recorded'
                        when r.status in ('starting', 'running') then 'pending'
                        else 'not_recorded'
                      end,
                    'error_message',
                      case when r.status = 'failed'
                        then coalesce(nullif(r.return_message, ''), 'Cron job failed without an error message.')
                        else null
                      end
                  )
                  order by r.start_time desc
                )
                from (
                  select
                    d.runid,
                    d.status,
                    d.return_message,
                    d.start_time,
                    d.end_time
                  from cron.job_run_details d
                  where d.jobid = j.jobid
                  order by d.start_time desc
                  limit case
                    when p_limit = 0 then 1000
                    else greatest(1, least(coalesce(p_limit, 10), 50))
                  end
                ) r
                left join lateral (
                  select a.id, a.deleted_rows
                  from nihongo_admin_private.cron_job_run_audit a
                  where a.job_name = j.jobname
                    and (
                      a.cron_run_id = r.runid
                      or (
                        a.cron_run_id is null
                        and abs(extract(epoch from (a.started_at - r.start_time))) <= 60
                      )
                    )
                  order by
                    case when a.cron_run_id = r.runid then 0 else 1 end,
                    abs(extract(epoch from (a.started_at - r.start_time)))
                  limit 1
                ) a on true
              ),
              '[]'::jsonb
            )
          )
          order by j.jobname
        )
        from jobs j
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_admin_cron_monitoring(integer)
  from public, anon, authenticated;
grant execute on function public.get_admin_cron_monitoring(integer) to service_role;

commit;
