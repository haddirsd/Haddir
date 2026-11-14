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


-- Full payment lifecycle fixtures and assertions (still disposable PostgreSQL only).
DO $workflow_fixtures$
DECLARE
  v_customer uuid := '10000000-0000-4000-8000-000000000002';
  v_gate uuid := '10000000-0000-4000-8000-000000000003';
  v_event uuid := '20000000-0000-4000-8000-000000000001';
  v_other uuid := '20000000-0000-4000-8000-000000000002';
  v_reject_booking uuid := '30000000-0000-4000-8000-000000000002';
  v_manual_booking uuid := '30000000-0000-4000-8000-000000000003';
  v_concurrent_booking uuid := '30000000-0000-4000-8000-000000000004';
  v_other_booking uuid := '30000000-0000-4000-8000-000000000005';
  v_type uuid := '40000000-0000-4000-8000-000000000001';
BEGIN
  INSERT INTO auth.users(id,email) VALUES
    (v_customer,'workflow-customer@example.invalid'),
    (v_gate,'workflow-gatekeeper@example.invalid');
  INSERT INTO public.profiles(id,full_name,role) VALUES
    (v_customer,'Workflow Customer','customer'),
    (v_gate,'Workflow Gatekeeper','gatekeeper');
  INSERT INTO public.events(id,title,slug,status,created_by)
  VALUES(v_other,'Other Test Event','other-test-event','draft','10000000-0000-4000-8000-000000000001');
  UPDATE public.ticket_types SET quantity_sold=5 WHERE id=v_type;
  UPDATE public.bookings SET user_id=v_customer,status='under_review' WHERE id='30000000-0000-4000-8000-000000000001';
  INSERT INTO public.bookings(id,booking_number,user_id,customer_name,customer_phone,event_id,subtotal,status)
  VALUES
    (v_reject_booking,'SECURITY-REJECT',v_customer,'Workflow Customer','0000000000',v_event,300,'under_review'),
    (v_manual_booking,'SECURITY-MANUAL',v_customer,'Workflow Customer','0000000000',v_event,100,'confirmed'),
    (v_concurrent_booking,'SECURITY-CONCURRENT',v_customer,'Workflow Customer','0000000000',v_event,100,'confirmed'),
    (v_other_booking,'SECURITY-OTHER',v_customer,'Workflow Customer','0000000000',v_other,100,'confirmed');
  INSERT INTO public.booking_items(id,booking_id,ticket_type_id,quantity,unit_price,line_total)
  VALUES
    ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',v_type,2,100,200),
    ('50000000-0000-4000-8000-000000000002',v_reject_booking,v_type,3,100,300),
    ('50000000-0000-4000-8000-000000000003',v_manual_booking,v_type,1,100,100),
    ('50000000-0000-4000-8000-000000000004',v_concurrent_booking,v_type,1,100,100),
    ('50000000-0000-4000-8000-000000000005',v_other_booking,v_type,1,100,100);
  INSERT INTO public.payment_submissions(id,booking_id,submitted_by,amount,status)
  VALUES
    ('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',v_customer,200,'submitted'),
    ('60000000-0000-4000-8000-000000000002',v_reject_booking,v_customer,300,'submitted');
  INSERT INTO public.event_role_assignments(user_id,event_id,assignment_role)
  VALUES(v_gate,v_event,'gatekeeper');
  INSERT INTO public.tickets(booking_item_id,booking_id,event_id,ticket_type_id,ticket_code,attendee_name,status)
  VALUES
    ('50000000-0000-4000-8000-000000000003',v_manual_booking,v_event,v_type,'2222222222','Manual Guest','valid'),
    ('50000000-0000-4000-8000-000000000004',v_concurrent_booking,v_event,v_type,'3333333333','Concurrent Guest','valid'),
    ('50000000-0000-4000-8000-000000000005',v_other_booking,v_other,v_type,'4444444444','Wrong Event Guest','valid');
END
$workflow_fixtures$;

SET ROLE authenticated;
DO $payment_workflows$
DECLARE
  v_result jsonb;
  v_message text;
