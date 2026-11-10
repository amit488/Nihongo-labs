-- Admin dashboard query support. Safe for existing local and production databases.
create index if not exists profiles_created_at_admin_idx
  on public.profiles (created_at desc);

create index if not exists payments_created_at_admin_idx
  on public.payments (created_at desc);

create index if not exists payments_captured_at_admin_idx
  on public.payments (captured_at desc)
  where captured_at is not null;

create index if not exists subscriptions_created_at_admin_idx
  on public.subscriptions (created_at desc);

create index if not exists user_daily_activity_date_admin_idx
  on public.user_daily_activity (activity_date desc, user_id);

create index if not exists support_tickets_created_at_admin_idx
  on public.support_tickets (created_at desc);

create index if not exists contact_messages_created_at_admin_idx
  on public.contact_messages (created_at desc);
