-- Haddir security hardening catalog regression assertions.
-- Run ONLY against a disposable Haddir database AFTER applying the quarantined draft.
-- This file is not a migration and is not in supabase/migrations/.

do $test$
declare
  v_definition text;
  v_trigger_count integer;
begin
  -- Payment decision validation must be NULL-safe and exhaustive.
  select pg_get_functiondef('public.review_payment_submission(uuid,text,text)'::regprocedure)
    into v_definition;
  if position('p_decision is null' in lower(v_definition)) = 0 then
    raise exception 'SECURITY TEST FAILED: payment decision has no explicit NULL guard';
  end if;
  if position('elsif p_decision' in lower(v_definition)) = 0 then
    raise exception 'SECURITY TEST FAILED: payment rejection branch is not explicit';
  end if;

  -- Direct access to the internal SECURITY DEFINER core must be removed.
  if has_function_privilege('authenticated',
       'private.gatekeeper_ticket_action_core(text,boolean)', 'EXECUTE') then
    raise exception 'SECURITY TEST FAILED: authenticated can execute gatekeeper core';
  end if;
  if has_function_privilege('anon',
       'private.gatekeeper_ticket_action_core(text,boolean)', 'EXECUTE') then
    raise exception 'SECURITY TEST FAILED: anon can execute gatekeeper core';
  end if;

  -- Public wrappers remain callable by signed-in users.
  if not has_function_privilege('authenticated',
       'public.gatekeeper_ticket_action(text,boolean)', 'EXECUTE') then
    raise exception 'SECURITY TEST FAILED: QR wrapper lost authenticated EXECUTE';
  end if;
  if not has_function_privilege('authenticated',
       'public.gatekeeper_manual_ticket_action(text,boolean)', 'EXECUTE') then
    raise exception 'SECURITY TEST FAILED: manual wrapper lost authenticated EXECUTE';
  end if;

  -- Trigger helper is not a browser/service RPC.
  if has_function_privilege('authenticated', 'public.set_updated_at()', 'EXECUTE')
     or has_function_privilege('anon', 'public.set_updated_at()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.set_updated_at()', 'EXECUTE') then
    raise exception 'SECURITY TEST FAILED: set_updated_at retains an unnecessary EXECUTE grant';
  end if;

  -- It remains attached to the expected four tables.
  select count(*) into v_trigger_count
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_proc p on p.oid=t.tgfoid
  join pg_namespace n on n.oid=p.pronamespace
  where not t.tgisinternal
    and n.nspname='public'
    and p.proname='set_updated_at'
    and c.relname in ('bookings','events','profiles','ticket_types');
  if v_trigger_count <> 4 then
    raise exception 'SECURITY TEST FAILED: expected 4 set_updated_at triggers, found %', v_trigger_count;
  end if;

  -- Vault-backed push configuration remains restricted.
  if has_function_privilege('authenticated', 'public.get_haddir_push_config()', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_haddir_push_config()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_haddir_push_config()', 'EXECUTE') then
    raise exception 'SECURITY TEST FAILED: push config ACL changed unexpectedly';
  end if;

  raise notice 'Haddir security hardening catalog assertions passed';
end
$test$;
