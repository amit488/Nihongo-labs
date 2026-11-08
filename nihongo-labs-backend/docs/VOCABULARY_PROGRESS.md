# Vocabulary learning progress

The vocabulary screen loads published words in small pages instead of downloading the whole level:

- The first request returns 80 words for the selected JLPT level (N5 or N4).
- The next page is requested when the learner scrolls close to the end; a manual **Load 80 more words** control is also available.
- The screen filters out words the signed-in learner has marked as learned. When previously learned words occur in the next database page, the loader continues until it finds enough unseen words or reaches the end of the level.
- **Mark learned** stores a per-user record. It is separate from the existing Again / Good / Easy spaced-repetition ratings.
- The **Learned** tab shows the word, kana, optional romaji, and short meaning. **Move back** removes the learned mark and returns the word to the new-word queue.

## Database setup

Apply `supabase/migrations/20261109090000_vocabulary_known_words.sql` after the initial Nihongo Labs schema migration. It creates `public.user_vocabulary_progress`, enables RLS, grants only the required permissions to authenticated users, and scopes all row access to `auth.uid()`.

Do not expose service-role credentials in the browser. The API routes use the signed-in Supabase session and the database policies enforce ownership.

## Publishing the vocabulary pack

The N5 and N4 vocabulary seed files intentionally insert words with `publication_status = 'review'`. Those rows will not appear in the learner screen until a content editor reviews and publishes them. This keeps unreviewed vocabulary out of the learning queue.

For the current pack there are 500 entries per level, so the learned-word view is capped at 500 rows per level. The API and UI page the active/new-word list separately, at 80 rows per request.
