-- Nihongo Labs — enrollments, progress, spaced repetition and quizzes

begin;

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  completed_at timestamptz,
  unique (user_id, course_id)
);

create index course_enrollments_user_idx on public.course_enrollments(user_id, enrolled_at desc);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index lesson_progress_user_idx on public.lesson_progress(user_id, updated_at desc);

create table public.user_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  study_seconds integer not null default 0 check (study_seconds >= 0),
  lessons_completed integer not null default 0 check (lessons_completed >= 0),
  quizzes_completed integer not null default 0 check (quizzes_completed >= 0),
  vocabulary_reviewed integer not null default 0 check (vocabulary_reviewed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table public.user_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('lesson', 'vocabulary', 'kanji', 'grammar', 'quiz')),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, resource_type, resource_id)
);

create index user_bookmarks_user_idx on public.user_bookmarks(user_id, created_at desc);

create table public.vocabulary_review_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_entries(id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days numeric(8,2) not null default 0 check (interval_days >= 0),
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor between 1.30 and 4.00),
  repetitions integer not null default 0 check (repetitions >= 0),
  last_rating smallint check (last_rating is null or last_rating between 0 and 5),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, vocabulary_id)
);

create index vocabulary_due_idx on public.vocabulary_review_state(user_id, due_at);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  icon_path text,
  criteria jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, badge_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  access_level public.content_access not null default 'free',
  publication_status public.publication_status not null default 'draft',
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  pass_percentage numeric(5,2) not null default 70 check (pass_percentage between 0 and 100),
  shuffle_questions boolean not null default false,
  show_results_after_submit boolean not null default true,
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or lesson_id is not null)
);

create index quizzes_course_idx on public.quizzes(course_id, sort_order);
create index quizzes_lesson_idx on public.quizzes(lesson_id, sort_order);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_type public.quiz_question_type not null,
  prompt jsonb not null,
  points numeric(7,2) not null default 1 check (points > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  media_asset_id uuid references public.content_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, sort_order)
);

create index quiz_questions_quiz_idx on public.quiz_questions(quiz_id, sort_order);

-- Options contain only learner-visible choices. Correct answers and explanations live in private.quiz_answer_keys.
create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_key text not null,
  option_content jsonb not null,
  sort_order integer not null default 0,
  unique (question_id, option_key),
  unique (question_id, sort_order)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  status public.quiz_attempt_status not null default 'in_progress',
  total_points numeric(9,2),
  earned_points numeric(9,2),
  score_percentage numeric(5,2) check (score_percentage is null or score_percentage between 0 and 100),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create index quiz_attempts_user_idx on public.quiz_attempts(user_id, started_at desc);
create index quiz_attempts_quiz_idx on public.quiz_attempts(quiz_id, started_at desc);

create table public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  response jsonb not null,
  is_correct boolean,
  points_awarded numeric(7,2),
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index quiz_responses_attempt_idx on public.quiz_responses(attempt_id);

-- This schema is intentionally not exposed through the Supabase Data API.
create table private.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  answer_key jsonb not null,
  explanation jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

revoke all on all tables in schema private from public, anon, authenticated;

commit;
