# Nihongo Labs backend route reference

All JSON mutations are same-origin protected and authenticated unless marked Public or Webhook. The Supabase service key remains server-only. The `private` schema must stay out of the Data API exposed schemas.

## Authentication and public content

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Readiness response |
| `GET` | `/api/learning/content?kind=grammar&level=N5` | Public/RLS | Published grammar, vocabulary, kanji, kana, course, reading or official flashcard content |
| `GET` | `/api/practice/quizzes?kind=practice\|mock\|reading\|kana` | Public/RLS | Published quiz catalogue and counts |
| Server Action | `signUpAction` | Public | Supabase Auth signup + email confirmation redirect |
| Server Action | `signInAction` | Public | Supabase Auth password login |
| Server Action | `signOutAction` | Authenticated | Sign out |

## Learner workspace

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/learning/dashboard` | Personal dashboard, mastery, streak, due reviews and recent attempts |
| `GET/PATCH` | `/api/learning/settings` | Read/update profile, timezone, Romaji and furigana preferences |
| `POST` | `/api/learning/progress` | Save lesson progress and completion atomically |
| `GET/POST/DELETE` | `/api/learning/bookmarks` | Learner-owned bookmarks |
| `GET` | `/api/learning/vocabulary-due` | Due and new vocabulary queue |
| `GET/POST/DELETE` | `/api/learning/grammar-progress` | Learner-owned grammar points marked as understood |
| `POST` | `/api/learning/vocabulary-review` | SM-2 vocabulary review and daily counter update |
| `GET` | `/api/learning/grammar-intelligence` | Learner's grammar error patterns and weak concepts |
| `GET` | `/api/learning/vocabulary-intelligence?level=N5` | Vocabulary SM-2 risk, due queue and mastery insights |

## Practice and examinations

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/practice/start` | Reserve a quiz attempt, enforce access/attempt limits and return questions without answer keys |
| `POST` | `/api/practice/submit` | Grade responses server-side, return detailed answer feedback and finalize attempt atomically |
| `GET` | `/api/practice/attempts` | Learner's attempt history |

Example start request:

```json
{ "quizId": "<published-quiz-uuid>" }
```

Example submit request:

```json
{
  "attemptId": "<attempt-uuid>",
  "responses": [
    { "questionId": "<question-uuid>", "response": "B" },
    { "questionId": "<another-question-uuid>", "response": "です" }
  ]
}
```

The backend grades against `private.quiz_answer_keys` through `public.get_quiz_answer_keys`, a service-role-only RPC. Never return this table or the grading RPC to browser code.

## Flashcards and revision

| Method | Route | Purpose |
|---|---|---|
| `POST/PATCH` | `/api/flashcards/session` | Start or finish a learner-owned session |
| `GET` | `/api/flashcards/due?deckId=<uuid>&mode=mixed` | Due/new card queue with daily quotas |
| `POST` | `/api/flashcards/review` | FSRS review (`again`, `hard`, `good`, `easy`), atomic state/session/activity persistence |

Example review request:

```json
{
  "flashcardId": "<flashcard-uuid>",
  "sessionId": "<session-uuid>",
  "rating": "good",
  "responseTimeMs": 4200
}
```

The backend calculates FSRS state and enforces daily new/review limits in the database. Learners cannot submit their own due dates or scheduling state.

## Billing and payment operations

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/billing/plans` | Public | Active plan catalogue |
| `POST` | `/api/billing/checkout` | Learner | Start a Razorpay recurring subscription or one-time order |
| `POST` | `/api/billing/verify` | Learner | Verify checkout signature and fetch provider payment before activating one-time purchase |
| `GET` | `/api/billing/status` | Learner | Subscription and entitlements |
| `POST` | `/api/billing/cancel` | Learner | Cancel recurring renewal at provider |
| `GET` | `/api/billing/history` | Learner | Payment and order history |
| `GET` | `/api/billing/invoices` | Learner | Stored invoice records |
| `GET/PATCH` | `/api/billing/profile` | Learner | Billing contact/address data |
| `POST` | `/api/billing/webhook` | Razorpay signature | Capture, failure, subscription and refund event reconciliation |
| `POST` | `/api/admin/billing/sync-plan` | Admin / super-admin | Create and link a Razorpay recurring Plan to a local plan |
| `POST` | `/api/admin/billing/refund` | Admin / super-admin | Initiate a partial/full Razorpay refund with a stable idempotency key |

Example admin refund request (amounts are INR paise):

```json
{
  "paymentId": "<local-payment-uuid>",
  "amountMinor": 14900,
  "idempotencyKey": "refund-test-001",
  "reason": "Customer request"
}
```

For an ambiguous refund request, retry the exact same amount/reason with the same key. A genuinely new refund uses a new key. Razorpay webhook events are verified against the unmodified raw request body before processing.

## Trusted SQL helpers

`sql/011_backend_rpc.sql` contains service-role-only helper functions for quiz answer key retrieval, attempt reservation/finalization, daily activity counters, lesson progress, flashcard FSRS writes, vocabulary scheduling and refund ledger reconciliation. It also adds supporting indexes. Review this file before applying it to the existing local database; it is not executed by the source apply script.
