-- NIHONGO LABS — FULL SUPABASE / POSTGRESQL SCHEMA
-- Execute on a clean Supabase project. Optional starter data is separate.
-- See README.md for installation order and local migration instructions.


-- ============================================================================
-- BEGIN 001_foundation.sql
-- ============================================================================

-- Nihongo Labs — foundation, identity, catalog and site operations
-- Run once on a clean Supabase project, as the postgres role.

begin;

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum (
  'super_admin', 'admin', 'content_editor', 'support_agent'
);

create type public.jlpt_level as enum ('N5', 'N4', 'N3', 'N2', 'N1');
create type public.publication_status as enum ('draft', 'review', 'published', 'archived');
create type public.content_access as enum ('free', 'premium');
create type public.lesson_block_type as enum (
  'rich_text', 'vocabulary', 'kanji', 'grammar', 'example', 'image',
  'audio', 'video', 'callout', 'tip', 'download', 'interactive'
);
create type public.billing_interval as enum ('month', 'year', 'lifetime');
create type public.subscription_status as enum (
  'incomplete', 'trialing', 'active', 'past_due', 'paused',
  'canceled', 'unpaid', 'expired'
);
create type public.payment_provider as enum ('razorpay', 'stripe', 'manual');
create type public.payment_status as enum (
  'created', 'pending', 'authorized', 'captured', 'failed',
  'partially_refunded', 'refunded'
);
create type public.order_status as enum ('created', 'pending', 'paid', 'failed', 'expired', 'canceled');
create type public.discount_type as enum ('percentage', 'fixed_amount');
create type public.webhook_event_status as enum ('received', 'processing', 'processed', 'failed');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'void', 'uncollectible');
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.quiz_question_type as enum (
  'single_choice', 'multiple_choice', 'fill_blank', 'true_false',
  'matching', 'ordering', 'short_answer', 'listening'
);
create type public.quiz_attempt_status as enum ('in_progress', 'submitted', 'graded', 'abandoned');

-- A profile is application-facing user data. Credentials remain in auth.users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Learner' check (char_length(display_name) between 1 and 80),
  username text unique check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_path text,
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en',
  bio text check (bio is null or char_length(bio) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles(role);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_study_goal_minutes integer not null default 15 check (daily_study_goal_minutes between 1 and 600),
  preferred_jlpt_level public.jlpt_level not null default 'N5',
  show_romaji boolean not null default true,
  show_furigana boolean not null default true,
  email_product_updates boolean not null default false,
  email_learning_reminders boolean not null default false,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy', 'marketing', 'analytics')),
  document_version text,
  granted boolean not null,
  source text not null default 'website',
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index user_consents_user_idx on public.user_consents(user_id, recorded_at desc);

-- Curriculum and learning content.
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  subtitle text,
  description text,
  jlpt_level public.jlpt_level not null default 'N5',
  access_level public.content_access not null default 'free',
  publication_status public.publication_status not null default 'draft',
  cover_image_path text,
  learning_outcomes jsonb not null default '[]'::jsonb,
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes >= 0),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_catalog_idx on public.courses(publication_status, jlpt_level, sort_order);

create table public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  publication_status public.publication_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  unique (course_id, sort_order)
);

create index course_units_course_idx on public.course_units(course_id, sort_order);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.course_units(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text,
  lesson_type text not null default 'lesson' check (lesson_type in ('lesson', 'practice', 'review', 'assessment')),
  access_level public.content_access not null default 'free',
  publication_status public.publication_status not null default 'draft',
  estimated_duration_minutes integer not null default 5 check (estimated_duration_minutes between 0 and 1440),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, slug),
  unique (unit_id, sort_order)
);

create index lessons_unit_idx on public.lessons(unit_id, sort_order);

create table public.lesson_content_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_type public.lesson_block_type not null,
  access_level public.content_access not null default 'free',
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, sort_order)
);

create index lesson_blocks_lesson_idx on public.lesson_content_blocks(lesson_id, sort_order);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'nihongo-public',
  object_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  access_level public.content_access not null default 'free',
  alt_text text,
  caption text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, object_path),
  check (
    (access_level = 'free' and storage_bucket = 'nihongo-public')
    or (access_level = 'premium' and storage_bucket = 'nihongo-premium')
  )
);

create table public.vocabulary_entries (
  id uuid primary key default gen_random_uuid(),
  jlpt_level public.jlpt_level not null default 'N5',
  word text not null,
  kana text not null,
  romaji text,
  meaning text not null,
  part_of_speech text,
  example_sentence text,
  example_reading text,
  example_translation text,
  audio_asset_id uuid references public.content_assets(id) on delete set null,
  tags text[] not null default '{}',
  publication_status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jlpt_level, word, kana)
);

create index vocabulary_level_word_idx on public.vocabulary_entries(jlpt_level, word);
create index vocabulary_search_idx on public.vocabulary_entries using gin (to_tsvector('simple', word || ' ' || kana || ' ' || coalesce(romaji, '') || ' ' || meaning));

create table public.kanji_entries (
  id uuid primary key default gen_random_uuid(),
  character text not null check (char_length(character) between 1 and 4),
  jlpt_level public.jlpt_level not null default 'N5',
  meaning text not null,
  on_yomi text[] not null default '{}',
  kun_yomi text[] not null default '{}',
  stroke_count integer check (stroke_count is null or stroke_count > 0),
  radical text,
  mnemonic text,
  stroke_order_asset_id uuid references public.content_assets(id) on delete set null,
  example_words jsonb not null default '[]'::jsonb,
  publication_status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jlpt_level, character)
);

create index kanji_level_character_idx on public.kanji_entries(jlpt_level, character);

create table public.grammar_points (
  id uuid primary key default gen_random_uuid(),
  jlpt_level public.jlpt_level not null default 'N5',
  title text not null,
  pattern text not null,
  explanation text not null,
  formation text,
  examples jsonb not null default '[]'::jsonb,
  common_mistakes jsonb not null default '[]'::jsonb,
  related_grammar_ids uuid[] not null default '{}',
  publication_status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jlpt_level, pattern)
);

create index grammar_level_idx on public.grammar_points(jlpt_level, title);

