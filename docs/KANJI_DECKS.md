# Nihongo Labs Kanji Decks

## Decks

- N5: the complete 99-character list supplied by the product owner.
- N4: the complete 204-character list supplied by the product owner, with English glosses, readings, example vocabulary and stroke metadata.
- The N5 and N4 readings and example vocabulary have been reviewed by a Japanese editor, as confirmed by the product owner.
- The JLPT does not publish a fixed official kanji inventory per level. These are Nihongo Labs curriculum groupings; the deck membership follows the product owner's requested lists.

## Apply the migration

Run `supabase/migrations/20261107010000_kanji_n5_n4_decks.sql` against the project database.

## Routes

- `GET /api/learning/content?kind=kanji&level=N5|N4&limit=250`
- `GET /api/kanji/progress?level=N5|N4` (authenticated)
- `POST /api/kanji/review` with `{ "kanjiId": "<uuid>", "status": "known" | "learning" }` (authenticated)

## UI

The learning workspace kanji area has N5/N4 tabs, search, selectable cards and a flipped detail panel. Meaning/reading typography has been increased to improve legibility. Familiarity controls are enabled when signed in.
