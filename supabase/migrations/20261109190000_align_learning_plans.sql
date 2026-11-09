-- Align paid learning plan catalog with the three plans displayed on the public pricing page.
-- All paid plans provide the same features; only the billing period and total price differ.
begin;

insert into public.subscription_plans
  (code, name, description, plan_kind, amount_minor, currency, billing_interval, interval_count, is_active, display_order)
values
  ('monthly', 'Monthly', 'Full NihongoLabs learning access, billed monthly.', 'paid', 14900, 'INR', 'month', 1, true, 1),
  ('half_year', '6 Months', 'Full NihongoLabs learning access, billed once every six months.', 'paid', 80900, 'INR', 'month', 6, true, 2),
  ('annual', 'Annual', 'Full NihongoLabs learning access, billed annually.', 'paid', 159900, 'INR', 'year', 1, true, 3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  plan_kind = excluded.plan_kind,
  amount_minor = excluded.amount_minor,
  currency = excluded.currency,
  billing_interval = excluded.billing_interval,
  interval_count = excluded.interval_count,
  is_active = true,
  display_order = excluded.display_order,
  updated_at = now();

insert into public.plan_features (plan_id, feature_key, feature_value)
select p.id, feature.feature_key, 'true'::jsonb
from public.subscription_plans p
cross join (values
  ('full_grammar'),
  ('vocabulary_revision'),
  ('kanji_revision'),
  ('daily_progress'),
  ('flashcards'),
  ('reading'),
  ('mock_exams'),
  ('premium_content')
) as feature(feature_key)
where p.code in ('monthly', 'half_year', 'annual')
on conflict (plan_id, feature_key) do update
set feature_value = excluded.feature_value;

commit;
