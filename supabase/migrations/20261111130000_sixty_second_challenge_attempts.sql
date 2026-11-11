begin;
create table if not exists public.sixty_second_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score_percentage integer not null check (score_percentage between 0 and 100),
  total_answered integer not null check (total_answered >= 0),
  total_correct integer not null check (total_correct between 0 and total_answered),
  duration_seconds integer not null check (duration_seconds between 0 and 60),
  category_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(category_scores)='object'),
  answer_review jsonb not null default '[]'::jsonb check (jsonb_typeof(answer_review)='array'),
  created_at timestamptz not null default now()
);
create index if not exists sixty_second_challenge_attempts_user_created_idx
  on public.sixty_second_challenge_attempts(user_id,created_at desc);
alter table public.sixty_second_challenge_attempts enable row level security;
revoke all privileges on public.sixty_second_challenge_attempts from public,anon,authenticated;
grant select,insert on public.sixty_second_challenge_attempts to authenticated;
grant all privileges on public.sixty_second_challenge_attempts to service_role;
drop policy if exists sixty_second_challenge_attempts_read_own on public.sixty_second_challenge_attempts;
create policy sixty_second_challenge_attempts_read_own on public.sixty_second_challenge_attempts for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists sixty_second_challenge_attempts_insert_own on public.sixty_second_challenge_attempts;
create policy sixty_second_challenge_attempts_insert_own on public.sixty_second_challenge_attempts for insert to authenticated with check ((select auth.uid())=user_id);
commit;
