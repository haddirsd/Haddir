
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) limit 1
$$;
revoke all on function private.current_profile_role() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_profile_role() to authenticated;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['customer','organizer','gatekeeper','advertiser','supervisor','admin','owner']::text[]));

-- Profiles: privileged staff can read profiles; only owner can change roles via a separate controlled process.
drop policy if exists "Platform staff can read profiles" on public.profiles;
create policy "Platform staff can read profiles" on public.profiles
for select to authenticated
using (private.current_profile_role() in ('owner','admin'));

-- Events and ticket types: owner/admin manage; supervisor has no event-management access.
drop policy if exists "Platform managers manage events" on public.events;
create policy "Platform managers manage events" on public.events
for all to authenticated
using (private.current_profile_role() in ('owner','admin'))
with check (private.current_profile_role() in ('owner','admin'));

drop policy if exists "Platform managers manage ticket types" on public.ticket_types;
create policy "Platform managers manage ticket types" on public.ticket_types
for all to authenticated
using (private.current_profile_role() in ('owner','admin'))
with check (private.current_profile_role() in ('owner','admin'));

-- Bookings: owner/admin/supervisor can inspect platform-wide bookings; only owner/admin can manage them.
drop policy if exists "Platform staff read all bookings" on public.bookings;
create policy "Platform staff read all bookings" on public.bookings
for select to authenticated
using (private.current_profile_role() in ('owner','admin','supervisor'));

drop policy if exists "Platform managers manage bookings" on public.bookings;
create policy "Platform managers manage bookings" on public.bookings
for all to authenticated
using (private.current_profile_role() in ('owner','admin'))
with check (private.current_profile_role() in ('owner','admin'));

drop policy if exists "Platform staff read booking items" on public.booking_items;
create policy "Platform staff read booking items" on public.booking_items
for select to authenticated
using (exists (select 1 from public.bookings b where b.id = booking_id
  and private.current_profile_role() in ('owner','admin','supervisor')));

drop policy if exists "Platform managers manage booking items" on public.booking_items;
create policy "Platform managers manage booking items" on public.booking_items
for all to authenticated
using (private.current_profile_role() in ('owner','admin'))
with check (private.current_profile_role() in ('owner','admin'));

-- Payment review is available to owner/admin/supervisor only.
drop policy if exists "Platform staff read payment submissions" on public.payment_submissions;
create policy "Platform staff read payment submissions" on public.payment_submissions
for select to authenticated
using (private.current_profile_role() in ('owner','admin','supervisor'));

drop policy if exists "Platform staff review payment submissions" on public.payment_submissions;
create policy "Platform staff review payment submissions" on public.payment_submissions
for update to authenticated
using (private.current_profile_role() in ('owner','admin','supervisor'))
with check (
  private.current_profile_role() in ('owner','admin','supervisor')
  and reviewed_by = (select auth.uid())
  and status in ('approved','rejected')
);

-- Staff can inspect issued tickets; only gatekeepers can create check-in records.
drop policy if exists "Platform staff read tickets" on public.tickets;
create policy "Platform staff read tickets" on public.tickets
for select to authenticated
using (private.current_profile_role() in ('owner','admin','supervisor','gatekeeper'));

drop policy if exists "Gatekeepers record checkins" on public.checkins;
create policy "Gatekeepers record checkins" on public.checkins
for insert to authenticated
with check (
  private.current_profile_role() = 'gatekeeper'
  and checked_in_by = (select auth.uid())
  and exists (select 1 from public.tickets t where t.id = ticket_id and t.event_id = event_id and t.status = 'valid')
);

drop policy if exists "Platform managers read checkins" on public.checkins;
create policy "Platform managers read checkins" on public.checkins
for select to authenticated
using (private.current_profile_role() in ('owner','admin'));

grant select on public.profiles, public.events, public.ticket_types, public.bookings,
  public.booking_items, public.payment_submissions, public.tickets, public.checkins to authenticated;
grant insert, update, delete on public.events, public.ticket_types to authenticated;
grant update on public.bookings to authenticated;
grant update (status, reviewed_by, reviewed_at, review_note) on public.payment_submissions to authenticated;
grant insert on public.checkins to authenticated;
