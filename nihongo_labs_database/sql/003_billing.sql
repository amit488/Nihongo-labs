-- Nihongo Labs — plans, subscriptions, orders, payments, invoices and entitlements
-- Store money as integer minor units: INR 149.00 is 14900 paise.
-- Ledger records retain their history if an Auth account is deleted; user_id is set null.

begin;

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  plan_kind text not null default 'paid' check (plan_kind in ('free', 'paid')),
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  billing_interval public.billing_interval not null default 'month',
  interval_count integer not null default 1 check (interval_count > 0),
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  provider_product_id text,
  provider_price_id text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan_kind = 'free' and amount_minor = 0) or plan_kind = 'paid')
);

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  feature_key text not null,
  feature_value jsonb not null default 'true'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

create table public.billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  billing_name text,
  billing_email text,
  phone text,
  country_code char(2) not null default 'IN',
  address jsonb not null default '{}'::jsonb,
  tax_id text,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  provider public.payment_provider not null,
  provider_customer_id text,
  provider_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create unique index subscriptions_provider_id_uidx
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index subscriptions_user_status_idx on public.subscriptions(user_id, status, created_at desc);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  provider public.payment_provider not null,
  provider_order_id text,
  idempotency_key text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  status public.order_status not null default 'created',
  coupon_code text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_orders_provider_id_uidx
  on public.payment_orders(provider, provider_order_id)
  where provider_order_id is not null;
create unique index payment_orders_idempotency_uidx
  on public.payment_orders(user_id, idempotency_key)
  where idempotency_key is not null;
create index payment_orders_user_idx on public.payment_orders(user_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.payment_orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider public.payment_provider not null,
  provider_payment_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  refunded_amount_minor bigint not null default 0 check (refunded_amount_minor >= 0 and refunded_amount_minor <= amount_minor),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  status public.payment_status not null default 'created',
  payment_method text,
  captured_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payments_provider_id_uidx
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create index payments_user_idx on public.payments(user_id, created_at desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  invoice_number text not null unique,
  status public.invoice_status not null default 'issued',
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  line_items jsonb not null default '[]'::jsonb,
  billing_snapshot jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index invoices_user_idx on public.invoices(user_id, issued_at desc);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider_refund_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index refunds_provider_id_uidx
  on public.payment_refunds(provider_refund_id)
  where provider_refund_id is not null;

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  currency char(3) not null default 'INR' check (currency = upper(currency)),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_redemptions_per_user integer not null default 1 check (max_redemptions_per_user > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  applicable_plan_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.payment_orders(id) on delete set null,
  discount_minor bigint not null check (discount_minor >= 0),
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index coupon_redemptions_user_idx on public.coupon_redemptions(user_id, redeemed_at desc);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  status public.webhook_event_status not null default 'received',
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  retry_count integer not null default 0 check (retry_count >= 0),
  unique (provider, provider_event_id)
);

create index webhook_events_status_idx on public.payment_webhook_events(status, received_at);

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  source_subscription_id uuid references public.subscriptions(id) on delete set null,
  source_payment_id uuid references public.payments(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index user_entitlements_active_idx
  on public.user_entitlements(user_id, feature_key, starts_at, ends_at)
  where status = 'active';

commit;