create table public.lesson_vocabulary (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_entries(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (lesson_id, vocabulary_id)
);

create table public.lesson_kanji (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  kanji_id uuid not null references public.kanji_entries(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (lesson_id, kanji_id)
);

create table public.lesson_grammar (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  grammar_id uuid not null references public.grammar_points(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (lesson_id, grammar_id)
);

-- Public website content and administration settings.
create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  seo_title text,
  seo_description text,
  content jsonb not null default '{}'::jsonb,
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_audience text not null default 'all' check (target_audience in ('all', 'learners', 'premium', 'staff')),
  publication_status public.publication_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  is_enabled boolean not null default false,
  is_public boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

-- Support, feedback and lead capture.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  requester_email text,
  subject text not null check (char_length(subject) between 3 and 180),
  category text not null default 'general',
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (user_id is not null or requester_email is not null)
);

create index support_tickets_user_idx on public.support_tickets(user_id, created_at desc);
create index support_tickets_queue_idx on public.support_tickets(status, priority, created_at);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('user', 'staff', 'system')),
  message text not null check (char_length(message) between 1 and 10000),
  attachment_paths text[] not null default '{}',
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index support_messages_ticket_idx on public.support_ticket_messages(ticket_id, created_at);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null,
  subject text,
  message text not null check (char_length(message) between 5 and 10000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'closed')),
  created_at timestamptz not null default now()
);

create index contact_messages_status_idx on public.contact_messages(status, created_at desc);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  is_confirmed boolean not null default false,
  unsubscribed_at timestamptz,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create unique index newsletter_email_lower_uidx on public.newsletter_subscribers(lower(email));

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category text not null default 'general',
  rating smallint check (rating is null or rating between 1 and 5),
  message text not null check (char_length(message) between 3 and 5000),
  page_url text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'actioned', 'closed')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);

commit;

-- END 001_foundation.sql


-- ============================================================================
-- BEGIN 002_learning.sql
-- ============================================================================

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

-- END 002_learning.sql


-- ============================================================================
-- BEGIN 003_billing.sql
-- ============================================================================

-- Nihongo Labs — plans, subscriptions, orders, payments, invoices and entitlements
-- Store money as integer minor units: INR 149.00 is 14900 paise.
-- Ledger records retain their history if an Auth account is deleted; user_id is set null.

begin;

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  plan_kind text not null default 'paid' check (plan_kind in ('free', 'paid')),
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  billing_interval public.billing_interval not null default 'month',
  interval_count integer not null default 1 check (interval_count > 0),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  provider_product_id text,
  provider_price_id text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan_kind = 'free' and amount_minor = 0) or plan_kind = 'paid')
);

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  feature_key text not null,
  feature_value jsonb not null default 'true'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

create table public.billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  billing_name text,
  billing_email text,
  phone text,
  country_code char(2) not null default 'IN',
  address jsonb not null default '{}'::jsonb,
  tax_id text,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  provider public.payment_provider not null,
  provider_customer_id text,
  provider_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create unique index subscriptions_provider_id_uidx
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index subscriptions_user_status_idx on public.subscriptions(user_id, status, created_at desc);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  provider public.payment_provider not null,
  provider_order_id text,
  idempotency_key text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  status public.order_status not null default 'created',
  coupon_code text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_orders_provider_id_uidx
  on public.payment_orders(provider, provider_order_id)
  where provider_order_id is not null;
create unique index payment_orders_idempotency_uidx
  on public.payment_orders(user_id, idempotency_key)
  where idempotency_key is not null;
create index payment_orders_user_idx on public.payment_orders(user_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.payment_orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider public.payment_provider not null,
  provider_payment_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  refunded_amount_minor bigint not null default 0 check (refunded_amount_minor >= 0 and refunded_amount_minor <= amount_minor),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  status public.payment_status not null default 'created',
  payment_method text,
  captured_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payments_provider_id_uidx
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create index payments_user_idx on public.payments(user_id, created_at desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  invoice_number text not null unique,
  status public.invoice_status not null default 'issued',
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  line_items jsonb not null default '[]'::jsonb,
  billing_snapshot jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index invoices_user_idx on public.invoices(user_id, issued_at desc);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider_refund_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index refunds_provider_id_uidx
  on public.payment_refunds(provider_refund_id)
  where provider_refund_id is not null;

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_redemptions_per_user integer not null default 1 check (max_redemptions_per_user > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  applicable_plan_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.payment_orders(id) on delete set null,
  discount_minor bigint not null check (discount_minor >= 0),
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index coupon_redemptions_user_idx on public.coupon_redemptions(user_id, redeemed_at desc);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  status public.webhook_event_status not null default 'received',
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  retry_count integer not null default 0 check (retry_count >= 0),
  unique (provider, provider_event_id)
);

create index webhook_events_status_idx on public.payment_webhook_events(status, received_at);

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  source_subscription_id uuid references public.subscriptions(id) on delete set null,
  source_payment_id uuid references public.payments(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index user_entitlements_active_idx
  on public.user_entitlements(user_id, feature_key, starts_at, ends_at)
  where status = 'active';

commit;

-- END 003_billing.sql


-- ============================================================================
-- BEGIN 004_functions_triggers.sql
-- ============================================================================

-- Nihongo Labs — internal authorization helpers and Auth/profile automation
-- Privileged helper functions stay in the non-exposed private schema.

begin;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.has_any_role(_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = (select auth.uid())
      and ur.role = any (_roles)
  );
$$;

create or replace function private.has_entitlement(_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_entitlements as ue
    where ue.user_id = (select auth.uid())
      and ue.feature_key = _feature_key
      and ue.status = 'active'
      and ue.starts_at <= now()
      and (ue.ends_at is null or ue.ends_at > now())
  );
$$;

create or replace function private.can_access_content(_access public.content_access)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _access = 'free'::public.content_access then true
    when _access = 'premium'::public.content_access then private.has_entitlement('premium_content')
    else false
  end;
$$;

-- Supabase Auth invokes this function after inserting auth.users.
-- Do not use user-editable metadata for roles or access privileges.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 80), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 80), ''),
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''),
    'Learner'
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Only the Auth service needs permission to invoke the signup trigger function.
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Keep updated_at consistent for mutable application tables.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'user_preferences', 'courses', 'course_units', 'lessons',
    'lesson_content_blocks', 'vocabulary_entries', 'kanji_entries',
    'grammar_points', 'cms_pages', 'announcements', 'site_settings',
    'feature_flags', 'support_tickets', 'subscription_plans', 'billing_profiles',
    'subscriptions', 'payment_orders', 'payments', 'lesson_progress',
    'user_daily_activity', 'vocabulary_review_state', 'quizzes', 'quiz_questions'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', v_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      v_table
    );
  end loop;
end;
$$;

-- Only these helpers are callable by client roles; all authorization data remains private.
grant usage on schema private to anon, authenticated;
revoke all on function private.has_any_role(public.app_role[]) from public;
revoke all on function private.has_entitlement(text) from public;
revoke all on function private.can_access_content(public.content_access) from public;
grant execute on function private.has_any_role(public.app_role[]) to anon, authenticated;
grant execute on function private.can_access_content(public.content_access) to anon, authenticated;

commit;

-- END 004_functions_triggers.sql


