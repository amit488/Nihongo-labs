-- Persist each learner's completed graded-reader passages exactly once.
begin;

create table public.user_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  passage_id text not null check (passage_id ~ '^[a-z0-9-]{3,80}$'),
  jlpt_level text not null check (jlpt_level in ('N5', 'N4')),
  learned_at timestamptz not null default now(),
  primary key (user_id, passage_id)
);

create index user_reading_progress_user_level_idx
  on public.user_reading_progress(user_id, jlpt_level, learned_at desc);

alter table public.user_reading_progress enable row level security;
revoke all privileges on public.user_reading_progress from public, anon, authenticated;
grant select, insert, delete on public.user_reading_progress to authenticated;
grant all privileges on public.user_reading_progress to service_role;

create policy user_reading_progress_read_own
on public.user_reading_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_reading_progress_insert_own
on public.user_reading_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy user_reading_progress_delete_own
on public.user_reading_progress for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
