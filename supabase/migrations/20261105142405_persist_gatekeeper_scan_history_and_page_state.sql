-- Persist gatekeeper scan outcomes and restore counters after reloads.
create table if not exists public.gatekeeper_scan_logs (
  id uuid primary key default gen_random_uuid(),
  gatekeeper_user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  outcome text not null check (outcome in ('accepted','used','forged','invalid')),
  scanned_at timestamptz not null default now()
);
create index if not exists gatekeeper_scan_logs_user_event_time_idx
  on public.gatekeeper_scan_logs(gatekeeper_user_id,event_id,scanned_at desc);
alter table public.gatekeeper_scan_logs enable row level security;
revoke all on public.gatekeeper_scan_logs from anon, authenticated;

do $migration$
begin
 if to_regprocedure('private.gatekeeper_ticket_action_core(text,boolean)') is null
    and to_regprocedure('private.gatekeeper_ticket_action(text,boolean)') is not null then
  alter function private.gatekeeper_ticket_action(text,boolean)
    rename to gatekeeper_ticket_action_core;
 end if;
end $migration$;

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
  insert into public.gatekeeper_scan_logs(gatekeeper_user_id,event_id,ticket_id,outcome)
  values(v_uid,v_event_id,v_ticket_id,v_outcome);
 end if;
 return v_result;
end; $$;

create or replace function public.gatekeeper_ticket_action(p_ticket_code text, p_confirm boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.gatekeeper_ticket_action(p_ticket_code,p_confirm);
$$;

create or replace function public.get_gatekeeper_scan_stats(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_role text; v_stats jsonb;
begin
 if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 select p.role into v_role from public.profiles p where p.id=v_uid;
 if coalesce(v_role,'') not in ('gatekeeper','organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
 if not exists (
  select 1 from public.event_role_assignments a
  where a.user_id=v_uid and a.event_id=p_event_id
   and a.assignment_role in ('gatekeeper','organizer')
 ) then raise exception 'هذه الفعالية غير مصرح بها لحسابك'; end if;
 select jsonb_build_object(
  'accepted',count(*) filter (where l.outcome='accepted'),
  'used',count(*) filter (where l.outcome='used'),
  'forged',count(*) filter (where l.outcome='forged'),
  'invalid',count(*) filter (where l.outcome='invalid')
 ) into v_stats
 from public.gatekeeper_scan_logs l
 where l.gatekeeper_user_id=v_uid and l.event_id=p_event_id;
 return coalesce(v_stats,'{"accepted":0,"used":0,"forged":0,"invalid":0}'::jsonb);
end; $$;

revoke all on function private.gatekeeper_ticket_action(text,boolean) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.gatekeeper_ticket_action(text,boolean) to authenticated;
revoke all on function public.gatekeeper_ticket_action(text,boolean) from public,anon;
grant execute on function public.gatekeeper_ticket_action(text,boolean) to authenticated;
revoke all on function public.get_gatekeeper_scan_stats(uuid) from public,anon;
grant execute on function public.get_gatekeeper_scan_stats(uuid) to authenticated;