-- ============================================================================
-- BEGIN 005_security_rls_grants.sql
-- ============================================================================

-- Nihongo Labs — Row Level Security and explicit Data API grants
-- Safe default: tables are inaccessible unless a matching grant AND policy both allow the operation.

begin;

-- RLS is enabled on every table currently in the exposed public schema.
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

alter table private.quiz_answer_keys enable row level security;

-- Start from a deny-by-default grant baseline on a clean project. Existing PUBLIC grants are also removed.
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;

-- Schema privileges. The private schema must not be added to the Data API's exposed schemas.
grant usage on schema public to anon, authenticated;
grant usage on schema private to anon, authenticated, service_role, supabase_auth_admin;

-- Public catalog/content: readable by guests only through publication and content policies.
grant select on
  public.courses, public.course_units, public.lessons, public.lesson_content_blocks,
  public.content_assets, public.vocabulary_entries, public.kanji_entries,
  public.grammar_points, public.lesson_vocabulary, public.lesson_kanji,
  public.lesson_grammar, public.quizzes, public.quiz_questions, public.quiz_options,
  public.cms_pages, public.announcements, public.site_settings, public.feature_flags,
  public.subscription_plans, public.plan_features, public.badges
  to anon, authenticated;

grant insert, update, delete on
  public.courses, public.course_units, public.lessons, public.lesson_content_blocks,
  public.content_assets, public.vocabulary_entries, public.kanji_entries,
  public.grammar_points, public.lesson_vocabulary, public.lesson_kanji,
  public.lesson_grammar, public.quizzes, public.quiz_questions, public.quiz_options,
  public.cms_pages, public.announcements, public.site_settings, public.feature_flags,
  public.badges
  to authenticated;

grant select on public.profiles, public.user_roles, public.user_preferences, public.user_consents to authenticated;
grant update (display_name, username, avatar_path, timezone, locale, bio)
  on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant insert (user_id, consent_type, document_version, granted, source, metadata)
  on public.user_consents to authenticated;

-- Learner-owned progress and study data.
grant select on public.course_enrollments to authenticated;
grant insert (user_id, course_id) on public.course_enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select on public.user_daily_activity to authenticated;
grant select, insert, delete on public.user_bookmarks to authenticated;
grant select, insert, update on public.vocabulary_review_state to authenticated;
grant select on public.user_badges to authenticated;

grant select on public.quiz_attempts to authenticated;
grant insert (user_id, quiz_id) on public.quiz_attempts to authenticated;
grant select on public.quiz_responses to authenticated;
grant insert (attempt_id, user_id, question_id, response) on public.quiz_responses to authenticated;

-- Billing information is readable by the account owner; writes are server-side except billing profile details.
grant select on public.billing_profiles to authenticated;
grant insert (user_id, billing_name, billing_email, phone, country_code, address, tax_id)
  on public.billing_profiles to authenticated;
grant update (billing_name, billing_email, phone, country_code, address, tax_id)
  on public.billing_profiles to authenticated;
grant select on
  public.subscriptions, public.payment_orders, public.payments, public.invoices,
  public.payment_refunds, public.coupon_redemptions, public.user_entitlements
  to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;

-- Support and account communication.
grant select on public.support_tickets to authenticated;
grant insert (user_id, subject, category, requester_email) on public.support_tickets to authenticated;
grant update (status, priority, assigned_to, resolved_at) on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;
grant insert (ticket_id, author_id, sender_type, message, attachment_paths, is_internal_note)
  on public.support_ticket_messages to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.feedback to authenticated;
grant insert (user_id, category, rating, message, page_url) on public.feedback to authenticated;

-- Guest forms: insert-only. Contact/newsletter records are not publicly readable.
grant insert (user_id, name, email, subject, message) on public.contact_messages to authenticated;
grant insert (name, email, subject, message) on public.contact_messages to anon;
grant insert (email, user_id, source) on public.newsletter_subscribers to authenticated;
grant insert (email, source) on public.newsletter_subscribers to anon;

-- Administrative read access; RLS limits these broad grants to staff roles.
grant select on
  public.audit_logs, public.contact_messages, public.newsletter_subscribers,
  public.feedback, public.support_tickets, public.support_ticket_messages
  to authenticated;
grant update on public.feedback to authenticated;
grant update (status) on public.contact_messages to authenticated;
grant update (is_confirmed, unsubscribed_at) on public.newsletter_subscribers to authenticated;
grant update (status, priority, assigned_to, resolved_at) on public.support_tickets to authenticated;

-- Helper functions used from RLS policies.
grant execute on function private.has_any_role(public.app_role[]) to anon, authenticated;
grant execute on function private.can_access_content(public.content_access) to anon, authenticated;

-- PROFILE / ACCOUNT ---------------------------------------------------------
create policy profiles_read_own_or_admin
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy user_roles_read_own_or_admin
on public.user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[]))
);

create policy user_preferences_owner_all
on public.user_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy user_preferences_read_admin
on public.user_preferences for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy user_consents_read_own_or_admin
on public.user_consents for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[]))
);

create policy user_consents_insert_own
on public.user_consents for insert to authenticated
with check (user_id = (select auth.uid()));