BEGIN
  v_result:=public.review_payment_submission('60000000-0000-4000-8000-000000000001','approve',NULL);
  IF v_result->>'success'<>'true' OR v_result->>'tickets_created'<>'1' OR v_result->>'attendee_count'<>'2' THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: approval result unexpected: %',v_result;
  END IF;
  BEGIN
    PERFORM public.review_payment_submission('60000000-0000-4000-8000-000000000001','approve',NULL);
    RAISE EXCEPTION 'SECURITY TEST FAILED: repeated approval accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message='SECURITY TEST FAILED: repeated approval accepted' THEN RAISE; END IF;
    IF v_message<>'تمت مراجعة إثبات الدفع مسبقاً' THEN RAISE EXCEPTION 'Unexpected repeat-approval error: %',v_message; END IF;
  END;
  PERFORM public.review_payment_submission('60000000-0000-4000-8000-000000000002','reject','إيصال غير مطابق');
  BEGIN
    PERFORM public.review_payment_submission('60000000-0000-4000-8000-000000000002','reject','تكرار');
    RAISE EXCEPTION 'SECURITY TEST FAILED: repeated rejection accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message='SECURITY TEST FAILED: repeated rejection accepted' THEN RAISE; END IF;
    IF v_message<>'تمت مراجعة إثبات الدفع مسبقاً' THEN RAISE EXCEPTION 'Unexpected repeat-rejection error: %',v_message; END IF;
  END;
END
$payment_workflows$;
RESET ROLE;

DO $payment_side_effects$
DECLARE
  v_approved_payment text;
  v_approved_booking text;
  v_approved_tickets integer;
  v_approved_stock integer;
  v_approved_notifications integer;
  v_rejected_payment text;
  v_rejection_note text;
  v_rejected_booking text;
  v_rejected_stock integer;
  v_rejected_tickets integer;
  v_rejected_notifications integer;
BEGIN
  SELECT status INTO v_approved_payment FROM public.payment_submissions WHERE id='60000000-0000-4000-8000-000000000001';
  SELECT status INTO v_approved_booking FROM public.bookings WHERE id='30000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO v_approved_tickets FROM public.tickets WHERE booking_id='30000000-0000-4000-8000-000000000001';
  SELECT quantity_sold INTO v_approved_stock FROM public.ticket_types WHERE id='40000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO v_approved_notifications FROM public.notifications WHERE booking_id='30000000-0000-4000-8000-000000000001' AND type='ticket_approved';

  SELECT status,review_note INTO v_rejected_payment,v_rejection_note FROM public.payment_submissions WHERE id='60000000-0000-4000-8000-000000000002';
  SELECT status INTO v_rejected_booking FROM public.bookings WHERE id='30000000-0000-4000-8000-000000000002';
  SELECT quantity_sold INTO v_rejected_stock FROM public.ticket_types WHERE id='40000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO v_rejected_tickets FROM public.tickets WHERE booking_id='30000000-0000-4000-8000-000000000002';
  SELECT count(*) INTO v_rejected_notifications FROM public.notifications WHERE booking_id='30000000-0000-4000-8000-000000000002' AND type='payment_rejected';

  IF v_approved_payment IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'PAYMENT ASSERT: approval status %, expected approved',v_approved_payment; END IF;
  IF v_approved_booking IS DISTINCT FROM 'confirmed' THEN RAISE EXCEPTION 'PAYMENT ASSERT: approval booking status %, expected confirmed',v_approved_booking; END IF;
  IF v_approved_tickets <> 1 THEN RAISE EXCEPTION 'PAYMENT ASSERT: approval tickets %, expected 1',v_approved_tickets; END IF;
  IF v_approved_stock <> 5 THEN RAISE EXCEPTION 'PAYMENT ASSERT: stock after approval %, expected 5',v_approved_stock; END IF;
  IF v_approved_notifications <> 1 THEN RAISE EXCEPTION 'PAYMENT ASSERT: approval notifications %, expected 1',v_approved_notifications; END IF;
  IF v_rejected_payment IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'PAYMENT ASSERT: rejection status %, expected rejected',v_rejected_payment; END IF;
  IF v_rejection_note IS DISTINCT FROM 'إيصال غير مطابق' THEN RAISE EXCEPTION 'PAYMENT ASSERT: rejection note %, unexpected',v_rejection_note; END IF;
  IF v_rejected_booking IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'PAYMENT ASSERT: rejected booking status %, expected rejected',v_rejected_booking; END IF;
  IF v_rejected_stock <> 2 THEN RAISE EXCEPTION 'PAYMENT ASSERT: stock after rejection %, expected 2',v_rejected_stock; END IF;
  IF v_rejected_tickets <> 0 THEN RAISE EXCEPTION 'PAYMENT ASSERT: rejected booking tickets %, expected 0',v_rejected_tickets; END IF;
  IF v_rejected_notifications <> 1 THEN RAISE EXCEPTION 'PAYMENT ASSERT: rejection notifications %, expected 1',v_rejected_notifications; END IF;
