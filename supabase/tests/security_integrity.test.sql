begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

select ok(not has_table_privilege('authenticated', 'public.lesson_progress', 'INSERT'),
  'authenticated learners cannot create lesson progress directly');
select ok(not has_table_privilege('authenticated', 'public.lesson_progress', 'UPDATE'),
  'authenticated learners cannot rewrite lesson progress directly');
select ok(not has_table_privilege('authenticated', 'public.vocabulary_review_state', 'INSERT'),
  'authenticated learners cannot create vocabulary review state directly');
select ok(not has_table_privilege('authenticated', 'public.vocabulary_review_state', 'UPDATE'),
  'authenticated learners cannot tamper with SM-2 review state directly');
select ok(not has_table_privilege('authenticated', 'public.kanji_review_state', 'INSERT'),
  'authenticated learners cannot create kanji mastery state directly');
select ok(not has_table_privilege('authenticated', 'public.kanji_review_state', 'UPDATE'),
  'authenticated learners cannot tamper with kanji mastery state directly');
select ok(not has_table_privilege('authenticated', 'public.quiz_attempts', 'INSERT'),
  'authenticated learners must reserve quiz attempts through the trusted RPC');
select ok(not has_table_privilege('authenticated', 'public.quiz_responses', 'INSERT'),
  'authenticated learners cannot submit graded responses directly');
select ok(not has_column_privilege('authenticated', 'public.quiz_attempts', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.quiz_attempts', 'quiz_id', 'INSERT'),
  'column-level quiz attempt INSERT grants are also revoked');
select ok(not has_column_privilege('authenticated', 'public.quiz_responses', 'response', 'INSERT')
  and not has_column_privilege('authenticated', 'public.quiz_responses', 'attempt_id', 'INSERT'),
  'column-level quiz response INSERT grants are also revoked');
select ok(not has_table_privilege('authenticated', 'public.sentence_construction_attempts', 'INSERT'),
  'authenticated learners cannot self-assert sentence correctness directly');
select ok(has_table_privilege('authenticated', 'public.sentence_construction_attempts', 'SELECT'),
  'authenticated learners can still read their own sentence attempt history');
select ok(has_table_privilege('service_role', 'public.quiz_attempts', 'INSERT'),
  'trusted server workflows retain quiz attempt write access');
select ok(has_table_privilege('service_role', 'public.kanji_review_state', 'UPDATE'),
  'trusted server workflows retain kanji review write access');
select ok(has_function_privilege('service_role', 'public.consume_api_rate_limit(text,integer,integer)', 'EXECUTE'),
  'only trusted server workflows can consume the contact rate limit');
select ok(not has_function_privilege('authenticated', 'public.consume_api_rate_limit(text,integer,integer)', 'EXECUTE'),
  'browser roles cannot forge or drain contact rate-limit buckets');
select ok(has_function_privilege('authenticated', 'public.update_learning_settings(uuid,jsonb,jsonb,jsonb)', 'EXECUTE'),
  'authenticated learners can update their own settings through the owner-checked RPC');
select ok(not has_function_privilege('service_role', 'public.update_learning_settings(uuid,jsonb,jsonb,jsonb)', 'EXECUTE'),
  'settings RPC is not exposed as a generic service-role write path');
select ok(has_function_privilege('service_role', 'public.apply_subscription_provider_event(uuid,public.subscription_status,text,text,timestamptz)', 'EXECUTE'),
  'trusted webhook processing can apply ordered subscription events');
select ok(not has_function_privilege('authenticated', 'public.apply_subscription_provider_event(uuid,public.subscription_status,text,text,timestamptz)', 'EXECUTE'),
  'browser roles cannot alter provider subscription state');
select ok(has_function_privilege('service_role', 'public.admin_update_inbox_status_with_audit(text,uuid,text,uuid)', 'EXECUTE'),
  'admin inbox changes can be committed with an audit record');
select ok(not has_function_privilege('authenticated', 'public.admin_update_inbox_status_with_audit(text,uuid,text,uuid)', 'EXECUTE'),
  'browser roles cannot call privileged inbox/audit operations');

select * from finish();
rollback;
