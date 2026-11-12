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
