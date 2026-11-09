# NihongoLabs AI Japanese Sensei and learning intelligence

## AI provider setup

The Sensei feature calls the OpenAI Responses API from a server-only Next.js route. It does not call the model from the browser and does not store chat transcripts in the NihongoLabs database.

Add these environment variables to local `.env.local` and your Vercel project environment:

```bash
OPENAI_API_KEY=your_server_side_api_key
OPENAI_SENSEI_MODEL=gpt-6-luna
```

- Create an API key in an OpenAI API project with API billing enabled and access to the selected model.
- ChatGPT Plus/Go/Pro subscriptions do not provide API credits; API usage is billed separately through the API platform.
- Never name the key `NEXT_PUBLIC_*`, commit it, or paste it into browser code.
- Restart the local Next.js server after changing `.env.local`.
- In Vercel, add the variables to the correct environments (Preview/Production) and redeploy.
- The model name is configurable through `OPENAI_SENSEI_MODEL`; choose a model available to your API project. The default is GPT-6 Luna because it is priced for high-volume focused tasks; GPT-6.1 Sol or GPT-6 Astra can be selected later if evaluations show a meaningful teaching-quality improvement.

The route uses `store: false`, validates a strict JSON response, limits user messages to 1,500 characters, and enforces a daily quota (8 messages for free accounts, 50 for accounts with an active premium-content entitlement). Failed provider calls still consume a reserved request; this avoids a burst of repeated calls during upstream failures.

## What Sensei returns

Each answer is structured into:
- A direct explanation at the selected JLPT level.
- Grammar pattern, formation and usage.
- Natural Japanese examples with romaji and translations.
- Common confusion and how to distinguish it.
- Key vocabulary.
- A mini quiz with an answer and explanation.
- A suggested follow-up.

The model receives a compact learner context for personalisation: recent grammar mistake tags plus up to eight due or at-risk vocabulary items with their saved reading, meaning, part of speech and example. This context is read from the learner's own rows through RLS. The current chat history stays in the page's client memory and is not written to Supabase.

## Grammar mistake intelligence

Add `learning_tags` to quiz questions using stable labels, for example:

- `particle:wa-vs-ga`
- `particle:ni-vs-de`
- `particle:wo`
- `particle:no`
- `verb:te-form`
- `verb:past`
- `verb:negative`
- `adjective:conjugation`

The server records these tags against the learner's graded responses. If a graded quiz's title or slug indicates grammar but its questions have no tags, the system records the broader `grammar:general` category. Add specific tags to your question seeds/content editor to unlock precise mistake patterns.

## Adaptive revision already in NihongoLabs

NihongoLabs already has several complementary revision systems:
- Vocabulary: SM-2 due queue and quality ratings.
- Flashcards: FSRS-6 scheduling, daily new/review caps and review history.
- Quick Revision: weighted recall selection across learned vocabulary, known kanji and understood grammar, with per-item accuracy and retry scheduling.

The learning-intelligence dashboard brings weakness information together; it does not replace these schedulers with a second competing algorithm.

## Database migration

Apply `supabase/migrations/20261109143000_learning_intelligence.sql` through your normal Supabase migration workflow before using the new analytics and AI routes. Review the SQL and verify it against your local migration history first. Do not rerun the base schema on an already initialized database.
