-- Preserve the existing event booking-window semantics while retaining event-scoped locking.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.create_booking(uuid,uuid,integer)'::regprocedure
  ) into v_definition;

  v_updated := replace(
    v_definition,
    E'       and (\n         v_event.starts_at is null\n         or coalesce(v_event.ends_at, v_event.starts_at) <= now()\n       )',
    E'       and coalesce(v_event.ends_at, v_event.starts_at) is not null\n       and coalesce(v_event.ends_at, v_event.starts_at) <= now()'
  );

  if v_updated = v_definition then
    raise exception 'Expected create_booking event-window expression was not found; aborting without changes';
  end if;

  execute v_updated;
end;
$migration$;
