-- Limit storage deletion to objects belonging to events already staged for archival.
drop policy if exists "Owners and admins delete settled event receipts" on storage.objects;
create policy "Owners and admins delete settled event receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-receipts'
  and private.current_profile_role() in ('owner','admin')
  and exists (
    select 1
    from public.bookings b
    join public.event_lifetime_stats s on s.event_id = b.event_id
    where b.id::text = (storage.foldername(name))[2]
  )
);

drop policy if exists "Owners and admins delete linked event covers" on storage.objects;
create policy "Owners and admins delete linked event covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-covers'
  and private.current_profile_role() in ('owner','admin')
  and exists (
    select 1
    from public.events e
    join public.event_lifetime_stats s on s.event_id = e.id
    where e.cover_image_url like '%' || storage.objects.name
  )
);