-- PUBLISHED CURRICULUM ------------------------------------------------------
create policy courses_read_published_or_editor
on public.courses for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy courses_manage_by_editor
on public.courses for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy course_units_read_published_or_editor
on public.course_units for select to anon, authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_units.course_id and c.publication_status = 'published'
  )
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy course_units_manage_by_editor
on public.course_units for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lessons_read_published_or_editor
on public.lessons for select to anon, authenticated
using (
  exists (
    select 1
    from public.course_units u
    join public.courses c on c.id = u.course_id
    where u.id = lessons.unit_id
      and u.publication_status = 'published'
      and c.publication_status = 'published'
  )
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy lessons_manage_by_editor
on public.lessons for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_blocks_read_accessible
on public.lesson_content_blocks for select to anon, authenticated
using (
  private.can_access_content(access_level)
  and exists (
    select 1
    from public.lessons l
    join public.course_units u on u.id = l.unit_id
    join public.courses c on c.id = u.course_id
    where l.id = lesson_content_blocks.lesson_id
      and l.publication_status = 'published'
      and u.publication_status = 'published'
      and c.publication_status = 'published'
  )
);

create policy lesson_blocks_manage_by_editor
on public.lesson_content_blocks for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy content_assets_read_accessible
on public.content_assets for select to anon, authenticated
using (private.can_access_content(access_level));

create policy content_assets_manage_by_editor
on public.content_assets for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy vocabulary_read_published_or_editor
on public.vocabulary_entries for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy vocabulary_manage_by_editor
on public.vocabulary_entries for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy kanji_read_published_or_editor
on public.kanji_entries for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy kanji_manage_by_editor
on public.kanji_entries for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy grammar_read_published_or_editor
on public.grammar_points for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy grammar_manage_by_editor
on public.grammar_points for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_vocabulary_read_published
on public.lesson_vocabulary for select to anon, authenticated
using (
  exists (select 1 from public.lessons l where l.id = lesson_vocabulary.lesson_id and l.publication_status = 'published')
  and exists (select 1 from public.vocabulary_entries v where v.id = lesson_vocabulary.vocabulary_id and v.publication_status = 'published')
);
create policy lesson_vocabulary_manage_by_editor
on public.lesson_vocabulary for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_kanji_read_published
on public.lesson_kanji for select to anon, authenticated
using (
  exists (select 1 from public.lessons l where l.id = lesson_kanji.lesson_id and l.publication_status = 'published')
  and exists (select 1 from public.kanji_entries k where k.id = lesson_kanji.kanji_id and k.publication_status = 'published')
);
create policy lesson_kanji_manage_by_editor
on public.lesson_kanji for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_grammar_read_published
on public.lesson_grammar for select to anon, authenticated
using (
  exists (select 1 from public.lessons l where l.id = lesson_grammar.lesson_id and l.publication_status = 'published')
  and exists (select 1 from public.grammar_points g where g.id = lesson_grammar.grammar_id and g.publication_status = 'published')
);
create policy lesson_grammar_manage_by_editor
on public.lesson_grammar for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

-- QUIZZES: correct answers are not stored in public.quiz_options or public.quiz_questions.
create policy quizzes_read_published_accessible
on public.quizzes for select to anon, authenticated
using (
  publication_status = 'published'
  and private.can_access_content(access_level)
  and (
    (course_id is not null and exists (select 1 from public.courses c where c.id = quizzes.course_id and c.publication_status = 'published'))
    or
    (lesson_id is not null and exists (select 1 from public.lessons l where l.id = quizzes.lesson_id and l.publication_status = 'published'))
  )
);
create policy quizzes_manage_by_editor
on public.quizzes for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy quiz_questions_read_accessible
on public.quiz_questions for select to anon, authenticated
using (
  is_active and exists (
    select 1 from public.quizzes q
    where q.id = quiz_questions.quiz_id
      and q.publication_status = 'published'
      and private.can_access_content(q.access_level)
  )
);
create policy quiz_questions_manage_by_editor
on public.quiz_questions for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy quiz_options_read_accessible
on public.quiz_options for select to anon, authenticated
using (
  exists (
    select 1 from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    where qq.id = quiz_options.question_id
      and qq.is_active
      and q.publication_status = 'published'
      and private.can_access_content(q.access_level)
  )
);
create policy quiz_options_manage_by_editor
on public.quiz_options for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

-- LEARNER STATE -------------------------------------------------------------
create policy course_enrollments_read_own_or_admin
on public.course_enrollments for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy course_enrollments_insert_own
on public.course_enrollments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.courses c where c.id = course_enrollments.course_id and c.publication_status = 'published')
);

create policy lesson_progress_read_own_or_admin
on public.lesson_progress for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy lesson_progress_insert_own
on public.lesson_progress for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.lessons l
    join public.course_units u on u.id = l.unit_id
    join public.courses c on c.id = u.course_id
    where l.id = lesson_progress.lesson_id
      and l.publication_status = 'published'
      and u.publication_status = 'published'
      and c.publication_status = 'published'
  )
);
create policy lesson_progress_update_own
on public.lesson_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy daily_activity_read_own_or_admin
on public.user_daily_activity for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy bookmarks_owner_all
on public.user_bookmarks for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy vocabulary_review_owner_all
on public.vocabulary_review_state for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.vocabulary_entries v where v.id = vocabulary_review_state.vocabulary_id and v.publication_status = 'published')
);

create policy badges_read_active
on public.badges for select to anon, authenticated
using (is_active or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));
create policy badges_manage_by_admin
on public.badges for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy user_badges_read_own_or_admin
on public.user_badges for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy quiz_attempts_read_own_or_admin
on public.quiz_attempts for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));
create policy quiz_attempts_insert_own
on public.quiz_attempts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'in_progress'
  and exists (
    select 1 from public.quizzes q
    where q.id = quiz_attempts.quiz_id
      and q.publication_status = 'published'
      and private.can_access_content(q.access_level)
  )
);

create policy quiz_responses_read_own_or_admin
on public.quiz_responses for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));
create policy quiz_responses_insert_own_in_progress
on public.quiz_responses for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.quiz_attempts a
    join public.quiz_questions q on q.quiz_id = a.quiz_id
    where a.id = quiz_responses.attempt_id
      and a.user_id = (select auth.uid())
      and a.status = 'in_progress'
      and q.id = quiz_responses.question_id
      and q.is_active
  )
);

-- SITE / CMS ----------------------------------------------------------------
create policy cms_pages_read_published
on public.cms_pages for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy cms_pages_manage_by_editor
on public.cms_pages for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy announcements_read_current
on public.announcements for select to anon, authenticated
using (
  publication_status = 'published'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and (target_audience = 'all'
       or (target_audience = 'learners' and (select auth.uid()) is not null)
       or (target_audience = 'premium' and private.can_access_content('premium'::public.content_access))
       or (target_audience = 'staff' and (select private.has_any_role(array['super_admin', 'admin', 'content_editor', 'support_agent']::public.app_role[]))))
);
create policy announcements_manage_by_editor
on public.announcements for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy site_settings_read_public
on public.site_settings for select to anon, authenticated
using (is_public or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy site_settings_manage_by_admin
on public.site_settings for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy feature_flags_read_public
on public.feature_flags for select to anon, authenticated
using ((is_public and is_enabled) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy feature_flags_manage_by_admin
on public.feature_flags for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy notifications_read_own
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_mark_read_own
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- SUPPORT / FEEDBACK --------------------------------------------------------
create policy support_tickets_read_owner_or_staff
on public.support_tickets for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
);
create policy support_tickets_insert_owner
on public.support_tickets for insert to authenticated
with check (user_id = (select auth.uid()));
create policy support_tickets_update_staff
on public.support_tickets for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));

create policy support_messages_read_owner_or_staff
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        t.user_id = (select auth.uid())
        or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
      )
  )
  and (
    not is_internal_note
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);
create policy support_messages_insert_by_owner
on public.support_ticket_messages for insert to authenticated
with check (
  sender_type = 'user'
  and is_internal_note = false
  and author_id = (select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id and t.user_id = (select auth.uid())
  )
);
create policy support_messages_insert_by_staff
on public.support_ticket_messages for insert to authenticated
with check (
  sender_type = 'staff'
  and author_id = (select auth.uid())
  and (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
);

create policy contact_messages_insert_guest
on public.contact_messages for insert to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()));
create policy contact_messages_read_staff
on public.contact_messages for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));
create policy contact_messages_update_staff
on public.contact_messages for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));

