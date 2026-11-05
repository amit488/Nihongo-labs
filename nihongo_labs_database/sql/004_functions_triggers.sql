-- Nihongo Labs — internal authorization helpers and Auth/profile automation
-- Privileged helper functions stay in the non-exposed private schema.

begin;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.has_any_role(_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = (select auth.uid())
      and ur.role = any (_roles)
  );
$$;

create or replace function private.has_entitlement(_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_entitlements as ue
    where ue.user_id = (select auth.uid())
      and ue.feature_key = _feature_key
      and ue.status = 'active'
      and ue.starts_at <= now()
      and (ue.ends_at is null or ue.ends_at > now())
  );
$$;

create or replace function private.can_access_content(_access public.content_access)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _access = 'free'::public.content_access then true
    when _access = 'premium'::public.content_access then private.has_entitlement('premium_content')
    else false
  end;
$$;

-- Supabase Auth invokes this function after inserting auth.users.
-- Do not use user-editable metadata for roles or access privileges.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 80), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 80), ''),
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''),
    'Learner'
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Only the Auth service needs permission to invoke the signup trigger function.
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Keep updated_at consistent for mutable application tables.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'user_preferences', 'courses', 'course_units', 'lessons',
    'lesson_content_blocks', 'vocabulary_entries', 'kanji_entries',
    'grammar_points', 'cms_pages', 'announcements', 'site_settings',
    'feature_flags', 'support_tickets', 'subscription_plans', 'billing_profiles',
    'subscriptions', 'payment_orders', 'payments', 'lesson_progress',
    'user_daily_activity', 'vocabulary_review_state', 'quizzes', 'quiz_questions'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', v_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      v_table
    );
  end loop;
end;
$$;

-- Only these helpers are callable by client roles; all authorization data remains private.
grant usage on schema private to anon, authenticated;
revoke all on function private.has_any_role(public.app_role[]) from public;
revoke all on function private.has_entitlement(text) from public;
revoke all on function private.can_access_content(public.content_access) from public;
grant execute on function private.has_any_role(public.app_role[]) to anon, authenticated;
grant execute on function private.can_access_content(public.content_access) to anon, authenticated;

commit;
