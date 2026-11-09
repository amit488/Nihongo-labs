-- Nihongo Labs learning intelligence: grammar mistake analytics + AI Sensei usage limits.
begin;

alter table public.quiz_questions
  add column if not exists learning_tags text[] not null default '{}';

alter table public.grammar_points
  add column if not exists learning_tags text[] not null default '{}';

create index if not exists quiz_questions_learning_tags_gin
  on public.quiz_questions using gin (learning_tags);
create index if not exists grammar_points_learning_tags_gin
  on public.grammar_points using gin (learning_tags);

create table if not exists public.grammar_attempt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  skill_tag text not null check (skill_tag ~ '^[a-z0-9:_-]{2,80}$'),
  response jsonb not null default 'null'::jsonb,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id, skill_tag)
);

create index if not exists grammar_attempt_events_user_created_idx
  on public.grammar_attempt_events(user_id, created_at desc);
create index if not exists grammar_attempt_events_user_tag_idx
  on public.grammar_attempt_events(user_id, skill_tag, created_at desc);

alter table public.grammar_attempt_events enable row level security;
revoke all privileges on public.grammar_attempt_events from public, anon, authenticated;
grant select on public.grammar_attempt_events to authenticated;
grant all privileges on public.grammar_attempt_events to service_role;

drop policy if exists grammar_attempt_events_read_own on public.grammar_attempt_events;
create policy grammar_attempt_events_read_own
  on public.grammar_attempt_events for select to authenticated
  using ((select auth.uid()) = user_id);

-- Backfill existing graded grammar quizzes. Explicit question tags take priority;
-- historical grammar questions without tags are grouped under grammar:general.
insert into public.grammar_attempt_events
  (user_id, attempt_id, question_id, skill_tag, response, is_correct)
select
  a.user_id,
  a.id,
  r.question_id,
  tag.skill_tag,
  r.response,
  r.is_correct
from public.quiz_responses r
join public.quiz_attempts a on a.id = r.attempt_id
join public.quizzes q on q.id = a.quiz_id
join public.quiz_questions question on question.id = r.question_id
cross join lateral unnest(
  case
    when cardinality(coalesce(question.learning_tags, '{}'::text[])) > 0
      then question.learning_tags
    else array['grammar:general']::text[]
  end
) as tag(skill_tag)
where a.status = 'graded'
  and r.is_correct is not null
  and (
    cardinality(coalesce(question.learning_tags, '{}'::text[])) > 0
    or lower(coalesce(q.slug, '') || ' ' || coalesce(q.title, '')) ~ '(grammar|particle|conjugation)'
  )
on conflict (attempt_id, question_id, skill_tag) do nothing;

create table if not exists public.ai_sensei_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_sensei_usage enable row level security;
revoke all privileges on public.ai_sensei_usage from public, anon, authenticated;
grant select on public.ai_sensei_usage to authenticated;
grant all privileges on public.ai_sensei_usage to service_role;

drop policy if exists ai_sensei_usage_read_own on public.ai_sensei_usage;
create policy ai_sensei_usage_read_own
  on public.ai_sensei_usage for select to authenticated
  using ((select auth.uid()) = user_id);

-- Atomic daily request quota. Only trusted server code using service_role can call it.
create or replace function public.consume_ai_sensei_request(
  _user_id uuid,
  _usage_date date,
  _daily_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if _user_id is null or _usage_date is null or _daily_limit < 1 or _daily_limit > 200 then
    raise exception 'Invalid AI Sensei quota request.' using errcode = '22023';
  end if;

  insert into public.ai_sensei_usage (user_id, usage_date, request_count, updated_at)
  values (_user_id, _usage_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_sensei_usage.request_count + 1,
        updated_at = now()
    where public.ai_sensei_usage.request_count < _daily_limit
  returning request_count into v_count;

  if v_count is null then
    select u.request_count into v_count
    from public.ai_sensei_usage u
    where u.user_id = _user_id and u.usage_date = _usage_date;
    return jsonb_build_object(
      'allowed', false,
      'requestCount', coalesce(v_count, 0),
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'requestCount', v_count,
    'remaining', greatest(0, _daily_limit - v_count)
  );
end;
$$;

revoke all on function public.consume_ai_sensei_request(uuid, date, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_sensei_request(uuid, date, integer)
  to service_role;

comment on column public.quiz_questions.learning_tags is
  'Stable analytics tags such as particle:wa-vs-ga, particle:ni-vs-de or verb:te-form.';
comment on table public.grammar_attempt_events is
  'Server-recorded per-question outcomes used to detect recurring grammar misunderstandings.';
comment on table public.ai_sensei_usage is
  'Per-user daily AI Sensei request counts; prompts and chat content are not stored.';

commit;
