create or replace function private.admin_search_profiles(p_query text default null, p_limit integer default 100, p_offset integer default 0)
returns table(id uuid, full_name text, phone text, email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_role text; v_query text := nullif(btrim(coalesce(p_query,'')),'');
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_role := private.current_profile_role();
  if v_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية عرض المستخدمين'; end if;
  return query
  select p.id,p.full_name,p.phone,u.email,p.role,p.created_at
  from public.profiles p left join auth.users u on u.id=p.id
  where v_query is null or coalesce(p.phone,'') ilike '%'||v_query||'%' or coalesce(u.email,'') ilike '%'||v_query||'%'
  order by p.created_at desc limit greatest(1,least(coalesce(p_limit,100),200)) offset greatest(0,coalesce(p_offset,0));
end; $$;
revoke all on function private.admin_search_profiles(text,integer,integer) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_search_profiles(text,integer,integer) to authenticated;
create or replace function public.admin_search_profiles(p_query text default null,p_limit integer default 100,p_offset integer default 0)
returns table(id uuid,full_name text,phone text,email text,role text,created_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.admin_search_profiles(p_query,p_limit,p_offset); $$;
revoke all on function public.admin_search_profiles(text,integer,integer) from public,anon;
grant execute on function public.admin_search_profiles(text,integer,integer) to authenticated;