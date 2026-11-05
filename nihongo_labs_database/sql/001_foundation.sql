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
