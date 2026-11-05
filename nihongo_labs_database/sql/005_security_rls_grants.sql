-- Nihongo Labs — Row Level Security and explicit Data API grants
-- Safe default: tables are inaccessible unless a matching grant AND policy both allow the operation.

begin;

-- RLS is enabled on every table currently in the exposed public schema.
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

alter table private.quiz_answer_keys enable row level security;

-- Start from a deny-by-default grant baseline on a clean project. Existing PUBLIC grants are also removed.
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;

-- Schema privileges. The private schema must not be added to the Data API's exposed schemas.
grant usage on schema public to anon, authenticated;
grant usage on schema private to anon, authenticated, service_role, supabase_auth_admin;

-- Public catalog/content: readable by guests only through publication and content policies.
grant select on
  public.courses, public.course_units, public.lessons, public.lesson_content_blocks,
  public.content_assets, public.vocabulary_entries, public.kanji_entries,
  public.grammar_points, public.lesson_vocabulary, public.lesson_kanji,
  public.lesson_grammar, public.quizzes, public.quiz_questions, public.quiz_options,
  public.cms_pages, public.announcements, public.site_settings, public.feature_flags,
  public.subscription_plans, public.plan_features, public.badges
  to anon, authenticated;

grant insert, update, delete on
  public.courses, public.course_units, public.lessons, public.lesson_content_blocks,
  public.content_assets, public.vocabulary_entries, public.kanji_entries,
  public.grammar_points, public.lesson_vocabulary, public.lesson_kanji,
  public.lesson_grammar, public.quizzes, public.quiz_questions, public.quiz_options,
  public.cms_pages, public.announcements, public.site_settings, public.feature_flags,
  public.badges
  to authenticated;

grant select on public.profiles, public.user_roles, public.user_preferences, public.user_consents to authenticated;
grant update (display_name, username, avatar_path, timezone, locale, bio)
  on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant insert (user_id, consent_type, document_version, granted, source, metadata)
  on public.user_consents to authenticated;

-- Learner-owned progress and study data.
grant select on public.course_enrollments to authenticated;
grant insert (user_id, course_id) on public.course_enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select on public.user_daily_activity to authenticated;
grant select, insert, delete on public.user_bookmarks to authenticated;
grant select, insert, update on public.vocabulary_review_state to authenticated;
grant select on public.user_badges to authenticated;

grant select on public.quiz_attempts to authenticated;
grant insert (user_id, quiz_id) on public.quiz_attempts to authenticated;
grant select on public.quiz_responses to authenticated;
grant insert (attempt_id, user_id, question_id, response) on public.quiz_responses to authenticated;

-- Billing information is readable by the account owner; writes are server-side except billing profile details.
grant select on public.billing_profiles to authenticated;
grant insert (user_id, billing_name, billing_email, phone, country_code, address, tax_id)
  on public.billing_profiles to authenticated;
grant update (billing_name, billing_email, phone, country_code, address, tax_id)
  on public.billing_profiles to authenticated;
grant select on
  public.subscriptions, public.payment_orders, public.payments, public.invoices,
  public.payment_refunds, public.coupon_redemptions, public.user_entitlements
  to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;

-- Support and account communication.
grant select on public.support_tickets to authenticated;
grant insert (user_id, subject, category, requester_email) on public.support_tickets to authenticated;
grant update (status, priority, assigned_to, resolved_at) on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;
grant insert (ticket_id, author_id, sender_type, message, attachment_paths, is_internal_note)
  on public.support_ticket_messages to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.feedback to authenticated;
grant insert (user_id, category, rating, message, page_url) on public.feedback to authenticated;

-- Guest forms: insert-only. Contact/newsletter records are not publicly readable.
grant insert (user_id, name, email, subject, message) on public.contact_messages to authenticated;
grant insert (name, email, subject, message) on public.contact_messages to anon;
grant insert (email, user_id, source) on public.newsletter_subscribers to authenticated;
grant insert (email, source) on public.newsletter_subscribers to anon;

