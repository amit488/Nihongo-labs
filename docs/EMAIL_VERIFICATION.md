# Email verification

Nihongo Labs uses Supabase Auth's built-in email confirmation. A signup creates a pending Auth user; Supabase sends the confirmation email, and the user cannot sign in until the address is verified. No separate email-token table or custom verification service is required.

## Local development

1. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`.
2. Ensure the local Supabase stack is running and its URL/publishable key match `npx supabase status`.
3. Restart the local Supabase stack after changing `supabase/config.toml` so the `enable_confirmations = true` and confirmation template settings are loaded:
   ```bash
   npx supabase stop
   npx supabase start
   ```
4. Start Nihongo Labs with `npm run dev`, then register at `http://localhost:3000/signup`.
5. Open the local email inbox at `http://127.0.0.1:54324` (Mailpit / local SMTP web UI), open the message titled **Confirm your Nihongo Labs account**, and click **Verify my email**.
6. The link returns through `/auth/callback`, exchanges the PKCE code for a session, and redirects the verified user to `/learn`.

Local Supabase captures email in Mailpit; it does not deliver messages to the public internet.

## Troubleshooting a duplicate-email signup

Supabase Auth stores accounts in its own `auth.users` table, separately from application profile tables in `public`. An account can therefore exist in Auth even when you cannot find it in a public profile table.

If you tested signup while email confirmation was disabled, Supabase may have created and auto-confirmed the account without sending an email. Turning confirmation on later does not undo that earlier account. For a local test account, inspect **Authentication → Users** in local Supabase Studio and delete only the test user you intend to recreate, then retry with confirmation enabled. Do not delete production users or run a database reset for this.

With confirmation enabled, Supabase may return an intentionally obfuscated user response for an email that is already registered. No second account is created and no new confirmation message is sent; the app now identifies that response and directs the person to sign in rather than claiming an email was sent.

Before testing, also check that `.env.local` points to the local Auth API (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`). Mailpit at `http://127.0.0.1:54324` only shows messages sent by that local stack. If the app points to a hosted Supabase URL, local `config.toml` and Mailpit do not apply.

## Hosted / production Supabase

The local `config.toml` and HTML template configure the local CLI stack only. For the hosted Supabase project:

1. In **Authentication → Sign In / Providers → Email**, enable **Confirm email**.
2. Set the Auth **Site URL** to the deployed Nihongo Labs origin and add the exact callback URL (for example, `https://your-domain.example/auth/callback`) to the allowed redirect URLs. Also add the appropriate Vercel preview callback patterns if preview deployments need to verify email.
3. Configure a production SMTP provider in **Authentication → SMTP Settings**. Supabase's built-in email sender is restricted and rate-limited; it is not suitable for general production signup traffic.
4. In **Authentication → Email Templates → Confirm signup**, paste the HTML from `supabase/templates/confirmation.html`. Keep the `{{ .ConfirmationURL }}` variable intact so Supabase can generate the secure, single-use verification link and honor the redirect URL supplied by the application.
5. Set `NEXT_PUBLIC_SITE_URL` in the deployed app to the same deployed origin.

Do not put SMTP credentials or Supabase secret/service-role keys in browser-visible environment variables.

## User experience

- Signup displays a Nihongo Labs-styled inbox confirmation screen.
- Users can request another signup confirmation email from that screen.
- Unverified users receive a clear message if they try to sign in.
- The callback only redirects to a safe same-site path; failed verification returns the user to the login page.
