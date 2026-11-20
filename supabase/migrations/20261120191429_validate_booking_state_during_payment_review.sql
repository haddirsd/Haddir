-- A submitted receipt may only be reviewed while its booking is under review.
-- Keep the current payment-review implementation intact and add the missing
-- booking-state guard after the booking row has been locked and verified.
do $migration$
declare
  v_definition text;
  v_original text;
  v_anchor text := E'  if v_booking.user_id is distinct from v_user_id\n     or v_booking.event_id is distinct from v_event_id then\n    raise exception ''تغير ارتباط الحجز أثناء المراجعة؛ أعد المحاولة'';\n  end if;\n\n  if v_role = ''supervisor'' and not exists (';
  v_replacement text := E'  if v_booking.user_id is distinct from v_user_id\n     or v_booking.event_id is distinct from v_event_id then\n    raise exception ''تغير ارتباط الحجز أثناء المراجعة؛ أعد المحاولة'';\n  end if;\n\n  if v_booking.status is distinct from ''under_review'' then\n    raise exception ''حالة الحجز لا تسمح بمراجعة إثبات الدفع'';\n  end if;\n\n  if v_role = ''supervisor'' and not exists (';
begin
  select pg_catalog.pg_get_functiondef(
    'public.review_payment_submission(uuid,text,text)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  if v_definition = v_original then
    raise exception 'Expected booking identity and supervisor-scope guard was not found; migration aborted';
  end if;

  execute v_definition;
end;
$migration$;
