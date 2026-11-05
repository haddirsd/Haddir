alter table public.gatekeeper_scan_logs
  add column if not exists entry_method text not null default 'qr'
    check (entry_method in ('qr','manual')),
  add column if not exists entered_code text;

create or replace function private.gatekeeper_ticket_action(p_ticket_code text, p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid := auth.uid();
 v_role text;
 v_assigned_event_id uuid;
 v_event_id uuid;
 v_ticket_id uuid;
 v_result jsonb;
 v_outcome text;
begin
 if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 select p.role into v_role from public.profiles p where p.id=v_uid;
 if coalesce(v_role,'') not in ('gatekeeper','organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
 select a.event_id into v_assigned_event_id
 from public.event_role_assignments a
 where a.user_id=v_uid and a.assignment_role in ('gatekeeper','organizer')
 order by a.created_at desc limit 1;
 if v_assigned_event_id is null then raise exception 'حسابك غير مربوط بفعالية'; end if;
 v_event_id:=v_assigned_event_id;
 select t.id,t.event_id into v_ticket_id,v_event_id
 from public.tickets t where upper(t.ticket_code)=upper(btrim(p_ticket_code)) limit 1;
 if not found then v_event_id:=v_assigned_event_id; end if;
 v_result:=private.gatekeeper_ticket_action_core(p_ticket_code,p_confirm);
 v_outcome:=case v_result->>'status'
  when 'checked_in' then 'accepted' when 'used' then 'used'
  when 'not_found' then 'forged' when 'invalid' then 'invalid' else null end;
 if v_outcome is not null then
  insert into public.gatekeeper_scan_logs(gatekeeper_user_id,event_id,ticket_id,outcome,entry_method,entered_code)
  values(v_uid,v_event_id,v_ticket_id,v_outcome,'qr',btrim(p_ticket_code));
 end if;
 return v_result;
end; $$;

create or replace function private.gatekeeper_manual_ticket_action(p_ticket_code text, p_confirm boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid := auth.uid();
 v_role text;
 v_assigned_event_id uuid;
 v_ticket_id uuid;
 v_ticket_event_id uuid;
 v_result jsonb;
 v_outcome text;
begin
 if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 select p.role into v_role from public.profiles p where p.id=v_uid;
 if coalesce(v_role,'') not in ('gatekeeper','organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
 if coalesce(btrim(p_ticket_code),'') !~ '^[0-9]{10}$' then
  raise exception 'كود التذكرة يجب أن يتكون من 10 أرقام فقط';
 end if;
 select a.event_id into v_assigned_event_id
 from public.event_role_assignments a
 where a.user_id=v_uid and a.assignment_role in ('gatekeeper','organizer')
 order by a.created_at desc limit 1;
 if v_assigned_event_id is null then raise exception 'حسابك غير مربوط بفعالية'; end if;
 select t.id,t.event_id into v_ticket_id,v_ticket_event_id
 from public.tickets t where t.ticket_code=btrim(p_ticket_code) limit 1;
 if v_ticket_id is not null and v_ticket_event_id<>v_assigned_event_id then
  raise exception 'هذه التذكرة لا تخص الفعالية المصرح لك بها';
 end if;
 v_result:=private.gatekeeper_ticket_action_core(btrim(p_ticket_code),p_confirm);
 v_outcome:=case v_result->>'status'
  when 'checked_in' then 'accepted' when 'used' then 'used'
  when 'not_found' then 'forged' when 'invalid' then 'invalid' else null end;
 if v_outcome is not null then
  insert into public.gatekeeper_scan_logs(gatekeeper_user_id,event_id,ticket_id,outcome,entry_method,entered_code)
  values(v_uid,v_assigned_event_id,v_ticket_id,v_outcome,'manual',btrim(p_ticket_code));
 end if;
 return v_result;
end; $$;

create or replace function public.gatekeeper_manual_ticket_action(p_ticket_code text, p_confirm boolean default true)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.gatekeeper_manual_ticket_action(p_ticket_code,p_confirm);
$$;

create or replace function public.get_gatekeeper_manual_history(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid:=auth.uid();
 v_role text;
 v_history jsonb;
begin
 if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 select p.role into v_role from public.profiles p where p.id=v_uid;
 if coalesce(v_role,'') not in ('gatekeeper','organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
 if not exists(
  select 1 from public.event_role_assignments a
  where a.user_id=v_uid and a.event_id=p_event_id
   and a.assignment_role in ('gatekeeper','organizer')
 ) then raise exception 'هذه الفعالية غير مصرح بها لحسابك'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',l.id,'ticket_code',l.entered_code,'outcome',l.outcome,
  'scanned_at',l.scanned_at,'ticket_id',l.ticket_id
 ) order by l.scanned_at desc),'[]'::jsonb)
 into v_history
 from (
  select * from public.gatekeeper_scan_logs
  where gatekeeper_user_id=v_uid and event_id=p_event_id and entry_method='manual'
  order by scanned_at desc limit 50
 ) l;
 return v_history;
end; $$;

revoke all on function private.gatekeeper_ticket_action(text,boolean) from public,anon,authenticated;
revoke all on function private.gatekeeper_manual_ticket_action(text,boolean) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.gatekeeper_ticket_action(text,boolean) to authenticated;
grant execute on function private.gatekeeper_manual_ticket_action(text,boolean) to authenticated;
revoke all on function public.gatekeeper_manual_ticket_action(text,boolean) from public,anon;
grant execute on function public.gatekeeper_manual_ticket_action(text,boolean) to authenticated;
revoke all on function public.get_gatekeeper_manual_history(uuid) from public,anon;
grant execute on function public.get_gatekeeper_manual_history(uuid) to authenticated;
