-- Run with a privileged SQL connection against a disposable Haddir schema
-- after applying 20261115131154_harden_payment_review_and_internal_function_grants.sql.
do $assert$
declare
  v_review_def text := pg_get_functiondef('public.review_payment_submission(uuid,text,text)'::regprocedure);
begin
  if position('p_decision is null' in lower(v_review_def)) = 0 then
    raise exception 'FAIL: explicit NULL decision guard missing';
  end if;
  if position('pg_advisory_xact_lock' in v_review_def) = 0 then
    raise exception 'FAIL: payment-review advisory transaction lock missing';
  end if;
  if has_function_privilege('public','private.gatekeeper_ticket_action_core(text,boolean)','EXECUTE')
     or has_function_privilege('anon','private.gatekeeper_ticket_action_core(text,boolean)','EXECUTE')
     or has_function_privilege('authenticated','private.gatekeeper_ticket_action_core(text,boolean)','EXECUTE')
     or has_function_privilege('service_role','private.gatekeeper_ticket_action_core(text,boolean)','EXECUTE') then
    raise exception 'FAIL: internal gatekeeper helper still has a direct EXECUTE grant';
  end if;
  if has_function_privilege('public','public.set_updated_at()','EXECUTE')
     or has_function_privilege('anon','public.set_updated_at()','EXECUTE')
     or has_function_privilege('authenticated','public.set_updated_at()','EXECUTE')
     or has_function_privilege('service_role','public.set_updated_at()','EXECUTE') then
    raise exception 'FAIL: trigger function still has a direct EXECUTE grant';
  end if;
  if not has_function_privilege('authenticated','public.review_payment_submission(uuid,text,text)','EXECUTE') then
    raise exception 'FAIL: authenticated payment-review entry point unexpectedly lost its grant';
  end if;
  if not has_function_privilege('authenticated','private.gatekeeper_ticket_action(text,boolean)','EXECUTE') then
    raise exception 'FAIL: authenticated gatekeeper wrapper unexpectedly lost its grant';
  end if;
end;
$assert$;
