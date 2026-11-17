drop function if exists public.admin_search_profiles(text,integer,integer);
drop function if exists private.admin_search_profiles(text,integer,integer);

create or replace function private.admin_search_profiles(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0,
  p_role text default null
)
returns table(id uuid, full_name text, phone text, email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_query text := nullif(btrim(coalesce(p_query,'')),'');
  v_filter_role text := nullif(btrim(coalesce(p_role,'')),'');
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_role := private.current_profile_role();
  if v_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية عرض المستخدمين'; end if;
  if v_filter_role is not null and v_filter_role not in ('owner','admin','supervisor','organizer','gatekeeper','advertiser','customer') then
    raise exception 'فلتر الدور غير صالح';
  end if;
  return query
  select p.id::uuid, p.full_name::text, p.phone::text, u.email::text, p.role::text, p.created_at::timestamptz
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (v_query is null or coalesce(p.phone::text,'') ilike '%'||v_query||'%' or coalesce(u.email::text,'') ilike '%'||v_query||'%')
    and (v_filter_role is null or p.role::text = v_filter_role)
  order by p.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200))
  offset greatest(0,coalesce(p_offset,0));
end; $$;

revoke all on function private.admin_search_profiles(text,integer,integer,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_search_profiles(text,integer,integer,text) to authenticated;

create or replace function public.admin_search_profiles(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0,
  p_role text default null
)
returns table(id uuid, full_name text, phone text, email text, role text, created_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from private.admin_search_profiles(p_query,p_limit,p_offset,p_role);
$$;
revoke all on function public.admin_search_profiles(text,integer,integer,text) from public, anon;
grant execute on function public.admin_search_profiles(text,integer,integer,text) to authenticated;
