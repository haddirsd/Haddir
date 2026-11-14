-- Let each authenticated user update only their own editable profile fields.
drop policy if exists "Users can update their own basic profile" on public.profiles;
create policy "Users can update their own basic profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Restrict client-side updates to profile fields; role remains server/admin managed.
revoke update on table public.profiles from authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;