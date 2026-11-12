# N5/N4 Grammar Curriculum — Local Development

This branch adds 100 N5 and 100 N4 grammar lessons. Each lesson includes its pattern, formation, explanation, an example with spaced romaji and an English meaning, common-mistake guidance, and four practice questions.

## Apply the migrations locally

Start the local Supabase stack, then from the repository root run:

```bash
npx supabase migration up --local
```

This applies the pending curriculum migrations to your local database. The migrations are:

- `20261112120000_n5_n4_grammar_curriculum.sql` — adds grammar metadata and practice history, then seeds N5.
- `20261112121000_n4_grammar_curriculum.sql` — seeds N4.

For a full local database rebuild (this resets local database data), use:

```bash
npx supabase db reset
```

Do not use `supabase db push` for this local workflow; no remote database is changed by these instructions.

## Run the checks locally

```bash
npm ci
npm run lint
npm run test:backend
npx tsc --noEmit
npm run build
```

The grammar curriculum contract test checks both level counts, unique patterns, example fields, and the four-question structure.

## Progress behaviour

- The existing `user_grammar_progress` record remains the source of truth for marking a lesson as understood.
- Each authenticated answer is graded by the server and written to `user_grammar_practice_attempts`.
- Row-level security restricts practice history to the current learner.
- The Progress page reports N5 and N4 lesson completion, question attempts, and answer accuracy separately.
