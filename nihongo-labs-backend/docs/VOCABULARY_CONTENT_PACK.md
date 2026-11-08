# Nihongo Labs N5 / N4 vocabulary content pack

## Contents

- `012_vocabulary_n5_seed.sql`: 500 N5 entries.
- `013_vocabulary_n4_seed.sql`: 500 N4 entries.
- Total: 1,000 entries, split evenly by level. The N4 list is incremental; OpenJLPT assigns a word to the easiest listed level, so the same N5 headword is not normally repeated in N4.

Each row maps to the existing `public.vocabulary_entries` table: headword, kana reading, romaji, English meanings, part of speech, example sentence, example romaji (where a complete furigana reading is available), example translation, and topic/source tags.

## Import

1. Confirm the Nihongo Labs schema is already applied.
2. Run `nihongo-labs-backend/sql/012_vocabulary_n5_seed.sql`.
3. Run `nihongo-labs-backend/sql/013_vocabulary_n4_seed.sql`.
4. Review the rows in Supabase before changing their publication status to `published`.

New rows are inserted with `publication_status='review'`. The site's public vocabulary endpoint returns only published rows, so this seed does not automatically expose unreviewed content. Existing rows already marked `published` remain published on conflict.

## JLPT level caveat

The JLPT organisers do not publish current official N5–N1 vocabulary lists. These levels are community-standard approximations and should be treated as curriculum labels, not exam guarantees. Nihongo Labs should maintain an editorial review process for readings, glosses, level placement and sentence suitability.

## Data attribution and licence

This pack contains adapted vocabulary data from [OpenJLPT](https://github.com/evanclan/OpenJLPT), pinned to commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`, licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). OpenJLPT uses JMdict and KANJIDIC2 (EDRDG), Jonathan Waller's JLPT lists and Tatoeba. Example sentences are Tatoeba material licensed under CC BY 2.0 FR; their sentence IDs are retained as row tags (`source:tatoeba:<id>`). The complete derived dataset in these seed files is distributed under CC BY-SA 4.0; keep this attribution with the data when redistributing it.

Commercial use is allowed under CC BY-SA 4.0, but redistributed adapted vocabulary data must remain under the same share-alike licence. This may matter if Nihongo Labs intends to treat its entire vocabulary database as proprietary. This is a content/data licensing note, not legal advice.
