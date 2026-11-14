-- Isolated behavioral regression checks for the Haddir security draft.
-- Runs only inside the disposable PostgreSQL 17 GitHub Actions database.
-- This does NOT emulate Supabase Auth/RLS or replace full booking/gatekeeper integration tests.

DO $fixtures$
DECLARE
  v_owner uuid := '10000000-0000-4000-8000-000000000001';
  v_event uuid := '20000000-0000-4000-8000-000000000001';
  v_booking uuid := '30000000-0000-4000-8000-000000000001';
  v_ticket_type uuid := '40000000-0000-4000-8000-000000000001';
BEGIN
  INSERT INTO auth.users(id,email) VALUES (v_owner,'security-test-owner@example.invalid');
  INSERT INTO public.profiles(id,full_name,role) VALUES (v_owner,'Security Test Owner','owner');

  INSERT INTO public.events(id,title,slug,status,created_by,updated_at)
  VALUES (v_event,'Security Test Event','security-test-event','draft',v_owner,'2000-01-01 UTC');

  INSERT INTO public.bookings(
    id,booking_number,user_id,customer_name,customer_phone,event_id,subtotal,status,updated_at
  ) VALUES (
    v_booking,'SECURITY-TEST-BOOKING',v_owner,'Security Test Customer','0000000000',
    v_event,100,'pending_payment','2000-01-01 UTC'
  );

  INSERT INTO public.ticket_types(
    id,event_id,name,price,quantity_total,quantity_sold,updated_at
  ) VALUES (
    v_ticket_type,v_event,'Security Test Ticket',100,10,0,'2000-01-01 UTC'
  );
END
$fixtures$;

-- Invalid decisions must fail before payment lookup, even when the submission ID is absent.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;
DO $payment_validation$
DECLARE
  v_message text;
BEGIN
  BEGIN
    PERFORM public.review_payment_submission(
      '90000000-0000-4000-8000-000000000001'::uuid, NULL, NULL
    );
    RAISE EXCEPTION 'SECURITY TEST FAILED: NULL decision was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message = 'SECURITY TEST FAILED: NULL decision was accepted' THEN RAISE; END IF;
    IF v_message <> 'قرار المراجعة غير صحيح' THEN
      RAISE EXCEPTION 'SECURITY TEST FAILED: NULL decision produced unexpected error: %',v_message;
    END IF;
  END;

  BEGIN
    PERFORM public.review_payment_submission(
      '90000000-0000-4000-8000-000000000001'::uuid, 'approve_now', NULL
    );
    RAISE EXCEPTION 'SECURITY TEST FAILED: unknown decision was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message = 'SECURITY TEST FAILED: unknown decision was accepted' THEN RAISE; END IF;
    IF v_message <> 'قرار المراجعة غير صحيح' THEN
      RAISE EXCEPTION 'SECURITY TEST FAILED: unknown decision produced unexpected error: %',v_message;
    END IF;
  END;
END
$payment_validation$;
RESET ROLE;

-- A direct call to the internal SECURITY DEFINER core must be denied to authenticated.
SET ROLE authenticated;
DO $core_acl$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM private.gatekeeper_ticket_action_core('NOT-A-REAL-TICKET',false);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: authenticated directly invoked gatekeeper core';
  END IF;
END
$core_acl$;
RESET ROLE;

-- The helper must still run through its four triggers after direct EXECUTE is revoked.
DO $trigger_behavior$
DECLARE
  v_owner uuid := '10000000-0000-4000-8000-000000000001';
  v_event uuid := '20000000-0000-4000-8000-000000000001';
  v_booking uuid := '30000000-0000-4000-8000-000000000001';
  v_ticket_type uuid := '40000000-0000-4000-8000-000000000001';
  v_old timestamptz := '2000-01-01 UTC';
BEGIN
  UPDATE public.profiles SET full_name='Security Test Owner Updated',updated_at=v_old WHERE id=v_owner;
  IF (SELECT updated_at FROM public.profiles WHERE id=v_owner) <= v_old THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: profiles updated_at trigger did not fire';
  END IF;

  UPDATE public.events SET title='Security Test Event Updated',updated_at=v_old WHERE id=v_event;
  IF (SELECT updated_at FROM public.events WHERE id=v_event) <= v_old THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: events updated_at trigger did not fire';
  END IF;

  UPDATE public.bookings SET customer_name='Security Test Customer Updated',updated_at=v_old WHERE id=v_booking;
  IF (SELECT updated_at FROM public.bookings WHERE id=v_booking) <= v_old THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: bookings updated_at trigger did not fire';
  END IF;

  UPDATE public.ticket_types SET name='Security Test Ticket Updated',updated_at=v_old WHERE id=v_ticket_type;
  IF (SELECT updated_at FROM public.ticket_types WHERE id=v_ticket_type) <= v_old THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: ticket_types updated_at trigger did not fire';
  END IF;
END
$trigger_behavior$;

SELECT 'PASS: NULL/invalid payment decisions rejected; gatekeeper core direct call denied; all four updated_at triggers still fire.' AS result;
