-- Restore the private receipt bucket and customer upload authorization
-- in the active migration chain. The legacy definition lived only under
-- supabase/superseded and therefore was not replayed on a clean database.

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
