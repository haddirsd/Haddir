-- Notify the ticket owner exactly once when a gatekeeper confirms entry.
-- Both QR and manual entry use this core function, so the notification is emitted
-- only on the successful valid -> used transition.
create or replace function private.gatekeeper_ticket_action_core(p_ticket_code text, p_confirm boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_uid uuid := auth.uid();
 v_role text;
 v_ticket public.tickets%rowtype;
 v_event_title text;
 v_event_venue text;
 v_event_starts_at timestamptz;
 v_type_name text;
 v_buyer_name text;
 v_attendee_count integer;
 v_booking_user_id uuid;
 v_assignment_exists boolean;
begin
 if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 select p.role into v_role from public.profiles p where p.id=v_uid;
 if coalesce(v_role,'') not in ('gatekeeper','organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
 if nullif(btrim(p_ticket_code),'') is null then raise exception 'أدخل كود التذكرة'; end if;
 select t.* into v_ticket from public.tickets t where upper(t.ticket_code)=upper(btrim(p_ticket_code)) limit 1;
 if not found then
  return jsonb_build_object('ok',false,'status','not_found','message','هذا الكود غير صادر من نظام حاضر');
 end if;
 select exists(select 1 from public.event_role_assignments a where a.user_id=v_uid and a.event_id=v_ticket.event_id and a.assignment_role in ('gatekeeper','organizer')) into v_assignment_exists;
 if not v_assignment_exists then raise exception 'هذه التذكرة لا تخص الفعالية المصرح لك بها'; end if;
 select e.title,e.venue,e.starts_at,tt.name,
        coalesce(nullif(b.customer_name,''),nullif(v_ticket.attendee_name,'')),
        bi.quantity,b.user_id
 into v_event_title,v_event_venue,v_event_starts_at,v_type_name,
      v_buyer_name,v_attendee_count,v_booking_user_id
 from public.events e
 left join public.ticket_types tt on tt.id=v_ticket.ticket_type_id
 left join public.bookings b on b.id=v_ticket.booking_id
 left join public.booking_items bi on bi.id=v_ticket.booking_item_id
 where e.id=v_ticket.event_id;
 if v_ticket.status='used' then
  return jsonb_build_object('ok',false,'status','used','message','تم استخدام هذه التذكرة مسبقاً','ticket_id',v_ticket.id,'ticket_code',v_ticket.ticket_code,'attendee_name',v_ticket.attendee_name,'buyer_name',v_buyer_name,'attendee_count',v_attendee_count,'event_title',v_event_title,'venue',v_event_venue,'starts_at',v_event_starts_at,'ticket_type',v_type_name,'used_at',v_ticket.used_at);
 end if;
 if v_ticket.status <> 'valid' then
  return jsonb_build_object('ok',false,'status','invalid','message','هذه التذكرة موجودة في النظام لكنها غير صالحة للدخول','ticket_id',v_ticket.id,'ticket_code',v_ticket.ticket_code,'attendee_name',v_ticket.attendee_name,'buyer_name',v_buyer_name,'attendee_count',v_attendee_count,'event_title',v_event_title,'venue',v_event_venue,'starts_at',v_event_starts_at,'ticket_type',v_type_name);
 end if;
 if p_confirm then
  update public.tickets t set status='used',used_at=now()
  where t.id=v_ticket.id and t.status='valid'
  returning t.* into v_ticket;
  if not found then
   return jsonb_build_object('ok',false,'status','used','message','تم استخدام التذكرة بالفعل');
  end if;

  if v_booking_user_id is not null then
   insert into public.notifications(user_id,title,message,type,is_read,booking_id)
   values(
    v_booking_user_id,
    'مرحباً بك في الفعالية 🎉',
    'نتمنى لك لحظات سعيدة وتجربة ممتعة مع حاضر.',
    'ticket_checked_in',
    false,
    v_ticket.booking_id
   );
  end if;

  return jsonb_build_object('ok',true,'status','checked_in','message','تم تأكيد دخول حامل التذكرة بنجاح','ticket_id',v_ticket.id,'ticket_code',v_ticket.ticket_code,'attendee_name',v_ticket.attendee_name,'buyer_name',v_buyer_name,'attendee_count',v_attendee_count,'event_title',v_event_title,'venue',v_event_venue,'starts_at',v_event_starts_at,'ticket_type',v_type_name,'used_at',v_ticket.used_at);
 end if;
 return jsonb_build_object('ok',true,'status','valid','message','التذكرة صالحة ويمكن تأكيد الدخول','ticket_id',v_ticket.id,'ticket_code',v_ticket.ticket_code,'attendee_name',v_ticket.attendee_name,'buyer_name',v_buyer_name,'attendee_count',v_attendee_count,'event_title',v_event_title,'venue',v_event_venue,'starts_at',v_event_starts_at,'ticket_type',v_type_name);
end;
$$;

revoke all on function private.gatekeeper_ticket_action_core(text,boolean) from public,anon,authenticated;
grant execute on function private.gatekeeper_ticket_action_core(text,boolean) to authenticated;