create policy newsletter_insert_guest
on public.newsletter_subscribers for insert to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()));
create policy newsletter_read_admin
on public.newsletter_subscribers for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy newsletter_update_admin
on public.newsletter_subscribers for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy feedback_read_owner_or_staff
on public.feedback for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));
create policy feedback_insert_owner
on public.feedback for insert to authenticated
with check (user_id = (select auth.uid()));
create policy feedback_update_staff
on public.feedback for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));

create policy audit_logs_read_admin
on public.audit_logs for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

-- BILLING -------------------------------------------------------------------
create policy subscription_plans_read_active
on public.subscription_plans for select to anon, authenticated
using (is_active or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy subscription_plans_manage_admin
on public.subscription_plans for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy plan_features_read_active_plan
on public.plan_features for select to anon, authenticated
using (
  exists (select 1 from public.subscription_plans p where p.id = plan_features.plan_id and p.is_active)
  or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[]))
);
create policy plan_features_manage_admin
on public.plan_features for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy billing_profiles_read_owner_or_admin
on public.billing_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy billing_profiles_insert_owner
on public.billing_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy billing_profiles_update_owner
on public.billing_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy subscriptions_read_owner_or_admin
on public.subscriptions for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy payment_orders_read_owner_or_admin
on public.payment_orders for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy payments_read_owner_or_admin
on public.payments for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy invoices_read_owner_or_admin
on public.invoices for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy refunds_read_owner_or_admin
on public.payment_refunds for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy coupons_manage_admin
on public.coupons for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy coupon_redemptions_read_owner_or_admin
on public.coupon_redemptions for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy entitlements_read_owner_or_admin
on public.user_entitlements for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

-- Give backend workers full table access. The service_role key must never be sent to a browser.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all tables in schema private to service_role;
grant all privileges on all sequences in schema public to service_role;
-- Client inserts use UUID defaults; identity sequences remain server-side.

commit;

-- END 005_security_rls_grants.sql


-- ============================================================================
-- BEGIN 006_storage.sql
-- ============================================================================

-- Nihongo Labs — Supabase Storage buckets and object policies
-- Run after the core schema and RLS helper functions have been installed.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('nihongo-public', 'nihongo-public', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4', 'application/pdf']),
  ('nihongo-premium', 'nihongo-premium', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4', 'application/pdf']),
  ('nihongo-avatars', 'nihongo-avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('nihongo-private', 'nihongo-private', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public lesson assets are readable by everyone; writes are reserved for editors/admins.
create policy nihongo_public_assets_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'nihongo-public');

create policy nihongo_public_assets_insert_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_public_assets_update_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
)
with check (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_public_assets_delete_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);


-- Premium media must live in a private bucket; signed URLs should be generated server-side / after entitlement checks.
create policy nihongo_premium_assets_read_entitled
on storage.objects for select to authenticated
using (
  bucket_id = 'nihongo-premium'
  and (
    private.can_access_content('premium'::public.content_access)
    or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
  )
);

create policy nihongo_premium_assets_insert_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_premium_assets_update_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
)
with check (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_premium_assets_delete_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

-- Avatar object names must begin with the authenticated user's UUID.
create policy nihongo_avatars_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'nihongo-avatars');

create policy nihongo_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy nihongo_avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy nihongo_avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Private support attachments: owner and support staff can read; users can upload only into their own folder.
create policy nihongo_private_files_read_owner_or_staff
on storage.objects for select to authenticated
using (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);

create policy nihongo_private_files_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy nihongo_private_files_update_owner_or_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
)
with check (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);

create policy nihongo_private_files_delete_owner_or_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);

commit;

-- END 006_storage.sql


-- ============================================================================
-- BEGIN 008_flashcards.sql
-- ============================================================================

-- Nihongo Labs — flashcard decks, user-created cards and FSRS-ready review history
-- Run after the base schema files 001_foundation.sql through 006_storage.sql.
-- It also works after the optional 007_seed.sql starter data.
-- Existing learners can apply this as an incremental migration; it does not drop data.

begin;

-- Use enums for constrained ratings and scheduler states. The DO blocks make this
-- migration safe to retry if a previous run stopped after creating the enum.
do $$
begin
  create type public.flashcard_rating as enum ('again', 'hard', 'good', 'easy');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.flashcard_scheduler_state as enum ('new', 'learning', 'review', 'relearning');
exception when duplicate_object then null;
end;
$$;

-- Admin-authored decks are public catalog content. Learner-authored decks are
-- private by design in this release; public community decks are not enabled.
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  deck_type text not null default 'personal' check (deck_type in ('official', 'personal')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  jlpt_level public.jlpt_level,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  access_level public.content_access not null default 'free',
  publication_status public.publication_status not null default 'draft',
  cover_image_path text,
  allow_copy boolean not null default true,
  default_settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcard_decks_owner_kind_check check (
    (deck_type = 'official' and owner_id is null)
    or
    (deck_type = 'personal' and owner_id is not null
      and visibility = 'private'
      and access_level = 'free'
      and publication_status = 'draft')
  )
);

create unique index if not exists flashcard_official_slug_uidx
  on public.flashcard_decks(slug) where deck_type = 'official';
create unique index if not exists flashcard_personal_owner_slug_uidx
  on public.flashcard_decks(owner_id, slug) where deck_type = 'personal';
create index if not exists flashcard_decks_catalog_idx
  on public.flashcard_decks(publication_status, visibility, jlpt_level, created_at desc);
create index if not exists flashcard_decks_owner_idx
  on public.flashcard_decks(owner_id, updated_at desc) where owner_id is not null;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  source_type text not null default 'custom'
    check (source_type in ('custom', 'vocabulary', 'kanji', 'grammar')),
  vocabulary_id uuid references public.vocabulary_entries(id) on delete restrict,
  kanji_id uuid references public.kanji_entries(id) on delete restrict,
  grammar_id uuid references public.grammar_points(id) on delete restrict,
  front_text text not null check (char_length(front_text) between 1 and 2000),
  back_text text not null check (char_length(back_text) between 1 and 4000),
  front_reading text,
  back_reading text,
  front_romaji text,
  back_romaji text,
  hint text check (hint is null or char_length(hint) <= 1000),
  example_sentence text,
  example_translation text,
  front_audio_asset_id uuid references public.content_assets(id) on delete set null,
  back_audio_asset_id uuid references public.content_assets(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_source_reference_check check (
    (source_type = 'custom' and vocabulary_id is null and kanji_id is null and grammar_id is null)
    or (source_type = 'vocabulary' and vocabulary_id is not null and kanji_id is null and grammar_id is null)
    or (source_type = 'kanji' and vocabulary_id is null and kanji_id is not null and grammar_id is null)
    or (source_type = 'grammar' and vocabulary_id is null and kanji_id is null and grammar_id is not null)
  )
);

