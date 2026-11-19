-- Allow independent operations for the same customer to share the account barrier.
-- Account deletion retains FOR UPDATE on profiles, which conflicts with KEY SHARE.
-- Booking/payment/expiry writes only need to prevent profile deletion while checking
-- the cleanup tombstone, so their profile locks can be shared.

do $migration$
declare
  v_function record;
  v_definition text;
  v_original text;
begin
  for v_function in
    select p.oid, p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in (
      'create_booking',
      'submit_payment',
      'review_payment_submission'
    ))
    or (n.nspname = 'private' and p.proname in (
      'expire_pending_bookings',
      'guard_customer_account_deletion_writes'
    ))
    order by p.oid
  loop
    v_definition := pg_catalog.pg_get_functiondef(v_function.oid);
    v_original := v_definition;

    case v_function.proname
      when 'create_booking' then
        v_definition := replace(
          v_definition,
          E'order by p.id\n  for update;',
          E'order by p.id\n  for key share;'
        );
      when 'expire_pending_bookings' then
        v_definition := replace(
          v_definition,
          E'order by p.id\n  for update;',
          E'order by p.id\n  for key share;'
        );
      when 'guard_customer_account_deletion_writes' then
        v_definition := replace(
          v_definition,
          E'order by p.id\n    for update;',
          E'order by p.id\n    for key share;'
        );
      when 'submit_payment' then
        v_definition := replace(
          v_definition,
          E'where p.id = v_user\n  for update;',
          E'where p.id = v_user\n  for key share;'
        );
      when 'review_payment_submission' then
        v_definition := replace(
          v_definition,
          E'where p.id = v_user_id\n  for update;',
          E'where p.id = v_user_id\n  for key share;'
        );
    end case;

    if v_definition = v_original then
      raise exception 'Expected customer profile lock was not found in function %', v_function.proname;
    end if;

    execute v_definition;
  end loop;
end;
$migration$;
