-- Reconcile the four unapplied 20261120 drafts without regressing
-- the hardened payment-review implementation from 20261119172147.
-- This migration restores only the effects that are required on a clean
-- database or were missing from production.

-- Private payment receipt storage and customer-owned upload authorization.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Customers upload own payment receipts" on storage.objects;

create policy "Customers upload own payment receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.bookings b
    where b.id::text = (storage.foldername(name))[2]
      and b.user_id = (select auth.uid())
      and b.status = 'pending_payment'
      and b.expires_at > now()
  )
);

-- Gatekeepers can read tickets only for events assigned to them.
drop policy if exists "Platform staff read tickets" on public.tickets;
drop policy if exists "Assigned staff read assigned event tickets" on public.tickets;

create policy "Assigned staff read assigned event tickets"
on public.tickets
for select
to authenticated
using (
  private.current_profile_role() in ('owner', 'admin')
  or (
    private.current_profile_role() in ('gatekeeper', 'organizer')
    and exists (
      select 1
      from public.event_role_assignments a
      where a.user_id = (select auth.uid())
        and a.event_id = tickets.event_id
        and a.assignment_role in ('gatekeeper', 'organizer')
    )
  )
);

-- Gatekeepers can record one check-in only for a valid ticket in their assigned event.
drop policy if exists "Gatekeepers record checkins" on public.checkins;
drop policy if exists "Gatekeepers record assigned event checkins" on public.checkins;

create policy "Gatekeepers record assigned event checkins"
on public.checkins
for insert
to authenticated
with check (
  private.current_profile_role() in ('gatekeeper', 'organizer')
  and checked_in_by = (select auth.uid())
  and exists (
    select 1
    from public.tickets t
    where t.id = checkins.ticket_id
      and t.event_id = checkins.event_id
      and t.status = 'valid'
  )
  and exists (
    select 1
    from public.event_role_assignments a
    where a.user_id = (select auth.uid())
      and a.event_id = checkins.event_id
      and a.assignment_role in ('gatekeeper', 'organizer')
  )
);

-- Public PostgREST wrapper; authorization remains in the private implementation.
grant usage on schema private to authenticated;

create or replace function public.get_advertiser_event_statistics()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.get_advertiser_event_statistics();
$function$;

revoke all on function public.get_advertiser_event_statistics() from public, anon;
grant execute on function public.get_advertiser_event_statistics() to authenticated;

notify pgrst, 'reload schema';