create index if not exists flashcards_deck_order_idx on public.flashcards(deck_id, sort_order, created_at);
create index if not exists flashcards_vocabulary_idx on public.flashcards(vocabulary_id) where vocabulary_id is not null;
create index if not exists flashcards_kanji_idx on public.flashcards(kanji_id) where kanji_id is not null;
create index if not exists flashcards_grammar_idx on public.flashcards(grammar_id) where grammar_id is not null;

-- Curated topic/JLPT tags can be attached to a deck or an individual card.
create table if not exists public.flashcard_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  tag_category text not null default 'topic'
    check (tag_category in ('jlpt', 'topic', 'part_of_speech', 'skill')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_deck_tags (
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  tag_id uuid not null references public.flashcard_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, tag_id)
);

create table if not exists public.flashcard_card_tags (
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  tag_id uuid not null references public.flashcard_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (flashcard_id, tag_id)
);

-- A learner's saved/active/archived deck library. Personal decks can be viewed
-- by their owner without needing a separate library row.
create table if not exists public.user_flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived', 'completed')),
  is_favorite boolean not null default false,
  added_at timestamptz not null default now(),
  last_studied_at timestamptz,
  unique (user_id, deck_id)
);
create index if not exists user_flashcard_decks_library_idx
  on public.user_flashcard_decks(user_id, status, is_favorite desc, added_at desc);

-- A session groups review events and is useful for a deck's study summary.
-- The browser can open a session; only trusted backend code should finalize
-- its timestamps and counters.
create table if not exists public.flashcard_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  session_mode text not null default 'mixed' check (session_mode in ('new', 'review', 'mixed', 'custom')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cards_seen integer not null default 0 check (cards_seen >= 0),
  again_count integer not null default 0 check (again_count >= 0),
  hard_count integer not null default 0 check (hard_count >= 0),
  good_count integer not null default 0 check (good_count >= 0),
  easy_count integer not null default 0 check (easy_count >= 0),
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  created_at timestamptz not null default now(),
  constraint flashcard_sessions_rating_total_check check (
    cards_seen >= again_count + hard_count + good_count + easy_count
  )
);
create index if not exists flashcard_sessions_user_idx
  on public.flashcard_sessions(user_id, started_at desc);
create index if not exists flashcard_sessions_deck_idx
  on public.flashcard_sessions(deck_id, started_at desc);

-- Append-only learner review log. Client inserts only the rating event;
-- scheduling metadata is filled by the trusted FSRS processing function.
create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  session_id uuid references public.flashcard_sessions(id) on delete set null,
  rating public.flashcard_rating not null,
  response_time_ms integer check (response_time_ms is null or response_time_ms between 0 and 3600000),
  reviewed_at timestamptz not null default now(),
  scheduler_version text not null default 'fsrs-6',
  state_before jsonb,
  state_after jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists flashcard_reviews_user_time_idx
  on public.flashcard_reviews(user_id, reviewed_at desc);
create index if not exists flashcard_reviews_card_time_idx
  on public.flashcard_reviews(user_id, flashcard_id, reviewed_at desc);
create index if not exists flashcard_reviews_unprocessed_idx
  on public.flashcard_reviews(created_at)
  where processed_at is null;

-- One row per learner/card, updated only by trusted server code after the
-- review event is processed by the FSRS scheduler.
create table if not exists public.flashcard_review_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  scheduler_state public.flashcard_scheduler_state not null default 'new',
  due_at timestamptz not null default now(),
  stability_days numeric(12,4) check (stability_days is null or stability_days >= 0),
  difficulty numeric(7,4) check (difficulty is null or difficulty between 1 and 10),
  elapsed_days numeric(12,4) not null default 0 check (elapsed_days >= 0),
  scheduled_days numeric(12,4) not null default 0 check (scheduled_days >= 0),
  learning_step smallint not null default 0 check (learning_step >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_rating public.flashcard_rating,
  last_reviewed_at timestamptz,
  last_review_id uuid references public.flashcard_reviews(id) on delete set null,
  suspended_at timestamptz,
  buried_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, flashcard_id)
);
create index if not exists flashcard_review_state_due_idx
  on public.flashcard_review_state(user_id, due_at)
  where suspended_at is null;
create index if not exists flashcard_review_state_card_idx
  on public.flashcard_review_state(flashcard_id, user_id);


-- User controls for their FSRS workload and card presentation.
create table if not exists public.user_flashcard_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_new_limit integer not null default 20 check (daily_new_limit between 0 and 500),
  daily_review_limit integer not null default 200 check (daily_review_limit between 0 and 2000),
  desired_retention numeric(4,3) not null default 0.900 check (desired_retention between 0.700 and 0.990),
  show_romaji boolean not null default true,
  show_furigana boolean not null default true,
  autoplay_audio boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Keep flashcard preferences present from the first signup. This trigger is
-- restricted to Supabase Auth, matching the existing profile-creation pattern.
create or replace function private.handle_new_flashcard_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_flashcard_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_flashcard_settings() from public, anon, authenticated;
grant execute on function private.handle_new_flashcard_settings() to supabase_auth_admin;

drop trigger if exists on_auth_user_created_flashcard_settings on auth.users;
create trigger on_auth_user_created_flashcard_settings
after insert on auth.users
for each row execute function private.handle_new_flashcard_settings();

insert into public.user_flashcard_settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

-- Extend the existing activity roll-up so the learner dashboard can show
-- flashcard volume without scanning the full review-event table.
alter table public.user_daily_activity
  add column if not exists flashcards_reviewed integer not null default 0 check (flashcards_reviewed >= 0);
alter table public.user_daily_activity
  add column if not exists flashcards_again integer not null default 0 check (flashcards_again >= 0);
alter table public.user_daily_activity
  add column if not exists flashcards_known integer not null default 0 check (flashcards_known >= 0);

-- updated_at triggers for mutable flashcard records.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['flashcard_decks', 'flashcards', 'flashcard_review_state', 'user_flashcard_settings'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', v_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      v_table
    );
  end loop;
end;
$$;

-- RLS is enabled immediately, before granting Data API access.
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_tags enable row level security;
alter table public.flashcard_deck_tags enable row level security;
alter table public.flashcard_card_tags enable row level security;
alter table public.user_flashcard_decks enable row level security;
alter table public.flashcard_review_state enable row level security;
alter table public.flashcard_sessions enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.user_flashcard_settings enable row level security;

