# Nihongo Labs — full local application source

This source package brings together the premium Next.js UI, Supabase-backed application services, API routes, Server Actions, practice grading, progress tracking, FSRS flashcard scheduling, vocabulary revision, examination flows, Razorpay billing/webhooks, tests, and an additive N5 starter content pack.

It is prepared against the Nihongo Labs PostgreSQL schema package already in your workspace. The SQL files are included as **reviewable local setup scripts**; this package has not connected to or modified your local Supabase instance. No Git push or deployment was performed.

## Existing project assumptions

- Existing project folder: `nihongo-labs`
- Next.js 16.x, React 19.x, TypeScript
- Supabase local development stack and the initial Nihongo Labs schema migration are already present
- The baseline schema is applied and local `supabase migration up --local` reported that the database was up to date
- The root `supabase/migrations/` history includes the flashcard schema and trusted backend RPCs. Fresh local databases apply them in timestamp order; existing databases should apply pending migrations before using FSRS or trusted learning writes.

The code does not create another database, recreate the original schema, or change the existing database by itself.

## What's included

### Application and authentication

- Landing page, signup, login, Supabase email callback, signout
- Cookie-aware Supabase server client and browser client
- Next.js 16 `proxy.ts` session refresh
- Dashboard and feature navigation, free/premium presentation, Romaji/furigana preferences

### Learning APIs and services

- Published grammar, vocabulary, kanji, course, reading and flashcard content
- Grammar practice and mixed question bank
- Quiz attempt creation, safe option delivery, server-side grading and detailed feedback
- Correct-answer keys remain in `private.quiz_answer_keys` and are only read through a service-role-only RPC
- Lesson progress and completion counters saved atomically, daily activity counters, streak and dashboard calculations
- Vocabulary SM-2 review and due queue
- FSRS-6 (pinned `ts-fsrs@5.4.2`) flashcard scheduling, learning-step state, due queue, session/review persistence and atomic database-enforced daily new/review caps
- Timed quiz/exam runner and attempt history
- Profile and learning preference updates, bookmarks

### Billing

- Plan catalog, checkout order creation, recurring subscription creation, cancellation and status
- Razorpay order-signature verification and raw-body webhook signature verification
- Payment capture/failure/refund event processing, admin-only refund initiation with provider idempotency, invoices, payment history and entitlement syncing
- Webhook event idempotency records and subscription/checkout idempotency support

### Quality and test files

- `tests/domain.test.ts`: answer normalization/grading and date/streak helpers
- `tests/payment-signature.test.ts`: checkout and webhook HMAC verification
- `tests/flashcards-fsrs.test.ts`: deterministic FSRS scheduling behavior
- `tests/sql-contract.test.ts`: security and atomic-RPC contract checks against the included SQL
- `scripts/smoke-local.mjs`: local endpoint smoke checks
- `docs/API_ROUTES.md`: route reference, example payloads and backend security boundaries
- `nihongo-labs-backend/sql/010_n5_content_and_plans_seed.sql`: repeatable starter content and Free / ₹99 / ₹149 monthly plans
- `supabase/migrations/20261112122000_trusted_backend_rpc.sql`: canonical, ordered migration for activity, quiz attempt reservation/finalization, atomic lesson progress, FSRS writes, vocabulary scheduling and refunds. The original `nihongo-labs-backend/sql/011_backend_rpc.sql` is retained as a reference copy; do not execute it manually after the migration is applied.

## Database migration history

The `supabase/migrations/` directory is an ordered, append-only history. Keep every migration file, including earlier changes later corrected or retired by a newer migration. On an existing database, `npx supabase migration up --local` applies only pending migrations; on a fresh database, all migrations are applied in timestamp order. Do not delete or rewrite a migration that may already have been applied.

The separate `nihongo-labs-backend/sql/` directory contains manual seed/setup scripts. Those are not automatically executed by `supabase migration up`; follow the local setup steps below before running them. The Kana question bank is now installed by a Supabase migration, not by the general N5 starter seed.

The My Progress cards are wired to persisted learner activity: Grammar reads understood grammar points, Vocabulary combines words marked learned with spaced-repetition mastery, Reading and Kana use the full graded-attempt history, and Lessons counts published N5 lessons with linked graded checkpoints. The `20261110110000`, `20261110120000` and `20261110130000` migrations install those dashboard sources and correct the N5 quiz-to-lesson links. Apply pending migrations with `npx supabase migration up --local`. Quiz completion and review state use restricted server RPCs installed by the root migration history; no manual RPC paste into Studio is required.

## Local integration steps

### 1. Add source files to the existing repository

Unzip this package outside your current repository, then run from Terminal:

```bash
bash /path/to/nihongo_labs_complete_source/apply_to_existing_repo.sh /absolute/path/to/nihongo-labs
```

The script is conservative: it copies files only when their destination does not already exist. It never overwrites an existing `src` file, package manifest, Next config, database migration, or SQL file. It prints every skipped conflict so you can merge any pre-existing project files manually. It creates `nihongo-labs-backend/sql` and `nihongo-labs-backend/docs`, plus the app tests and smoke script, so you can review database/API references without accidentally applying SQL.

