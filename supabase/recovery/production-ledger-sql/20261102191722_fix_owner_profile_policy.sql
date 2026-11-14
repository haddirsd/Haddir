create or replace function private.current_user_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'owner');
$$;
revoke all on function private.current_user_is_owner() from public, anon;
grant execute on function private.current_user_is_owner() to authenticated;
drop policy if exists "Users can read own profile and owner can read all" on public.profiles;
create policy "Users can read own profile and owner can read all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.current_user_is_owner()));