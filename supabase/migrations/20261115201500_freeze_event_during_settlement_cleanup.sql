-- Serialize event completion/archive with booking creation and freeze sales as soon as archive stats are staged.
create or replace function private.lock_event_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status = 'completed' then
    perform pg_catalog.pg_advisory_xact_lock(748231905441::bigint);
  end if;
  return new;
end;
$$;

drop trigger if exists lock_event_completion on public.events;
create trigger lock_event_completion
before update of status on public.events
for each row execute function private.lock_event_completion();

create or replace function private.freeze_event_after_stats_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events
     set status = 'completed',
         is_trending = false,
         updated_at = now()
   where id = new.event_id;

  update public.ticket_types
     set is_active = false,
         updated_at = now()
   where event_id = new.event_id;

  return new;
end;
$$;

drop trigger if exists freeze_event_after_stats_archive on public.event_lifetime_stats;
create trigger freeze_event_after_stats_archive
after insert on public.event_lifetime_stats
for each row execute function private.freeze_event_after_stats_archive();
