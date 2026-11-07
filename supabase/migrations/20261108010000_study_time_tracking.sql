-- Track active, foreground study time through a server-validated, account-wide heartbeat.
-- This migration is self-contained so local Supabase installs do not rely on a manually-run SQL file.
begin;

alter table public.user_daily_activity
  add column if not exists flashcards_reviewed integer not null default 0 check (flashcards_reviewed >= 0),
  add column if not exists flashcards_again integer not null default 0 check (flashcards_again >= 0),
  add column if not exists flashcards_known integer not null default 0 check (flashcards_known >= 0),
  add column if not exists flashcards_new integer not null default 0 check (flashcards_new >= 0);

create table if not exists public.user_activity_heartbeat (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_accepted_at timestamptz not null
);
alter table public.user_activity_heartbeat enable row level security;
revoke all on public.user_activity_heartbeat from public, anon, authenticated;
grant all privileges on public.user_activity_heartbeat to service_role;

create or replace function public.record_user_activity(
  _user_id uuid, _activity_date date, _increments jsonb
) returns void language plpgsql security definer set search_path = '' as $$
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
  if _user_id is null or _activity_date is null then raise exception 'user_id and activity_date are required'; end if;
  if least(v_study_seconds, v_lessons_completed, v_quizzes_completed, v_vocabulary_reviewed, v_flashcards_reviewed, v_flashcards_again, v_flashcards_known, v_flashcards_new) < 0 then
    raise exception 'activity increments must be non-negative';
  end if;
  insert into public.user_daily_activity (user_id, activity_date, study_seconds, lessons_completed, quizzes_completed, vocabulary_reviewed, flashcards_reviewed, flashcards_again, flashcards_known, flashcards_new, updated_at)
  values (_user_id, _activity_date, v_study_seconds, v_lessons_completed, v_quizzes_completed, v_vocabulary_reviewed, v_flashcards_reviewed, v_flashcards_again, v_flashcards_known, v_flashcards_new, now())
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

create or replace function public.record_user_heartbeat(_user_id uuid, _activity_date date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_last_accepted timestamptz;
begin
  if _user_id is null or _activity_date is null then raise exception 'user_id and activity_date are required'; end if;
  insert into public.user_activity_heartbeat(user_id, last_accepted_at)
  values (_user_id, now() - interval '60 seconds') on conflict (user_id) do nothing;
  select last_accepted_at into v_last_accepted from public.user_activity_heartbeat where user_id = _user_id for update;
  if v_last_accepted > now() - interval '58 seconds' then return false; end if;
  update public.user_activity_heartbeat set last_accepted_at = now() where user_id = _user_id;
  perform public.record_user_activity(_user_id, _activity_date, jsonb_build_object('study_seconds', 60));
  return true;
end;
$$;
revoke all on function public.record_user_heartbeat(uuid, date) from public, anon, authenticated;
grant execute on function public.record_user_heartbeat(uuid, date) to service_role;

commit;
