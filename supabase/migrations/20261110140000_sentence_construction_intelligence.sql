-- Sentence Construction Lab: learner-owned attempts shared with My Progress and Learning Intelligence.
begin;

create table if not exists public.sentence_construction_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sentence_id text not null check (sentence_id ~ '^n[45]-[0-9]{3}$'),
  jlpt_level public.jlpt_level not null,
  grammar_tags text[] not null default '{}',
  submitted_tokens jsonb not null default '[]'::jsonb
    check (jsonb_typeof(submitted_tokens) = 'array'),
  is_correct boolean not null,
  time_taken_ms integer not null default 0
    check (time_taken_ms between 0 and 900000),
  created_at timestamptz not null default now()
);

create index if not exists sentence_construction_attempts_user_level_created_idx
  on public.sentence_construction_attempts(user_id, jlpt_level, created_at desc);
create index if not exists sentence_construction_attempts_user_tag_idx
  on public.sentence_construction_attempts using gin(grammar_tags);

alter table public.sentence_construction_attempts enable row level security;
revoke all privileges on public.sentence_construction_attempts from public, anon, authenticated;
grant select, insert on public.sentence_construction_attempts to authenticated;
grant all privileges on public.sentence_construction_attempts to service_role;

drop policy if exists sentence_construction_attempts_read_own on public.sentence_construction_attempts;
create policy sentence_construction_attempts_read_own
  on public.sentence_construction_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists sentence_construction_attempts_insert_own on public.sentence_construction_attempts;
create policy sentence_construction_attempts_insert_own
  on public.sentence_construction_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

comment on table public.sentence_construction_attempts is
  'Server-graded learner sentence-building attempts. Grammar tags are consumed by Learning Intelligence.';

commit;
