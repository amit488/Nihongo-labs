-- Nihongo Labs — safe starter data
-- Paid prices and provider IDs are intentionally not pre-filled; set them only after choosing pricing/provider.

begin;

insert into public.subscription_plans
  (code, name, description, plan_kind, amount_minor, currency, billing_interval, is_active, display_order)
values
  ('free', 'Free', 'Free access to published free lessons and practice material.', 'free', 0, 'INR', 'lifetime', true, 0)
on conflict (code) do nothing;

insert into public.plan_features (plan_id, feature_key, feature_value)
select p.id, v.feature_key, v.feature_value
from public.subscription_plans p
cross join (values
  ('free_lessons', 'true'::jsonb),
  ('premium_content', 'false'::jsonb),
  ('progress_tracking', 'true'::jsonb),
  ('basic_quizzes', 'true'::jsonb)
) as v(feature_key, feature_value)
where p.code = 'free'
on conflict (plan_id, feature_key) do nothing;

insert into public.site_settings (key, value, is_public, description)
values
  ('site_name', '"Nihongo Labs"'::jsonb, true, 'Public website name'),
  ('default_currency', '"INR"'::jsonb, true, 'Default currency for displayed prices'),
  ('default_jlpt_level', '"N5"'::jsonb, true, 'Default learner level'),
  ('maintenance_mode', 'false'::jsonb, true, 'When true, the frontend should show a maintenance page')
on conflict (key) do nothing;

insert into public.feature_flags (key, is_enabled, is_public, description)
values
  ('spaced_repetition', true, true, 'Enable vocabulary review scheduling'),
  ('flashcards', true, true, 'Enable the flashcard deck and review experience'),
  ('personal_flashcard_decks', true, true, 'Allow learners to create private flashcard decks'),
  ('fsrs_scheduler', false, false, 'Enable after the trusted FSRS review worker is deployed'),
  ('leaderboards', false, false, 'Enable learner leaderboards'),
  ('community', false, false, 'Enable learner community features')
on conflict (key) do nothing;

insert into public.badges (code, title, description, criteria)
values
  ('first_lesson', 'First Steps', 'Complete your first lesson.', '{"event":"lesson_completed","count":1}'::jsonb),
  ('first_quiz', 'Quiz Starter', 'Complete your first quiz.', '{"event":"quiz_graded","count":1}'::jsonb),
  ('seven_day_streak', 'One Week Streak', 'Study on seven consecutive days.', '{"event":"daily_streak","days":7}'::jsonb)
on conflict (code) do nothing;

commit;
