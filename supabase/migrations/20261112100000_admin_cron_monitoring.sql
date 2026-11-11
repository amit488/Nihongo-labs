-- Monitor the heartbeat-retention Cron job from the protected admin console.
-- Successful runs record the committed row count. Failed runs are read from
-- cron.job_run_details, whose return_message contains the PostgreSQL error.
begin;

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated, service_role;

create table if not exists private.cron_job_run_audit (
  id bigint generated always as identity primary key,
  cron_run_id bigint unique,
  job_name text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null default clock_timestamp(),
  deleted_rows bigint not null check (deleted_rows >= 0),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table private.cron_job_run_audit enable row level security;
revoke all on table private.cron_job_run_audit from public, anon, authenticated, service_role;
grant usage on schema private to postgres;

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
  -- pg_cron inserts a running row before it invokes the scheduled command.
  -- Keeping its runid lets the admin screen associate the row count with the
  -- exact success/failure record in cron.job_run_details.
  select d.runid, d.start_time
    into v_cron_run_id, v_started_at
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
   where j.jobname = v_job_name
     and d.status in ('starting', 'running')
   order by d.start_time desc
   limit 1;

  delete from public.user_activity_heartbeat_requests
   where created_at < clock_timestamp() - interval '8 days';
  get diagnostics v_deleted = row_count;

  -- Keep this job's own execution history bounded; do not touch other jobs.
  delete from cron.job_run_details
   where jobid in (
     select jobid
       from cron.job
      where jobname = v_job_name
   )
     and end_time < clock_timestamp() - interval '8 days';

  -- Keep the count audit aligned with the eight-day Cron history window.
  delete from private.cron_job_run_audit
   where job_name = v_job_name
     and finished_at < clock_timestamp() - interval '8 days';

  v_finished_at := clock_timestamp();

  insert into private.cron_job_run_audit (
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

create or replace function public.get_admin_cron_monitoring()
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
      j.jobname,
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
    where j.jobname = 'nihongo-labs-heartbeat-request-retention'
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
                    'started_at_ist', pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', r.start_time), 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+05:30',
                    'ended_at_ist', pg_catalog.to_char(pg_catalog.timezone('Asia/Kolkata', r.end_time), 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+05:30',
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
                        when a.cron_run_id is not null then 'recorded'
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
                  limit 50
                ) r
                left join private.cron_job_run_audit a
                  on a.cron_run_id = r.runid
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

revoke all on function public.get_admin_cron_monitoring()
  from public, anon, authenticated;
grant execute on function public.get_admin_cron_monitoring() to service_role;

commit;
