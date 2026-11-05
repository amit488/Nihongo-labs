# Nihongo Labs database (Supabase + PostgreSQL)

This package is a production-oriented **starting schema** for the Nihongo Labs Japanese-learning website. It assumes Supabase Auth for signup/login and PostgreSQL for application data.

## Included

- Signup/profile automation from `auth.users`; learner preferences and consent records.
- Admin roles: `super_admin`, `admin`, `content_editor`, `support_agent`.
- Courses, units, lessons, content blocks, assets, JLPT vocabulary, kanji and grammar.
- Quizzes, options, attempts and learner responses. Correct answers are stored in the non-exposed `private.quiz_answer_keys` table, not in learner-readable quiz tables.
- Enrollments, lesson progress, activity summaries, bookmarks, vocabulary spaced repetition and badges.
- **Flashcards:** official and private learner-created decks; custom/vocabulary/kanji/grammar cards; deck/card tags; saved decks; study sessions; append-only review events; per-user FSRS-ready scheduling state; configurable daily limits and retention; daily activity counters.
- Free/paid plans, feature entitlements, subscriptions, checkout orders, payments, invoices, refunds, coupons and idempotent webhook event storage.
- CMS pages, announcements, site configuration, feature flags, notifications, support, contact, newsletter, feedback and audit logs.
- Row Level Security policies, explicit Data API grants and separate public/avatar/private Storage buckets.

## Install order

Run each schema file **once**, in order, in the Supabase SQL Editor (or apply them as ordered migrations in your local Supabase project):

1. `sql/001_foundation.sql`
2. `sql/002_learning.sql`
3. `sql/003_billing.sql`
4. `sql/004_functions_triggers.sql`
5. `sql/005_security_rls_grants.sql`
6. `sql/006_storage.sql`
7. `sql/008_flashcards.sql`

Optional starter data (run after the schema files):

- `sql/007_seed.sql` — general website configuration, free plan and feature flags.
- `sql/009_flashcards_seed.sql` — curated flashcard tags (JLPT levels, vocabulary, kanji, grammar, topics and skills).

The full combined script is also supplied as `nihongo_labs_full_schema.sql`; it contains the complete schema, functions, RLS, storage setup and flashcard tables, but not optional starter data.

> **Existing local database:** Do not rerun the full schema against an already initialized database. Apply only `sql/008_flashcards.sql` once. With the Supabase CLI, create a migration using `supabase migration new add_flashcard_system`, copy the contents of `008_flashcards.sql` into the generated migration file, then run `supabase db reset` only when you intend to rebuild your local database from all migrations. For a live project, take a backup and apply the migration through your approved migration workflow.

> Do not run this against an existing production database without reviewing name collisions, taking a backup and adapting it as a migration. The base scripts use `CREATE TYPE` and `CREATE TABLE` statements intended for a clean project. The flashcard migration is incremental and uses `IF NOT EXISTS`/replace-safe policy setup for its objects.

## First admin account

