-- Nihongo Labs — curated starter tags for flashcard organisation
-- Run after sql/008_flashcards.sql. Safe to run more than once.

begin;

insert into public.flashcard_tags (slug, name, tag_category, description, is_active)
values
  ('n5', 'JLPT N5', 'jlpt', 'Beginner JLPT N5 material.', true),
  ('n4', 'JLPT N4', 'jlpt', 'Elementary JLPT N4 material.', true),
  ('n3', 'JLPT N3', 'jlpt', 'Intermediate JLPT N3 material.', true),
  ('n2', 'JLPT N2', 'jlpt', 'Upper-intermediate JLPT N2 material.', true),
  ('n1', 'JLPT N1', 'jlpt', 'Advanced JLPT N1 material.', true),
  ('vocabulary', 'Vocabulary', 'topic', 'Words, readings and meanings.', true),
  ('kanji', 'Kanji', 'topic', 'Kanji readings, meanings and usage.', true),
  ('grammar', 'Grammar', 'topic', 'Grammar structures and usage.', true),
  ('verbs', 'Verbs', 'part_of_speech', 'Japanese verbs and conjugation.', true),
  ('adjectives', 'Adjectives', 'part_of_speech', 'Japanese i-adjectives and na-adjectives.', true),
  ('particles', 'Particles', 'topic', 'Japanese particles and sentence patterns.', true),
  ('daily-life', 'Daily life', 'topic', 'Everyday Japanese expressions.', true),
  ('travel', 'Travel', 'topic', 'Japanese for travel and transport.', true),
  ('food', 'Food', 'topic', 'Food, meals and ordering.', true),
  ('time-and-dates', 'Time and dates', 'topic', 'Numbers, dates, days and time expressions.', true),
  ('listening', 'Listening', 'skill', 'Listening and audio recognition practice.', true),
  ('reading', 'Reading', 'skill', 'Reading and recognition practice.', true)
on conflict (slug) do update set
  name = excluded.name,
  tag_category = excluded.tag_category,
  description = excluded.description,
  is_active = excluded.is_active;

commit;
