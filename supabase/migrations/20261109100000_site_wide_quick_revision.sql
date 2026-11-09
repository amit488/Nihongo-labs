-- Site-wide active-recall questions for learned vocabulary, known kanji and understood grammar.
begin;

create table public.user_grammar_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  grammar_id uuid not null references public.grammar_points(id) on delete cascade,
  learned_at timestamptz not null default now(),
  primary key (user_id, grammar_id)
);

create index user_grammar_progress_user_idx
  on public.user_grammar_progress(user_id, learned_at desc);
create index user_grammar_progress_grammar_idx
  on public.user_grammar_progress(grammar_id);

alter table public.user_grammar_progress enable row level security;
revoke all privileges on public.user_grammar_progress from public, anon, authenticated;
grant select, insert, delete on public.user_grammar_progress to authenticated;
grant all privileges on public.user_grammar_progress to service_role;

create policy user_grammar_progress_read_own
on public.user_grammar_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_grammar_progress_insert_own
on public.user_grammar_progress for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.grammar_points g
    where g.id = user_grammar_progress.grammar_id
      and g.publication_status = 'published'
  )
);

create policy user_grammar_progress_delete_own
on public.user_grammar_progress for delete to authenticated
using ((select auth.uid()) = user_id);

create table public.quick_revision_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('vocabulary', 'kanji', 'grammar')),
  content_id uuid not null,
  selected_answer text,
  correct_answer text not null,
  is_correct boolean not null,
  did_not_remember boolean not null default false,
  response_time_ms integer check (response_time_ms is null or response_time_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  check (not did_not_remember or (selected_answer is null and not is_correct))
);

create index quick_revision_attempts_user_created_idx
  on public.quick_revision_attempts(user_id, created_at desc);
create index quick_revision_attempts_user_item_idx
  on public.quick_revision_attempts(user_id, content_type, content_id, created_at desc);

create table public.quick_revision_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('vocabulary', 'kanji', 'grammar')),
  content_id uuid not null,
  total_attempts integer not null default 0 check (total_attempts >= 0),
  correct_attempts integer not null default 0 check (correct_attempts >= 0),
  incorrect_attempts integer not null default 0 check (incorrect_attempts >= 0),
  correct_streak integer not null default 0 check (correct_streak >= 0),
  last_is_correct boolean,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_type, content_id),
  check (total_attempts = correct_attempts + incorrect_attempts)
);

create index quick_revision_state_due_idx
  on public.quick_revision_state(user_id, next_review_at);
create index quick_revision_state_needs_work_idx
  on public.quick_revision_state(user_id, last_is_correct)
  where last_is_correct = false;

alter table public.quick_revision_attempts enable row level security;
alter table public.quick_revision_state enable row level security;

revoke all privileges on public.quick_revision_attempts, public.quick_revision_state
  from public, anon, authenticated;
grant select on public.quick_revision_attempts, public.quick_revision_state to authenticated;
grant all privileges on public.quick_revision_attempts, public.quick_revision_state to service_role;

create policy quick_revision_attempts_read_own
on public.quick_revision_attempts for select to authenticated
using ((select auth.uid()) = user_id);

create policy quick_revision_state_read_own
on public.quick_revision_state for select to authenticated
using ((select auth.uid()) = user_id);

-- All writes happen in one server-only transaction. The browser never submits
-- the correct answer or any scheduling metadata.
create or replace function public.persist_quick_revision_attempt(
  _attempt_id uuid,
  _user_id uuid,
  _content_type text,
  _content_id uuid,
  _selected_answer text,
  _correct_answer text,
  _is_correct boolean,
  _did_not_remember boolean,
  _response_time_ms integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_streak integer := 0;
  v_next_streak integer := 0;
  v_next_review_at timestamptz;
begin
  if _content_type not in ('vocabulary', 'kanji', 'grammar') then
    raise exception 'Unsupported quick revision content type.' using errcode = '22023';
  end if;

  if _did_not_remember and (_selected_answer is not null or _is_correct) then
    raise exception 'Invalid forgotten-answer payload.' using errcode = '22023';
  end if;

  -- Serialize attempts for the same learner/item, including the first attempt
  -- when no quick_revision_state row exists yet.
  perform pg_advisory_xact_lock(
    hashtextextended(_user_id::text || ':' || _content_type || ':' || _content_id::text, 0)
  );

  select s.correct_streak
    into v_previous_streak
    from public.quick_revision_state s
   where s.user_id = _user_id
     and s.content_type = _content_type
     and s.content_id = _content_id
   for update;

  v_next_streak := case when _is_correct then coalesce(v_previous_streak, 0) + 1 else 0 end;

  if _is_correct then
    v_next_review_at := now() + case
      when v_next_streak = 1 then interval '1 day'
      when v_next_streak = 2 then interval '3 days'
      when v_next_streak = 3 then interval '7 days'
      when v_next_streak = 4 then interval '14 days'
      else interval '30 days'
    end;
  else
    v_next_review_at := now() + interval '10 minutes';
  end if;

  insert into public.quick_revision_attempts (
    id, user_id, content_type, content_id, selected_answer,
    correct_answer, is_correct, did_not_remember, response_time_ms
  ) values (
    _attempt_id, _user_id, _content_type, _content_id, _selected_answer,
    _correct_answer, _is_correct, _did_not_remember, _response_time_ms
  );

  insert into public.quick_revision_state (
    user_id, content_type, content_id, total_attempts, correct_attempts,
    incorrect_attempts, correct_streak, last_is_correct, last_reviewed_at,
    next_review_at, updated_at
  ) values (
    _user_id, _content_type, _content_id, 1,
    case when _is_correct then 1 else 0 end,
    case when _is_correct then 0 else 1 end,
    v_next_streak, _is_correct, now(), v_next_review_at, now()
  )
  on conflict (user_id, content_type, content_id) do update set
    total_attempts = public.quick_revision_state.total_attempts + 1,
    correct_attempts = public.quick_revision_state.correct_attempts + case when _is_correct then 1 else 0 end,
    incorrect_attempts = public.quick_revision_state.incorrect_attempts + case when _is_correct then 0 else 1 end,
    correct_streak = v_next_streak,
    last_is_correct = _is_correct,
    last_reviewed_at = now(),
    next_review_at = v_next_review_at,
    updated_at = now();

  return jsonb_build_object(
    'attemptId', _attempt_id,
    'correctStreak', v_next_streak,
    'nextReviewAt', v_next_review_at
  );
end;
$$;

revoke all on function public.persist_quick_revision_attempt(uuid, uuid, text, uuid, text, text, boolean, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.persist_quick_revision_attempt(uuid, uuid, text, uuid, text, text, boolean, boolean, integer)
  to service_role;

comment on table public.user_grammar_progress is
  'Grammar points a learner has explicitly marked as understood; separate from bookmarks.';
comment on table public.quick_revision_attempts is
  'Server-graded active-recall answers for learned vocabulary, known kanji and understood grammar.';
comment on table public.quick_revision_state is
  'Per-user adaptive recall scheduling and aggregate accuracy for each learned content item.';

commit;
