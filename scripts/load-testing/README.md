# Local authentication concurrency test

This harness provisions throwaway users on **local Supabase only**, ramps concurrent password-login attempts, and deletes only the users recorded in its local manifest.

It deliberately refuses non-loopback URLs. It does not target the hosted site or hosted Supabase.

## What it measures

Each virtual user:
1. Requests the Next.js /login page once.
2. Performs one password-grant login directly against local Supabase Auth.
3. Records page and Auth latency, success rate, and HTTP 429 throttling.

The Auth request uses Supabase's password-token endpoint. This isolates Auth capacity and the page's server/render path; it does **not** exercise the React Server Action, its cookie serialization, or the authenticated dashboard after sign-in. Those need a separate browser-level end-to-end test.

The default run ramps through 50, 200, 500 and 1,000 concurrent virtual users, holds the peak briefly, then ramps down. Each VU receives its own confirmed test account.

## Prerequisites

- Local Supabase running with supabase start.
- The app configured to use local Supabase.
- A production build of the app running locally (npm run build, then npm run start).
- Grafana k6 installed: https://grafana.com/docs/k6/latest/set-up/install-k6/
- Enough RAM/CPU allocated to Docker and the k6 process.

Get the local URL and keys with:

    supabase status

Use the local API URL, publishable key, and service-role/secret key from that output. Keep the service-role/secret key server-side; never use a NEXT_PUBLIC_ variable for it.

## Prepare the isolated local Auth rate limit

The checked-in supabase/config.toml currently sets [auth.rate_limit].sign_in_sign_ups = 30. Supabase applies this quota per source IP, so a single local k6 runner would hit 429 responses before it meaningfully tests 1,000 simultaneous password logins.

For this test only, temporarily change that value in your **local** supabase/config.toml to 1200, then restart the local stack:

    supabase stop
    supabase start

Do not push this temporary rate-limit change to hosted Supabase. Restore the value to 30 after testing and restart the local stack again.

## Run the test

Open terminal 1 in the repository:

    export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='YOUR_LOCAL_PUBLISHABLE_KEY'
    export SUPABASE_SERVICE_ROLE_KEY='YOUR_LOCAL_SERVICE_ROLE_KEY'
    export SUPABASE_URL=http://127.0.0.1:54321

    node scripts/load-testing/provision-users.mjs
    npm run build
    npm run start

Open terminal 2:

    export BASE_URL=http://127.0.0.1:3000
    export SUPABASE_URL=http://127.0.0.1:54321
    export SUPABASE_PUBLISHABLE_KEY='YOUR_LOCAL_PUBLISHABLE_KEY'

    k6 run scripts/load-testing/login-burst.js

To use a smaller ramp first:

    TARGET_VUS=50 k6 run scripts/load-testing/login-burst.js
    TARGET_VUS=200 k6 run scripts/load-testing/login-burst.js
    TARGET_VUS=500 k6 run scripts/load-testing/login-burst.js
    TARGET_VUS=1000 k6 run scripts/load-testing/login-burst.js

TARGET_VUS cannot exceed the number of provisioned users. Increase LOAD_TEST_USER_COUNT before provisioning if you want to test more than 1,000 users.

## Cleanup

After collecting the k6 summary, delete the generated accounts:

    SUPABASE_URL=http://127.0.0.1:54321 \
    SUPABASE_SERVICE_ROLE_KEY='YOUR_LOCAL_SERVICE_ROLE_KEY' \
    node scripts/load-testing/cleanup-users.mjs

The cleanup script reads the manifest of IDs created by the provisioning script. It refuses non-local Supabase URLs and does not delete any account outside that manifest.

Finally restore the normal local Auth limit and restart Supabase.

## Reading the results

Pay attention to:
- auth_login_success: successful password-login rate.
- auth_login_duration: p50, p95 and p99 latency.
- auth_login_429: rate-limit responses.
- login_page_success and the login_page request timings: Next.js login page availability.

A run that fails the 99% success threshold with 429s is testing the Auth rate limit, not raw Auth capacity. A run with slow or failed login-page requests points toward the local Next.js host. Run staged increases (50 -> 200 -> 500 -> 1,000) and record the point where latency or errors rise sharply.

## Production warning

Do not use this local harness against production. Supabase recommends load testing on staging and documents per-IP Auth quotas. Vercel's published load-testing policy says load testing is permitted only on Enterprise plans; coordinate with Vercel before any permitted hosted load test. A hosted test also needs dedicated test accounts, a planned window, monitoring, and agreement on acceptable impact.