1. Sign up with your own email through the website or Supabase Auth.
2. Confirm the email if email confirmation is enabled.
3. Run this in the SQL Editor, replacing the address:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin'::public.app_role
from auth.users
where lower(email) = lower('YOUR_EMAIL@example.com')
on conflict (user_id, role) do nothing;
```

Do not add role assignment to the public signup form. Do not trust `user_metadata` or a browser-supplied `role` value to grant admin access. Role changes should be performed by a trusted server or SQL administrator.

## Auth and signup

Supabase Auth owns passwords, sessions, email verification, password reset and OAuth. The `private.handle_new_user()` trigger creates a `profiles` and `user_preferences` row after signup. The flashcard migration adds a separate Auth trigger that creates `user_flashcard_settings` for new users and backfills defaults for accounts that already exist. The app should call Supabase Auth sign-up/sign-in APIs; it should not write passwords or insert directly into `auth.users`.

The profile trigger only reads display-name metadata. It does not use user-editable metadata for permissions.

## Flashcard data model and behavior

- `flashcard_decks`: official published decks and private learner-owned decks. A personal deck is always private, free and a draft at the database level; a user cannot promote it into an official/premium deck through client-side SQL access.
- `flashcards`: front/back text, readings, romaji, hints, examples, audio references, sort order and optional source links to a vocabulary, kanji or grammar record.
- `flashcard_tags`, `flashcard_deck_tags`, `flashcard_card_tags`: curated tags and deck/card categorisation.
- `user_flashcard_decks`: a learner's saved, active, archived or completed deck list, with favorites.
- `flashcard_sessions`: per-deck study sessions and session-level review counters.
- `flashcard_reviews`: append-only review events. The browser can submit only the card, session, rating (`again`, `hard`, `good`, `easy`) and response time. It cannot write scheduler state, processing status or review timestamps.
- `flashcard_review_state`: one row per user/card, with due time, stability, difficulty, elapsed/scheduled days, repetitions, lapses and FSRS scheduler state. Authenticated clients can read this table but cannot write it.
- `user_flashcard_settings`: daily new/review limits, desired retention, romaji/furigana and audio preferences.
- `user_daily_activity`: includes `flashcards_reviewed`, `flashcards_again` and `flashcards_known` counters for dashboards.

**Important:** The database is FSRS-ready but does not itself calculate FSRS intervals. Add a trusted Edge Function/server worker to process unprocessed `flashcard_reviews`, calculate the next state using your selected FSRS implementation, upsert `flashcard_review_state`, finalize `flashcard_sessions`, update `user_flashcard_decks.last_studied_at`, and increment `user_daily_activity`. Use the service-role key only on the server. Enforce daily limits and idempotent event processing in that worker.

Admin-created official decks, official cards and curated tags must be written through a trusted admin Edge Function/server route or SQL administrator. Do not put the service-role key in the browser. Learners can create and edit cards only in their own private decks.

## Payments and subscriptions

The schema supports Razorpay, Stripe or manual reconciliation. For an India-first launch, configure the chosen provider in a server-side Edge Function. The browser should start checkout through your backend and receive only the provider's hosted checkout details. The provider calls a webhook endpoint. Verify its signature **before** trusting its body. Process event IDs idempotently and update `payment_orders`, `payments`, `subscriptions`, `invoices` and `user_entitlements` in a trusted server-side transaction.

Never store card numbers, CVVs, UPI PINs, netbanking passwords or provider secret keys in these tables. Store provider IDs and non-sensitive metadata only. The `service_role` key and payment webhook secrets must never be included in frontend code or `NEXT_PUBLIC_*` environment variables.

`amount_minor` is an integer in the currency's minor unit. For INR, ₹149.00 is stored as `14900` paise. No paid plan price has been pre-seeded; choose and configure your price in `subscription_plans` before launch.

## Content access model

- Set a course, lesson block or quiz to `free` or `premium`.
- Public content should have `publication_status = 'published'`.
- `private.can_access_content('premium')` checks for an active `user_entitlements` row with `feature_key = 'premium_content'`.
- Verified payment webhooks/Edge Functions are responsible for creating, renewing and expiring entitlement rows.
- A premium flashcard deck is visible only to a learner with the required entitlement; personal decks remain private.

## Admin dashboard access

The dashboard can use the same authenticated Supabase client. RLS grants editors content-table access, support agents support-ticket access, and admins broader business access. For sensitive operations such as changing roles, processing payments, grading quizzes, issuing refunds, creating entitlements, and managing official flashcard content, use trusted server code with the service role and record actions in `audit_logs`.

The `private` schema must remain **out of the Data API exposed schemas**. Do not expose `private.quiz_answer_keys` or any payment webhook payloads to browser clients.

## Storage layout

- `nihongo-public`: free course media and public content. Only content staff can upload/replace/delete.
- `nihongo-premium`: private course media. Premium media must not be put in a public bucket; issue short-lived signed URLs only after the entitlement check.
- `nihongo-avatars`: public reads; each signed-in user can write only under their own UUID folder, e.g. `<user-uuid>/avatar.webp`.
- `nihongo-private`: private support attachments. Upload under `<user-uuid>/<ticket-uuid>/filename`.

The storage script assumes Supabase Storage is enabled. The application should validate file size, MIME type and file contents on the server as well; bucket MIME restrictions alone are not a complete file-validation layer.

## Important Supabase project settings

- Keep `public` in the Data API exposed schemas if you plan to use the Supabase Data API; this script grants table privileges and RLS separately. Supabase's 2026 Data API change means every new public table needs an explicit grant before `supabase-js` can reach it.
- Keep `private` out of exposed schemas.
- Enable email confirmation and configure SMTP before launch.
- Configure allowed redirect URLs, password policy, rate limits and CAPTCHA for public signup/contact forms.
- Never expose the `service_role` key. Use a publishable key in the browser.
- Take backups before running schema changes on a live project.

## What still needs application/server code

SQL establishes the data model and access boundaries; it does not implement the website UI or external workflows. You still need:

- Frontend pages for signup, login, lessons, quiz runner, learner dashboard, checkout, flashcard deck library, card editor, study/review screen and account settings.
- A trusted FSRS scheduler worker/Edge Function to process flashcard review events and update due cards/session summaries.
- Server/Edge Functions for payment checkout, signed webhook verification, entitlement updates, invoice generation, quiz grading, email notifications and role management.
- A trusted content authoring flow for inserting quiz answer keys in `private.quiz_answer_keys` and publishing official flashcard decks/cards.
- Email templates, terms/privacy documents, legal/tax configuration, provider credentials and final prices.
- Automated tests for RLS, webhook idempotency, signup triggers, quiz-answer secrecy, flashcard ownership, FSRS processing idempotency and entitlement expiry.

## Verification checklist

Before launch, test at least these cases with separate guest, learner, premium learner, content editor, support agent and super-admin accounts:

- A guest can read published free content but cannot read drafts, premium blocks or learner records.
- A learner can read/update only their own profile, progress, bookmarks, preferences, billing profile and flashcard settings/state.
- A learner cannot grant themselves roles, premium entitlements, payment status, quiz scores, or publish/upgrade a personal flashcard deck.
- A learner cannot read another learner's payments, subscriptions, support tickets, quiz attempts, personal decks, reviews or scheduling state.
- Flashcard review submissions can create append-only rating events, but cannot write their own due dates, FSRS state or session counters.
- Premium flashcard decks are inaccessible without a valid entitlement.
- Quiz options are readable but the correct answer key is not accessible through the Data API.
- Duplicate payment webhooks and duplicate flashcard processing attempts do not duplicate entitlements or scheduler updates.
- A failed, expired or refunded payment does not retain premium access.
- Storage users cannot read another user's private ticket attachments or overwrite another user's avatar.

The scripts have been reviewed for internal consistency, but have not been executed against your Supabase project or a live PostgreSQL instance. Run them first on a fresh local/development project and add automated database tests before production.