revoke all privileges on
  public.flashcard_decks, public.flashcards, public.flashcard_tags,
  public.flashcard_deck_tags, public.flashcard_card_tags,
  public.user_flashcard_decks, public.flashcard_review_state,
  public.flashcard_sessions, public.flashcard_reviews, public.user_flashcard_settings
  from public, anon, authenticated;

-- Catalog reads are explicitly exposed; RLS still controls which rows are visible.
grant select on
  public.flashcard_decks, public.flashcards, public.flashcard_tags,
  public.flashcard_deck_tags, public.flashcard_card_tags
  to anon, authenticated;

-- Personal deck CRUD is limited to safe, owner-editable columns. Users cannot
-- turn their private draft deck into an official/public/premium deck.
grant insert (owner_id, deck_type, visibility, jlpt_level, slug, title, description,
              access_level, publication_status, cover_image_path, default_settings)
  on public.flashcard_decks to authenticated;
grant update (slug, title, description, jlpt_level, cover_image_path, default_settings)
  on public.flashcard_decks to authenticated;
grant delete on public.flashcard_decks to authenticated;

-- Cards may be created/edited only inside personal decks owned by the caller.
-- Official content is managed by a trusted server/Edge Function using service_role.
grant insert (deck_id, source_type, vocabulary_id, kanji_id, grammar_id,
              front_text, back_text, front_reading, back_reading, front_romaji,
              back_romaji, hint, example_sentence, example_translation,
              front_audio_asset_id, back_audio_asset_id, sort_order, metadata)
  on public.flashcards to authenticated;
grant update (front_text, back_text, front_reading, back_reading, front_romaji,
              back_romaji, hint, example_sentence, example_translation,
              front_audio_asset_id, back_audio_asset_id, sort_order, metadata)
  on public.flashcards to authenticated;
grant delete on public.flashcards to authenticated;

-- Users can tag their own personal decks/cards with the curated tag vocabulary.
grant select, insert, delete on public.flashcard_deck_tags to authenticated;
grant select, insert, delete on public.flashcard_card_tags to authenticated;

-- Personal library and settings. Scheduling state is read-only to clients;
-- the trusted scheduler writes it after processing review events.
grant select on public.user_flashcard_decks to authenticated;
grant insert (user_id, deck_id, status, is_favorite) on public.user_flashcard_decks to authenticated;
grant update (status, is_favorite) on public.user_flashcard_decks to authenticated;
grant delete on public.user_flashcard_decks to authenticated;
grant select on public.flashcard_review_state to authenticated;
grant select on public.flashcard_sessions to authenticated;
grant insert (user_id, deck_id, session_mode) on public.flashcard_sessions to authenticated;
grant select on public.flashcard_reviews to authenticated;
grant insert (user_id, flashcard_id, session_id, rating, response_time_ms)
  on public.flashcard_reviews to authenticated;
grant select on public.user_flashcard_settings to authenticated;
grant insert (user_id, daily_new_limit, daily_review_limit, desired_retention,
              show_romaji, show_furigana, autoplay_audio)
  on public.user_flashcard_settings to authenticated;
grant update (daily_new_limit, daily_review_limit, desired_retention,
              show_romaji, show_furigana, autoplay_audio)
  on public.user_flashcard_settings to authenticated;

-- Private user deck visibility; official decks are visible only when published,
-- public and included in the current user's content entitlement.
drop policy if exists flashcard_decks_read_accessible on public.flashcard_decks;
create policy flashcard_decks_read_accessible
on public.flashcard_decks for select to anon, authenticated
using (
  owner_id = (select auth.uid())
  or (
    deck_type = 'official'
    and (
      (visibility = 'public' and publication_status = 'published'
        and (select private.can_access_content(access_level)))
      or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
    )
  )
);

drop policy if exists flashcard_decks_insert_personal on public.flashcard_decks;
create policy flashcard_decks_insert_personal
on public.flashcard_decks for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and deck_type = 'personal'
  and visibility = 'private'
  and access_level = 'free'
  and publication_status = 'draft'
);

drop policy if exists flashcard_decks_update_personal on public.flashcard_decks;
create policy flashcard_decks_update_personal
on public.flashcard_decks for update to authenticated
using (owner_id = (select auth.uid()) and deck_type = 'personal')
with check (
  owner_id = (select auth.uid())
  and deck_type = 'personal'
  and visibility = 'private'
  and access_level = 'free'
  and publication_status = 'draft'
);

drop policy if exists flashcard_decks_delete_personal on public.flashcard_decks;
create policy flashcard_decks_delete_personal
on public.flashcard_decks for delete to authenticated
using (owner_id = (select auth.uid()) and deck_type = 'personal');

