# Nihongo Labs — audit remediation phases

This document records the security, state-integrity, performance and operations goals that this remediation is intended to prove. It is a verification map, not a replacement for the application and database tests.

| Phase | Goal | Implementation | Verification |
| --- | --- | --- | --- |
| 1. Learner-state trust boundary | A browser must not be able to award itself correct answers, quiz attempts, mastery, scheduling intervals or lesson completion. | Authenticated DML is revoked for learner progress/graded tables. Sentence and Kanji write routes use the server-only Supabase client after user/content validation. Trusted quiz and review RPCs remain the write path. | `supabase/tests/security_integrity.test.sql`; `tests/audit-remediation.test.ts`; backend test suite. |
| 2. Billing event convergence | A delayed failure event must not downgrade captured/refunded payment, and an old subscription event must not reactivate a canceled/expired subscription. Unknown provider statuses must not map to active. | Ordered provider event RPC; terminal subscription guard; monotonic payment RPC; conditional failure writes; provider event handlers isolated in `billing-provider-events.ts`. | `tests/audit-remediation.test.ts`; webhook/payment tests; fresh database migration test. A live Razorpay sandbox replay is still required before production billing rollout. |
| 3. Abuse and request boundaries | Public contact submissions are throttled across application instances and untrusted request bodies are capped before full buffering. | HMAC-derived address bucket and atomic database rate limit; bounded streaming body reader used by JSON APIs and the Razorpay webhook. | `tests/contact-flow.test.ts`; `tests/http-body-limit.test.ts`; live ingress header verification before production. |
| 4. Admin integrity and confidentiality | Inbox changes and audit events cannot split; admin screens should not issue one Auth API call per row; signup must not reveal registered emails. | Atomic status-plus-audit RPC; batch auth email RPC; generic duplicate-signup and sign-in responses. | `tests/audit-remediation.test.ts`; database permission tests. |
| 5. Query and update efficiency | Settings updates should be all-or-nothing; vocabulary due selection and dashboard aggregation should run in SQL; different currencies must not be added together. | One settings RPC; indexed, RLS-respecting due-vocabulary RPC; bounded database aggregates; currency-grouped dashboard totals; batch email retrieval. | `tests/audit-remediation.test.ts`; `supabase/tests/security_integrity.test.sql`; Next.js CI build. |
| 6. Content and error correctness | A database/API failure must not masquerade as real N5 content or silently discard preference/progress errors. | Authenticated vocabulary, Kanji, grammar and flashcard loaders no longer substitute demo content after errors/empty results; bounded fetch timeouts; errors are logged and visible in relevant learning sections; Romaji preference writes roll back on failure. | `tests/audit-remediation.test.ts`; ESLint, TypeScript and build. |
| 7. Migration reproducibility | A fresh local database must install all required schema and trusted RPCs without copying mandatory scripts manually. | Flashcard prerequisite and backend RPC scripts are retained in the backend folder and copied into ordered root migrations. Local setup documentation is updated. | CI starts local Supabase, resets the database from zero, and runs database permission tests. |
| 8. Maintainable service boundaries | Provider event reconciliation should not be mixed into the general checkout/plan service. | Provider event handlers extracted into `billing-provider-events.ts`, with shared entitlement and invoice services exported from the billing module. | TypeScript, backend tests and production build. |

## Architecture decisions

- **Reading corpus:** `src/lib/nihongo/reading-content.ts` is the canonical curated N5/N4 passage corpus. Reading Studio and `/api/learning/content?kind=reading` now read the same structure; the database lesson-block traversal that previously returned a different passage shape was removed from the active API path. This preserves the token-level readings and translations used by the reader instead of replacing them with abbreviated lesson excerpts.
- **Feature boundaries:** Kanji Studio is now isolated in `src/components/nihongo/kanji-studio.tsx`; Razorpay provider-event reconciliation is isolated in `src/lib/nihongo/server/services/billing-provider-events.ts`. The existing learning shell and billing plan/checkout services remain intact.
- **Source SQL retention:** The original flashcard, backend RPC and N5 seed SQL scripts remain in their existing folders. Their ordered root migration copies are canonical for fresh installs and future `supabase migration up` runs.

## Release acceptance gates

- CI must complete a fresh Supabase database reset and pass the SQL permission tests.
- ESLint, backend tests, TypeScript and the production Next.js build must all pass on the PR head.
- Review the PR diff for unexpected content removal and confirm all original backend SQL reference files remain present.
- Before deploying billing changes, replay captured → failed, failed → captured, canceled → stale activated, and old updated → new canceled event sequences in a Razorpay test account.
- Verify the deployed reverse proxy overwrites or appends trusted client-IP headers; the contact throttle intentionally HMACs the edge-provided address and never stores raw IP addresses.

No merge to `main` is part of this remediation.
