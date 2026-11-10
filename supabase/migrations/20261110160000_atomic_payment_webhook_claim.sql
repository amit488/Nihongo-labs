-- Atomically claim Razorpay webhook events so concurrent deliveries cannot process one event twice.
begin;

alter table public.payment_webhook_events
  add column if not exists processing_token uuid;

create or replace function public.claim_payment_webhook_event(
  _provider public.payment_provider,
  _provider_event_id text,
  _lease_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_processing_token uuid := gen_random_uuid();
begin
  update public.payment_webhook_events
  set status = 'processing',
      retry_count = retry_count + 1,
      received_at = clock_timestamp(),
      processing_error = null,
      processing_token = v_processing_token
  where provider = _provider
    and provider_event_id = _provider_event_id
    and (
      status in ('received', 'failed')
      or (
        status = 'processing'
        and received_at < clock_timestamp() - make_interval(secs => greatest(60, least(coalesce(_lease_seconds, 300), 900)))
      )
    );

  if not found then
    return null;
  end if;

  return v_processing_token;
end;
$$;

revoke all on function public.claim_payment_webhook_event(public.payment_provider, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_payment_webhook_event(public.payment_provider, text, integer)
  to service_role;

commit;