-- A card follows the visibility/entitlement of its parent deck.
drop policy if exists flashcards_read_accessible on public.flashcards;
create policy flashcards_read_accessible
on public.flashcards for select to anon, authenticated
using (
  (flashcards.is_active or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
  and exists (
    select 1
    from public.flashcard_decks d
    where d.id = flashcards.deck_id
      and (
        d.owner_id = (select auth.uid())
        or (
          d.deck_type = 'official'
          and (
            (d.visibility = 'public' and d.publication_status = 'published'
              and (select private.can_access_content(d.access_level)))
            or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
          )
        )
      )
  )
);

drop policy if exists flashcards_insert_personal on public.flashcards;
create policy flashcards_insert_personal
on public.flashcards for insert to authenticated
with check (
  exists (
    select 1 from public.flashcard_decks d
    where d.id = flashcards.deck_id
      and d.owner_id = (select auth.uid())
      and d.deck_type = 'personal'
  )
  and (
    (source_type = 'custom' and vocabulary_id is null and kanji_id is null and grammar_id is null)
    or (source_type = 'vocabulary' and exists (
      select 1 from public.vocabulary_entries v
      where v.id = flashcards.vocabulary_id and v.publication_status = 'published'
    ))
    or (source_type = 'kanji' and exists (
      select 1 from public.kanji_entries k
      where k.id = flashcards.kanji_id and k.publication_status = 'published'
    ))
    or (source_type = 'grammar' and exists (
      select 1 from public.grammar_points g
      where g.id = flashcards.grammar_id and g.publication_status = 'published'
    ))
  )
);

drop policy if exists flashcards_update_personal on public.flashcards;
create policy flashcards_update_personal
on public.flashcards for update to authenticated
using (
  exists (select 1 from public.flashcard_decks d
          where d.id = flashcards.deck_id and d.owner_id = (select auth.uid()) and d.deck_type = 'personal')
)
with check (
  exists (select 1 from public.flashcard_decks d
          where d.id = flashcards.deck_id and d.owner_id = (select auth.uid()) and d.deck_type = 'personal')
);

drop policy if exists flashcards_delete_personal on public.flashcards;
create policy flashcards_delete_personal
on public.flashcards for delete to authenticated
using (
  exists (select 1 from public.flashcard_decks d
          where d.id = flashcards.deck_id and d.owner_id = (select auth.uid()) and d.deck_type = 'personal')
);

-- Curated tags are read-only to learners; content staff maintain them server-side.
drop policy if exists flashcard_tags_read_active on public.flashcard_tags;
create policy flashcard_tags_read_active
on public.flashcard_tags for select to anon, authenticated
using (is_active or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

drop policy if exists flashcard_deck_tags_read_accessible on public.flashcard_deck_tags;
create policy flashcard_deck_tags_read_accessible
on public.flashcard_deck_tags for select to anon, authenticated
using (exists (select 1 from public.flashcard_decks d where d.id = flashcard_deck_tags.deck_id));

drop policy if exists flashcard_deck_tags_manage_personal on public.flashcard_deck_tags;
create policy flashcard_deck_tags_manage_personal
on public.flashcard_deck_tags for all to authenticated
using (exists (select 1 from public.flashcard_decks d
               where d.id = flashcard_deck_tags.deck_id
                 and d.owner_id = (select auth.uid()) and d.deck_type = 'personal'))
with check (
  exists (select 1 from public.flashcard_decks d
          where d.id = flashcard_deck_tags.deck_id
            and d.owner_id = (select auth.uid()) and d.deck_type = 'personal')
  and exists (select 1 from public.flashcard_tags t
              where t.id = flashcard_deck_tags.tag_id and t.is_active)
);

drop policy if exists flashcard_card_tags_read_accessible on public.flashcard_card_tags;
create policy flashcard_card_tags_read_accessible
on public.flashcard_card_tags for select to anon, authenticated
using (exists (select 1 from public.flashcards c where c.id = flashcard_card_tags.flashcard_id));

drop policy if exists flashcard_card_tags_manage_personal on public.flashcard_card_tags;
create policy flashcard_card_tags_manage_personal
on public.flashcard_card_tags for all to authenticated
using (exists (
  select 1 from public.flashcards c
  join public.flashcard_decks d on d.id = c.deck_id
  where c.id = flashcard_card_tags.flashcard_id
    and d.owner_id = (select auth.uid()) and d.deck_type = 'personal'
))
with check (
  exists (
    select 1 from public.flashcards c
    join public.flashcard_decks d on d.id = c.deck_id
    where c.id = flashcard_card_tags.flashcard_id
      and d.owner_id = (select auth.uid()) and d.deck_type = 'personal'
  )
  and exists (
    select 1 from public.flashcard_tags t
    where t.id = flashcard_card_tags.tag_id and t.is_active
  )
);

-- Save/subscribe to a deck only when it is currently available to this learner.
drop policy if exists user_flashcard_decks_owner_all on public.user_flashcard_decks;
create policy user_flashcard_decks_owner_all
on public.user_flashcard_decks for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.flashcard_decks d
    where d.id = user_flashcard_decks.deck_id
      and (
        d.owner_id = (select auth.uid())
        or (d.deck_type = 'official' and d.visibility = 'public'
          and d.publication_status = 'published'
          and (select private.can_access_content(d.access_level)))
      )
  )
);

-- Learners can read their scheduling state; only service_role can write it.
drop policy if exists flashcard_review_state_read_own on public.flashcard_review_state;
create policy flashcard_review_state_read_own
on public.flashcard_review_state for select to authenticated
using (user_id = (select auth.uid()));

-- Sessions can be opened by the learner for an accessible deck. Metrics and
-- finished_at are service-managed and are not granted for client updates.
drop policy if exists flashcard_sessions_read_own on public.flashcard_sessions;
create policy flashcard_sessions_read_own
on public.flashcard_sessions for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists flashcard_sessions_insert_own on public.flashcard_sessions;
create policy flashcard_sessions_insert_own
on public.flashcard_sessions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.flashcard_decks d
    where d.id = flashcard_sessions.deck_id
      and (
        d.owner_id = (select auth.uid())
        or (d.deck_type = 'official' and d.visibility = 'public'
          and d.publication_status = 'published'
          and (select private.can_access_content(d.access_level)))
      )
  )
);

-- Review events are append-only from the browser. They must refer to a card
-- and, when supplied, a session belonging to the same user and deck.
drop policy if exists flashcard_reviews_read_own on public.flashcard_reviews;
create policy flashcard_reviews_read_own
on public.flashcard_reviews for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists flashcard_reviews_insert_own on public.flashcard_reviews;
create policy flashcard_reviews_insert_own
on public.flashcard_reviews for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.flashcards c
    join public.flashcard_decks d on d.id = c.deck_id
    where c.id = flashcard_reviews.flashcard_id
      and c.is_active
      and (
        d.owner_id = (select auth.uid())
        or (d.deck_type = 'official' and d.visibility = 'public'
          and d.publication_status = 'published'
          and (select private.can_access_content(d.access_level)))
      )
  )
  and (
    session_id is null
    or exists (
      select 1 from public.flashcard_sessions s
      join public.flashcards c on c.deck_id = s.deck_id
      where s.id = flashcard_reviews.session_id
        and s.user_id = (select auth.uid())
        and c.id = flashcard_reviews.flashcard_id
    )
  )
);

-- Learners can modify only their own presentation and workload settings.
drop policy if exists user_flashcard_settings_owner_all on public.user_flashcard_settings;
create policy user_flashcard_settings_owner_all
on public.user_flashcard_settings for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Trusted backend worker must be able to process review events and write
-- scheduler state/session aggregates. Never expose service_role to the browser.
grant all privileges on
  public.flashcard_decks, public.flashcards, public.flashcard_tags,
  public.flashcard_deck_tags, public.flashcard_card_tags,
  public.user_flashcard_decks, public.flashcard_review_state,
  public.flashcard_sessions, public.flashcard_reviews, public.user_flashcard_settings
  to service_role;

comment on table public.flashcard_decks is
  'Official published decks and private learner-created decks. Personal decks cannot be made public by client updates.';
comment on table public.flashcards is
  'Flashcard content; cards inherit visibility and entitlement from their parent deck. Deactivate reviewed official cards instead of deleting them to preserve study history.';
comment on table public.flashcard_reviews is
  'Append-only learner rating events; scheduler metadata is written by trusted backend code.';
comment on table public.flashcard_review_state is
  'Per-user FSRS-ready scheduling state. Client roles have read-only access.';
comment on table public.flashcard_sessions is
  'Learner study sessions; session counters and completion are written by trusted backend code.';

commit;

-- END 008_flashcards.sql