END
$payment_side_effects$;

SELECT set_config('haddir_test.qr_code',
  (SELECT ticket_code FROM public.tickets WHERE booking_id='30000000-0000-4000-8000-000000000001' LIMIT 1),false);
SET ROLE authenticated;
DO $gatekeeper_workflows$
DECLARE v_result jsonb; v_code text:=current_setting('haddir_test.qr_code'); v_message text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
  v_result:=public.gatekeeper_ticket_action(v_code,false);
  IF v_result->>'status'<>'valid' THEN RAISE EXCEPTION 'QR preview failed: %',v_result; END IF;
  v_result:=public.gatekeeper_ticket_action(v_code,true);
  IF v_result->>'status'<>'checked_in' THEN RAISE EXCEPTION 'QR confirmation failed: %',v_result; END IF;
  v_result:=public.gatekeeper_ticket_action(v_code,true);
  IF v_result->>'status'<>'used' THEN RAISE EXCEPTION 'QR repeat failed: %',v_result; END IF;
  v_result:=public.gatekeeper_manual_ticket_action('2222222222',false);
  IF v_result->>'status'<>'valid' THEN RAISE EXCEPTION 'Manual preview failed: %',v_result; END IF;
  v_result:=public.gatekeeper_manual_ticket_action('2222222222',true);
  IF v_result->>'status'<>'checked_in' THEN RAISE EXCEPTION 'Manual confirmation failed: %',v_result; END IF;
  v_result:=public.gatekeeper_manual_ticket_action('2222222222',true);
  IF v_result->>'status'<>'used' THEN RAISE EXCEPTION 'Manual repeat failed: %',v_result; END IF;
  BEGIN
    PERFORM public.gatekeeper_ticket_action('4444444444',false);
    RAISE EXCEPTION 'SECURITY TEST FAILED: cross-event ticket inspection succeeded';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message='SECURITY TEST FAILED: cross-event ticket inspection succeeded' THEN RAISE; END IF;
    IF v_message<>'هذه التذكرة لا تخص الفعالية المصرح لك بها' THEN RAISE EXCEPTION 'Unexpected cross-event error: %',v_message; END IF;
  END;
END
$gatekeeper_workflows$;
RESET ROLE;

DO $gatekeeper_side_effects$
DECLARE v_code text:=current_setting('haddir_test.qr_code');
BEGIN
  IF (SELECT count(*) FROM public.gatekeeper_scan_logs WHERE entered_code=v_code AND outcome='accepted' AND entry_method='qr')<>1
    OR (SELECT count(*) FROM public.gatekeeper_scan_logs WHERE entered_code=v_code AND outcome='used' AND entry_method='qr')<>1
    OR (SELECT count(*) FROM public.notifications WHERE booking_id='30000000-0000-4000-8000-000000000001' AND type='ticket_checked_in')<>1
    OR (SELECT count(*) FROM public.gatekeeper_scan_logs WHERE entered_code='2222222222' AND outcome='accepted' AND entry_method='manual')<>1
    OR (SELECT count(*) FROM public.gatekeeper_scan_logs WHERE entered_code='2222222222' AND outcome='used' AND entry_method='manual')<>1
    OR (SELECT count(*) FROM public.notifications WHERE booking_id='30000000-0000-4000-8000-000000000003' AND type='ticket_checked_in')<>1
    OR EXISTS(SELECT 1 FROM public.gatekeeper_scan_logs WHERE entered_code='4444444444') THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: QR/manual audit or exactly-once notification invariant';
  END IF;
END
$gatekeeper_side_effects$;
SELECT 'PASS: payment approve/reject, stock/ticket/in-app notifications, QR/manual and event-assignment workflows.' AS result;
