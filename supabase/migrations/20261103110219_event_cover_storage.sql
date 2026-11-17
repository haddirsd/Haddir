
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Event cover images are public" on storage.objects;
create policy "Event cover images are public"
on storage.objects for select
to public
using (bucket_id = 'event-covers');

drop policy if exists "Owners and admins upload event covers" on storage.objects;
create policy "Owners and admins upload event covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-covers'
  and (select private.current_profile_role()) in ('owner','admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners and admins update event covers" on storage.objects;
create policy "Owners and admins update event covers"
on storage.objects for update
to authenticated
using (
  bucket_id = 'event-covers'
  and (select private.current_profile_role()) in ('owner','admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'event-covers'
  and (select private.current_profile_role()) in ('owner','admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners and admins delete event covers" on storage.objects;
create policy "Owners and admins delete event covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-covers'
  and (select private.current_profile_role()) in ('owner','admin')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
