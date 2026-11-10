# Nihongo Labs admin dashboard

The admin console lives at `/admin` and reuses the existing Supabase Auth session. It does not use a separate administrator password or a second authentication system.

## Local access

1. Start the existing Next.js app with `npm run dev`.
2. Start the existing local Supabase stack and confirm `.env.local` has the local Supabase URL, publishable key and server-only `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`).
3. Create and verify your normal Nihongo Labs account through `http://localhost:3000/login`.
4. Promote only your account to `super_admin` in the **local** Supabase SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin'::public.app_role
from auth.users
where lower(email) = lower('YOUR_LOGIN_EMAIL')
on conflict (user_id, role) do nothing;
```

5. Open `http://localhost:3000/admin`. The middleware-free server layout verifies the Auth user and reads `user_roles` before rendering the console. A normal learner is redirected to the learning workspace; an unauthenticated visitor is redirected to login.

The local role assignment affects only the local Supabase project. Repeat it deliberately in production after deployment; local and production roles are not shared.

## Current connected sections

- **Overview:** registered profiles, new profiles this month, distinct active learners with recorded activity in the last seven days, active/trial subscriptions, current-month gross collections/refunds/net collections, open contact messages and support tickets.
- **Learners:** paginated Auth user records enriched with profile, role and latest subscription details. Search currently scans the first 1,000 Auth users; the UI explicitly labels that limit.
- **Payments:** latest 100 payment ledger rows, including provider, amount, captured/refunded totals, payment state and account email.
- **Inbox:** recent contact messages and support tickets. Contact items can be marked read or closed; changes are written to the audit log.
- **Learning analytics:** persisted active learners, study minutes, lesson completions and quiz completions for the last seven days, plus content inventory counts.

Metrics are read from the existing `profiles`, `user_daily_activity`, `subscriptions`, `payments`, `contact_messages`, `support_tickets`, and learning-content tables. Empty databases display zero counts and empty states; sample revenue or learner activity is not fabricated.

## Security boundaries

- The browser never receives the Supabase service-role key.
- Admin pages and APIs verify the authenticated user against `public.user_roles` on the server.
- Only `super_admin` and `admin` may access the business dashboard and payment/user APIs. Support-message updates additionally support the `support_agent` role at the API boundary.
- Inbox mutations verify same-origin requests and append an `audit_logs` record.
- Private admin API responses use `Cache-Control: private, no-store`.
- Existing RLS remains in place for learner-facing access. The service-role client is confined to server routes.
- This first admin slice is read-oriented for learner, payment and analytics data. It intentionally does not expose destructive account deletion, role editing, direct entitlement mutation or arbitrary refunds from the dashboard.

## Database migration

Apply the additive dashboard indexes using the normal Supabase migration workflow:

```bash
npx supabase migration up --local
```

The migration only adds indexes with `if not exists`; it does not create a second set of business tables or rewrite existing migration history.

## Current scope and next extensions

The dashboard provides connected visibility and a narrow inbox workflow. Content editing/publishing, plan and coupon editing, staff-role management, refund initiation UI, export/reporting and two-factor authentication policy remain separate follow-up work. Existing protected billing refund and plan-synchronization APIs are not surfaced as buttons until their confirmation and audit UX is designed.
