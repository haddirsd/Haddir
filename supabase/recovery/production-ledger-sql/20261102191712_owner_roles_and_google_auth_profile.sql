alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['customer','organizer','gatekeeper','advertiser','admin','owner']::text[]));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when lower(coalesce(new.email, '')) = 'a7mdtayb@gmail.com' then 'owner' else 'customer' end
  )
  on conflict (id) do update
    set role = case when lower(coalesce(new.email, '')) = 'a7mdtayb@gmail.com' then 'owner' else public.profiles.role end;
  return new;
end;
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read own profile and owner can read all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'owner'
));

update public.profiles p
set role = 'owner'
from auth.users u
where p.id = u.id and lower(u.email) = 'a7mdtayb@gmail.com';