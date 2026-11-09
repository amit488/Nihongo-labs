-- Remove the retired AI Japanese Sensei feature and any plan/entitlement references.
-- This is forward-only so databases that already applied the prior learning-intelligence
-- migration do not need their migration history edited or checksums rewritten.
begin;

drop function if exists public.consume_ai_sensei_request(uuid, date, integer);
drop table if exists public.ai_sensei_usage;

delete from public.plan_features
where regexp_replace(lower(feature_key), '[^a-z0-9]', '', 'g') like '%sensei%'
   or (
     regexp_replace(lower(feature_key), '[^a-z0-9]', '', 'g') like '%ai%'
     and regexp_replace(lower(feature_key), '[^a-z0-9]', '', 'g') like '%tutor%'
   );

delete from public.user_entitlements
where regexp_replace(lower(feature_key), '[^a-z0-9]', '', 'g') like '%sensei%'
   or (
     regexp_replace(lower(feature_key), '[^a-z0-9]', '', 'g') like '%ai%'
     and regexp_replace(lower(feature_key), '[^a-z0-9]', '', 'g') like '%tutor%'
   );

commit;