This script does not run Git commands.

### 2. Merge dependencies, don't replace your package manifest

Keep the existing `package.json` and `package-lock.json`. Merge the dependencies in `package.backend-additions.json` into the existing manifest. This package was authored for the versions shown in your local project screenshot (Next 16.4.5 and React 19.3.0). Install additions:

```bash
npm install @supabase/ssr@0.12.7 @supabase/supabase-js@2.119.0 zod@4.1.12 ts-fsrs@5.4.2
npm install -D tsx@4.20.6 typescript@5.8.3 @types/node @types/react @types/react-dom
```

Merge these scripts into the existing `package.json`:

```json
{
  "test:backend": "tsx --test tests/*.test.ts",
  "smoke:local": "node scripts/smoke-local.mjs"
}
```

The source package's own `package.json` is provided for an isolated clean install/build, not as a replacement for your existing application manifest.

### 3. Configure local environment variables

Copy `.env.local.example` to `.env.local` in the project root. Use the **current** values printed by your existing local Supabase CLI:

```bash
npx supabase status
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only; legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted)
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

Never put the Supabase secret/service-role key in a `NEXT_PUBLIC_` variable, never expose it to a Client Component, and never commit `.env.local`.

### 4. Verify the existing schema before applying optional SQL

Do not re-run the original full schema on this already initialized database. In Supabase Studio's SQL Editor, verify that the flashcard migration is present:

```sql
select
  to_regclass('public.flashcard_decks') as flashcard_decks,
  to_regclass('public.flashcard_review_state') as flashcard_review_state,
  to_regclass('public.flashcard_sessions') as flashcard_sessions;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_daily_activity'
  and column_name in ('flashcards_reviewed', 'flashcards_again', 'flashcards_known');
```

If the flashcard tables or columns are missing, first run `npx supabase migration up --local` and inspect migration status. The canonical `20261108035000_flashcards_prerequisite.sql` migration now installs those objects. Do not copy or execute the retained SQL reference script a second time.

### 5. Add starter content and backend RPC helpers locally

After applying pending root migrations:

1. The N5 starter lessons, content blocks, quiz data and plan catalog are installed by `supabase/migrations/20261112121500_n5_starter_content_seed.sql`. The original `nihongo-labs-backend/sql/010_n5_content_and_plans_seed.sql` remains in place as the retained source/reference copy; do not run it manually after the root migration has applied.
2. The backend RPCs and flashcard schema are installed automatically by `supabase/migrations/20261112122000_trusted_backend_rpc.sql` and `supabase/migrations/20261108035000_flashcards_prerequisite.sql`. Their original SQL files remain in the backend folder for reference and comparison; do not execute them manually after the root migrations have applied.
3. Optional original starter scripts from your database package remain available as `sql/007_base_seed_optional.sql` and `sql/009_flashcards_seed_optional.sql`. Do not run redundant seeds unless you need those rows.

For a fresh local database, use `npx supabase db reset --local`. For an existing local database, use `npx supabase migration up --local`.

### 6. Configure login email

In the Supabase local configuration, confirm email confirmation and the callback/redirect URL for `http://localhost:3000/auth/callback`. Configure SMTP for non-local deployment. Local email testing can use the mail catcher exposed by your local Supabase stack.

### 7. Configure Razorpay test mode

Payment code is included, but it cannot create a merchant account, payment keys or Razorpay Plan IDs for you.

1. Add Razorpay **test-mode** credentials to `.env.local`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
2. Create the recurring ₹99 and ₹149 monthly Plans in your Razorpay account. You can create them in the Razorpay Dashboard, or use the included administrator-only `POST /api/admin/billing/sync-plan` route after signing in with a `super_admin` or `admin` account. To use the route, first get the local IDs with `select id, code from public.subscription_plans where code in ('basic_monthly','plus_monthly');`, then POST `{"planId":"<local-plan-uuid>"}` to the route from the same-origin browser session. It creates the provider Plan and saves its returned ID locally.
3. Alternatively, set each matching DB plan's `provider_price_id` to the Plan ID returned by Razorpay. Example only (replace both IDs with yours):

```sql
update public.subscription_plans
set provider_price_id = 'plan_replace_with_razorpay_plan_id'
where code = 'basic_monthly';

update public.subscription_plans
set provider_price_id = 'plan_replace_with_razorpay_plan_id'
where code = 'plus_monthly';
```

4. Register the webhook URL `/api/billing/webhook` in Razorpay. Subscribe to subscription activated/charged/updated/cancelled/halted/completed, payment captured/failed, and refund processed/failed events.
5. Keep webhook secrets server-only. For local webhook testing, use a secure test tunnel only if necessary and never expose your local secret keys.

The frontend and server routes handle hosted recurring subscription URLs and Razorpay Checkout for one-time plans. An administrator can initiate a partial or full refund with `POST /api/admin/billing/refund` using `{"paymentId":"<local-payment-uuid>","amountMinor":14900,"idempotencyKey":"refund-test-001","reason":"Customer request"}`. The route is restricted to `admin`/`super_admin`; it records the idempotency key before calling Razorpay, uses `X-Refund-Idempotency`, and relies on `refund.processed` / `refund.failed` webhooks to reconcile the final local payment state. Use the same key and identical amount/reason when retrying an ambiguous provider request; use a new key for a genuinely new refund. Subscription access is granted from verified server-side webhook events, not from a client-side success screen. Until your merchant Plan IDs and test credentials are configured, checkout correctly reports that recurring checkout is not configured.

