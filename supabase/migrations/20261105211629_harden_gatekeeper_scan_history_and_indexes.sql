-- Keep the RPC wrappers SECURITY INVOKER; privileged checks stay in private functions.
create or replace function private.get_gatekeeper_scan_stats(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_uid uuid := auth.uid(); v_role text; v_stats jsonb;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if coalesce(v_role, '') not in ('gatekeeper', 'organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
  if not exists (select 1 from public.event_role_assignments a where a.user_id = v_uid and a.event_id = p_event_id and a.assignment_role in ('gatekeeper', 'organizer')) then
    raise exception 'هذه الفعالية غير مصرح بها لحسابك';
  end if;
  select jsonb_build_object(
    'accepted', count(*) filter (where l.outcome = 'accepted'),
    'used', count(*) filter (where l.outcome = 'used'),
    'forged', count(*) filter (where l.outcome = 'forged'),
    'invalid', count(*) filter (where l.outcome = 'invalid')
  ) into v_stats
  from public.gatekeeper_scan_logs l where l.event_id = p_event_id;
  return coalesce(v_stats, '{"accepted":0,"used":0,"forged":0,"invalid":0}'::jsonb);
end;
$function$;

create or replace function private.get_gatekeeper_scan_history(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_uid uuid := auth.uid(); v_role text; v_history jsonb;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if coalesce(v_role, '') not in ('gatekeeper', 'organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
  if not exists (select 1 from public.event_role_assignments a where a.user_id = v_uid and a.event_id = p_event_id and a.assignment_role in ('gatekeeper', 'organizer')) then
    raise exception 'هذه الفعالية غير مصرح بها لحسابك';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'ticket_code', coalesce(l.entered_code, t.ticket_code),
    'outcome', l.outcome,
    'scanned_at', l.scanned_at,
    'ticket_id', l.ticket_id,
    'entry_method', l.entry_method,
    'gatekeeper_name', coalesce(nullif(p.full_name, ''), 'بواب الفعالية')
  ) order by l.scanned_at desc), '[]'::jsonb)
  into v_history
  from (
    select * from public.gatekeeper_scan_logs
    where event_id = p_event_id
    order by scanned_at desc limit 100
  ) l
  left join public.profiles p on p.id = l.gatekeeper_user_id
  left join public.tickets t on t.id = l.ticket_id;
  return v_history;
end;
$function$;

create or replace function public.get_gatekeeper_scan_stats(p_event_id uuid)
returns jsonb language sql security invoker set search_path = '' as $function$
  select private.get_gatekeeper_scan_stats(p_event_id);
$function$;

create or replace function public.get_gatekeeper_scan_history(p_event_id uuid)
returns jsonb language sql security invoker set search_path = '' as $function$
  select private.get_gatekeeper_scan_history(p_event_id);
$function$;

grant usage on schema private to authenticated;
revoke all on function private.get_gatekeeper_scan_stats(uuid) from public, anon, authenticated;
revoke all on function private.get_gatekeeper_scan_history(uuid) from public, anon, authenticated;
grant execute on function private.get_gatekeeper_scan_stats(uuid) to authenticated;
grant execute on function private.get_gatekeeper_scan_history(uuid) to authenticated;
revoke all on function public.get_gatekeeper_scan_stats(uuid) from public, anon;
revoke all on function public.get_gatekeeper_scan_history(uuid) from public, anon;
grant execute on function public.get_gatekeeper_scan_stats(uuid) to authenticated;
grant execute on function public.get_gatekeeper_scan_history(uuid) to authenticated;
revoke all on function public.get_gatekeeper_manual_history(uuid) from public, anon, authenticated;

create index if not exists gatekeeper_scan_logs_event_time_idx
  on public.gatekeeper_scan_logs(event_id, scanned_at desc);
create index if not exists gatekeeper_scan_logs_ticket_id_idx
  on public.gatekeeper_scan_logs(ticket_id);
