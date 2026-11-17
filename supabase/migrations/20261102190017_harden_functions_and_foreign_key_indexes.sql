create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create index booking_items_booking_id_idx on public.booking_items (booking_id);
create index booking_items_ticket_type_id_idx on public.booking_items (ticket_type_id);
create index checkins_event_id_idx on public.checkins (event_id);
create index checkins_checked_in_by_idx on public.checkins (checked_in_by);
create index events_created_by_idx on public.events (created_by);
create index payment_submissions_submitted_by_idx on public.payment_submissions (submitted_by);
create index payment_submissions_reviewed_by_idx on public.payment_submissions (reviewed_by);
create index tickets_booking_id_idx on public.tickets (booking_id);
create index tickets_booking_item_id_idx on public.tickets (booking_item_id);
create index tickets_ticket_type_id_idx on public.tickets (ticket_type_id);