### 8. Run and verify locally

```bash
npm run dev
```

Open `http://localhost:3000` for the landing page and `http://localhost:3000/learn` for the learning workspace.

Run unit tests:

```bash
npm run test:backend
```

Run smoke checks while the dev server is running:

```bash
npm run smoke:local
```

The smoke script checks health, public N5 content and authentication boundaries. Use a signed-in test account to verify quiz submissions, progress, flashcard reviews (including concurrent-session and daily-quota limits), admin refunds and billing status.

## Security and implementation notes

- User-specific reads are done with the cookie-backed Supabase client and protected by database RLS.
- Privileged writes use a server-only service-role client. Its key is not sent to browser code.
- Correct quiz answers remain in the private schema; the UI never receives a correct key before submission.
- The server verifies each response against the grading key and atomically persists the response rows, score, attempt finalization and daily counters.
- FSRS state is calculated server-side and the review event, next due date, session counters and daily activity are persisted together.
- Razorpay webhooks are verified against the raw request body before payload processing. Checkout signatures are verified server-side and provider payment objects are fetched before granting lifetime entitlements.

## Content coverage and honest scope

The included seed is a **starter N5 corpus**, not a claim to contain every word or question ever used in JLPT N5. It seeds a structured beginner course, grammar, vocabulary, kanji, reading passages, quiz questions, flashcard decks and Free/Basic/Plus plans. The backend schema/services support larger content sets and additional question types without changing the UI architecture. Content completeness and educational correctness still require a human curriculum review; the seed is not an exhaustive official JLPT syllabus.

## What this package cannot configure autonomously

- Your local `.env.local` secrets and Supabase environment
- Your merchant's Razorpay test/live keys, recurring Plan IDs and webhook secret
- A production SMTP sender, legal/tax terms, domain and payment-provider account

These are account credentials/settings, not missing source modules. This PR changes repository source only: it does not modify your local Supabase instance, a hosted database, or a deployment. GitHub CI validates the ordered migrations against its own temporary Supabase database. When you are ready to apply the migrations to your local project, review the branch and run `npx supabase migration up --local` from your working copy.


## Learning Intelligence

Nihongo Labs includes grammar mistake analytics and vocabulary spaced-repetition insights. Grammar analytics uses question-level learning tags and graded practice history; vocabulary insights use FSRS review state.

Apply the learning-intelligence migration and the AI Sensei removal migration through your normal Supabase workflow after reviewing the existing local migration history. The removal migration drops the unused AI request quota objects and removes any retired Sensei/tutor feature keys from plan features and learner entitlements.


The three paid checkout plans (Monthly ₹149, 6 Months ₹809 and Annual ₹1,599) are synchronized into `subscription_plans` by `20261109175000_align_learning_plans.sql`. Apply pending migrations locally before testing plan checkout. Razorpay recurring Plan IDs still need to be created/linked for each plan.


### My Progress data sources

The signed-in My Progress cards are backed by saved learner data:

- **Grammar:** published N5 grammar points marked as understood in `user_grammar_progress`.
- **Vocabulary:** N5 words marked learned in `user_vocabulary_progress`, plus words mastered through spaced repetition (`repetitions >= 3`).
- **Kanji:** published N5 characters whose `kanji_review_state.status` is `known`.
- **Reading and Kana:** average score across all graded attempts for the matching quiz category, with linked lesson progress as a fallback only when no graded attempts exist.
- **Lessons:** completed N5 lessons with a published graded checkpoint. Passing a linked quiz completes its lesson; a failed graded attempt records it as in progress. The mixed-script Kana assessment updates both Hiragana and Katakana lesson records.

The dashboard source correction is installed by `20261110110000_fix_my_progress_sources.sql`. The following migrations correct N5 quiz-to-lesson associations: `20261110120000_fix_grammar_quiz_lesson_link.sql` and `20261110130000_fix_n5_quiz_lesson_associations.sql`. Apply pending migrations with `npx supabase migration up --local`.

### Kana recognition challenge

Kana is script-based rather than JLPT-level-based. The workspace has three separate tracks:

- **Easy:** 33 basic Hiragana and Katakana questions.
- **Medium:** 33 questions covering dakuten, handakuten and combined kana.
- **Hard:** 33 questions covering look-alike characters, small kana, long vowels and modern loanword combinations.

Each attempt draws 20 shuffled questions from the selected 33-question bank. A reattempt draws the 13 questions outside the previous set plus 7 questions from that previous set, then shuffles them. Each question has a 45-second timer; unanswered questions advance automatically. The original Kana challenge migration is retained in history, and `20261110100000_kana_three_difficulty_banks.sql` upgrades it to the three-level bank while preserving the quiz history. Apply pending migrations locally with `npx supabase migration up --local`.