-- Administrative read access; RLS limits these broad grants to staff roles.
grant select on
  public.audit_logs, public.contact_messages, public.newsletter_subscribers,
  public.feedback, public.support_tickets, public.support_ticket_messages
  to authenticated;
grant update on public.feedback to authenticated;
grant update (status) on public.contact_messages to authenticated;
grant update (is_confirmed, unsubscribed_at) on public.newsletter_subscribers to authenticated;
grant update (status, priority, assigned_to, resolved_at) on public.support_tickets to authenticated;

-- Helper functions used from RLS policies.
grant execute on function private.has_any_role(public.app_role[]) to anon, authenticated;
grant execute on function private.can_access_content(public.content_access) to anon, authenticated;

-- PROFILE / ACCOUNT ---------------------------------------------------------
create policy profiles_read_own_or_admin
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy user_roles_read_own_or_admin
on public.user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[]))
);

create policy user_preferences_owner_all
on public.user_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy user_preferences_read_admin
on public.user_preferences for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy user_consents_read_own_or_admin
on public.user_consents for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[]))
);

create policy user_consents_insert_own
on public.user_consents for insert to authenticated
with check (user_id = (select auth.uid()));

-- PUBLISHED CURRICULUM ------------------------------------------------------
create policy courses_read_published_or_editor
on public.courses for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy courses_manage_by_editor
on public.courses for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy course_units_read_published_or_editor
on public.course_units for select to anon, authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_units.course_id and c.publication_status = 'published'
  )
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy course_units_manage_by_editor
on public.course_units for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lessons_read_published_or_editor
on public.lessons for select to anon, authenticated
using (
  exists (
    select 1
    from public.course_units u
    join public.courses c on c.id = u.course_id
    where u.id = lessons.unit_id
      and u.publication_status = 'published'
      and c.publication_status = 'published'
  )
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy lessons_manage_by_editor
on public.lessons for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_blocks_read_accessible
on public.lesson_content_blocks for select to anon, authenticated
using (
  private.can_access_content(access_level)
  and exists (
    select 1
    from public.lessons l
    join public.course_units u on u.id = l.unit_id
    join public.courses c on c.id = u.course_id
    where l.id = lesson_content_blocks.lesson_id
      and l.publication_status = 'published'
      and u.publication_status = 'published'
      and c.publication_status = 'published'
  )
);

create policy lesson_blocks_manage_by_editor
on public.lesson_content_blocks for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy content_assets_read_accessible
on public.content_assets for select to anon, authenticated
using (private.can_access_content(access_level));

create policy content_assets_manage_by_editor
on public.content_assets for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy vocabulary_read_published_or_editor
on public.vocabulary_entries for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy vocabulary_manage_by_editor
on public.vocabulary_entries for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy kanji_read_published_or_editor
on public.kanji_entries for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy kanji_manage_by_editor
on public.kanji_entries for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy grammar_read_published_or_editor
on public.grammar_points for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy grammar_manage_by_editor
on public.grammar_points for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_vocabulary_read_published
on public.lesson_vocabulary for select to anon, authenticated
using (
  exists (select 1 from public.lessons l where l.id = lesson_vocabulary.lesson_id and l.publication_status = 'published')
  and exists (select 1 from public.vocabulary_entries v where v.id = lesson_vocabulary.vocabulary_id and v.publication_status = 'published')
);
create policy lesson_vocabulary_manage_by_editor
on public.lesson_vocabulary for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_kanji_read_published
on public.lesson_kanji for select to anon, authenticated
using (
  exists (select 1 from public.lessons l where l.id = lesson_kanji.lesson_id and l.publication_status = 'published')
  and exists (select 1 from public.kanji_entries k where k.id = lesson_kanji.kanji_id and k.publication_status = 'published')
);
create policy lesson_kanji_manage_by_editor
on public.lesson_kanji for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy lesson_grammar_read_published
on public.lesson_grammar for select to anon, authenticated
using (
  exists (select 1 from public.lessons l where l.id = lesson_grammar.lesson_id and l.publication_status = 'published')
  and exists (select 1 from public.grammar_points g where g.id = lesson_grammar.grammar_id and g.publication_status = 'published')
);
create policy lesson_grammar_manage_by_editor
on public.lesson_grammar for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

-- QUIZZES: correct answers are not stored in public.quiz_options or public.quiz_questions.
create policy quizzes_read_published_accessible
on public.quizzes for select to anon, authenticated
using (
  publication_status = 'published'
  and private.can_access_content(access_level)
  and (
    (course_id is not null and exists (select 1 from public.courses c where c.id = quizzes.course_id and c.publication_status = 'published'))
    or
    (lesson_id is not null and exists (select 1 from public.lessons l where l.id = quizzes.lesson_id and l.publication_status = 'published'))
  )
);
create policy quizzes_manage_by_editor
on public.quizzes for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy quiz_questions_read_accessible
on public.quiz_questions for select to anon, authenticated
using (
  is_active and exists (
    select 1 from public.quizzes q
    where q.id = quiz_questions.quiz_id
      and q.publication_status = 'published'
      and private.can_access_content(q.access_level)
  )
);
create policy quiz_questions_manage_by_editor
on public.quiz_questions for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy quiz_options_read_accessible
on public.quiz_options for select to anon, authenticated
using (
  exists (
    select 1 from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    where qq.id = quiz_options.question_id
      and qq.is_active
      and q.publication_status = 'published'
      and private.can_access_content(q.access_level)
  )
);
create policy quiz_options_manage_by_editor
on public.quiz_options for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

-- LEARNER STATE -------------------------------------------------------------
create policy course_enrollments_read_own_or_admin
on public.course_enrollments for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy course_enrollments_insert_own
on public.course_enrollments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.courses c where c.id = course_enrollments.course_id and c.publication_status = 'published')
);

create policy lesson_progress_read_own_or_admin
on public.lesson_progress for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy lesson_progress_insert_own
on public.lesson_progress for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.lessons l
    join public.course_units u on u.id = l.unit_id
    join public.courses c on c.id = u.course_id
    where l.id = lesson_progress.lesson_id
      and l.publication_status = 'published'
      and u.publication_status = 'published'
      and c.publication_status = 'published'
  )
);
create policy lesson_progress_update_own
on public.lesson_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy daily_activity_read_own_or_admin
on public.user_daily_activity for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy bookmarks_owner_all
on public.user_bookmarks for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy vocabulary_review_owner_all
on public.vocabulary_review_state for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.vocabulary_entries v where v.id = vocabulary_review_state.vocabulary_id and v.publication_status = 'published')
);

create policy badges_read_active
on public.badges for select to anon, authenticated
using (is_active or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));
create policy badges_manage_by_admin
on public.badges for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy user_badges_read_own_or_admin
on public.user_badges for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy quiz_attempts_read_own_or_admin
on public.quiz_attempts for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));
create policy quiz_attempts_insert_own
on public.quiz_attempts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'in_progress'
  and exists (
    select 1 from public.quizzes q
    where q.id = quiz_attempts.quiz_id
      and q.publication_status = 'published'
      and private.can_access_content(q.access_level)
  )
);

create policy quiz_responses_read_own_or_admin
on public.quiz_responses for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));
create policy quiz_responses_insert_own_in_progress
on public.quiz_responses for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.quiz_attempts a
    join public.quiz_questions q on q.quiz_id = a.quiz_id
    where a.id = quiz_responses.attempt_id
      and a.user_id = (select auth.uid())
      and a.status = 'in_progress'
      and q.id = quiz_responses.question_id
      and q.is_active
  )
);

-- SITE / CMS ----------------------------------------------------------------
create policy cms_pages_read_published
on public.cms_pages for select to anon, authenticated
using (
  publication_status = 'published'
  or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);
create policy cms_pages_manage_by_editor
on public.cms_pages for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy announcements_read_current
on public.announcements for select to anon, authenticated
using (
  publication_status = 'published'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and (target_audience = 'all'
       or (target_audience = 'learners' and (select auth.uid()) is not null)
       or (target_audience = 'premium' and private.can_access_content('premium'::public.content_access))
       or (target_audience = 'staff' and (select private.has_any_role(array['super_admin', 'admin', 'content_editor', 'support_agent']::public.app_role[]))))
);
create policy announcements_manage_by_editor
on public.announcements for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[])));

create policy site_settings_read_public
on public.site_settings for select to anon, authenticated
using (is_public or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy site_settings_manage_by_admin
on public.site_settings for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy feature_flags_read_public
on public.feature_flags for select to anon, authenticated
using ((is_public and is_enabled) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy feature_flags_manage_by_admin
on public.feature_flags for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy notifications_read_own
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_mark_read_own
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- SUPPORT / FEEDBACK --------------------------------------------------------
create policy support_tickets_read_owner_or_staff
on public.support_tickets for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
);
create policy support_tickets_insert_owner
on public.support_tickets for insert to authenticated
with check (user_id = (select auth.uid()));
create policy support_tickets_update_staff
on public.support_tickets for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));

create policy support_messages_read_owner_or_staff
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        t.user_id = (select auth.uid())
        or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
      )
  )
  and (
    not is_internal_note
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);
create policy support_messages_insert_by_owner
on public.support_ticket_messages for insert to authenticated
with check (
  sender_type = 'user'
  and is_internal_note = false
  and author_id = (select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id and t.user_id = (select auth.uid())
  )
);
create policy support_messages_insert_by_staff
on public.support_ticket_messages for insert to authenticated
with check (
  sender_type = 'staff'
  and author_id = (select auth.uid())
  and (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
);

create policy contact_messages_insert_guest
on public.contact_messages for insert to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()));
create policy contact_messages_read_staff
on public.contact_messages for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));
create policy contact_messages_update_staff
on public.contact_messages for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));

create policy newsletter_insert_guest
on public.newsletter_subscribers for insert to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()));
create policy newsletter_read_admin
on public.newsletter_subscribers for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy newsletter_update_admin
on public.newsletter_subscribers for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy feedback_read_owner_or_staff
on public.feedback for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));
create policy feedback_insert_owner
on public.feedback for insert to authenticated
with check (user_id = (select auth.uid()));
create policy feedback_update_staff
on public.feedback for update to authenticated
using ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[])));

create policy audit_logs_read_admin
on public.audit_logs for select to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

-- BILLING -------------------------------------------------------------------
create policy subscription_plans_read_active
on public.subscription_plans for select to anon, authenticated
using (is_active or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy subscription_plans_manage_admin
on public.subscription_plans for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy plan_features_read_active_plan
on public.plan_features for select to anon, authenticated
using (
  exists (select 1 from public.subscription_plans p where p.id = plan_features.plan_id and p.is_active)
  or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[]))
);
create policy plan_features_manage_admin
on public.plan_features for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

create policy billing_profiles_read_owner_or_admin
on public.billing_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy billing_profiles_insert_owner
on public.billing_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy billing_profiles_update_owner
on public.billing_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy subscriptions_read_owner_or_admin
on public.subscriptions for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy payment_orders_read_owner_or_admin
on public.payment_orders for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy payments_read_owner_or_admin
on public.payments for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy invoices_read_owner_or_admin
on public.invoices for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy refunds_read_owner_or_admin
on public.payment_refunds for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy coupons_manage_admin
on public.coupons for all to authenticated
using ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])))
with check ((select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy coupon_redemptions_read_owner_or_admin
on public.coupon_redemptions for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));
create policy entitlements_read_owner_or_admin
on public.user_entitlements for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_any_role(array['super_admin', 'admin']::public.app_role[])));

-- Give backend workers full table access. The service_role key must never be sent to a browser.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all tables in schema private to service_role;
grant all privileges on all sequences in schema public to service_role;
-- Client inserts use UUID defaults; identity sequences remain server-side.

commit;
