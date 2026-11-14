# Draft application routines

Contains **32 public/private routine definitions** from the production catalog snapshot.

- Definitions are included verbatim from the read-only catalog export.
- This is not yet ordered by dependency; review SQL-language function dependencies before execution.
- Function owners, security-definer settings, search paths and exact EXECUTE ACLs still require a dedicated reconciliation pass.
- Any Supabase-managed service schemas, roles, Vault secrets, or external credentials remain prerequisites and are not recreated here.
- Not tested on PostgreSQL; do not apply to production.

```sql
-- DRAFT ONLY: public/private routine definitions captured from the production catalog.
-- Dependency and ACL reviews are documented separately; this draft is not executable or approved.
-- It must pass the isolated PostgreSQL harness and a compatible Supabase integration test before adoption.

-- private.admin_search_profiles(p_query text, p_limit integer, p_offset integer, p_role text)
CREATE OR REPLACE FUNCTION private.admin_search_profiles(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_role text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, full_name text, phone text, email text, role text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

-- private.admin_update_profile_role(p_user_id uuid, p_role text, p_event_id uuid)
CREATE OR REPLACE FUNCTION private.admin_update_profile_role(p_user_id uuid, p_role text, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then
    raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'لا يمكنك تغيير دور حسابك الحالي';
  end if;

  if p_role not in ('admin','supervisor','gatekeeper','advertiser','customer') then
    raise exception 'الدور المطلوب غير مسموح';
  end if;

  -- Only the platform owner may grant or revoke the admin role.
  if p_role = 'admin' and v_actor_role <> 'owner' then
    raise exception 'تعيين المشرف الإداري من صلاحيات مالك المنصة فقط';
  end if;

  select p.role into v_target_role
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'المستخدم غير موجود';
  end if;

  if v_target_role = 'owner' then
    raise exception 'لا يمكن تغيير صلاحيات مالك المنصة';
  end if;

  if v_actor_role = 'admin' and v_target_role = 'admin' then
    raise exception 'لا يحق للمشرف الإداري تغيير صلاحيات مشرف إداري آخر';
  end if;

  if p_role in ('gatekeeper','advertiser') then
    if p_event_id is null then
      raise exception 'يجب اختيار فعالية لهذا الدور';
    end if;
    if not exists (
      select 1 from public.events e
      where e.id = p_event_id and e.status in ('draft','published')
    ) then
      raise exception 'الفعالية المحددة غير متاحة للإسناد';
    end if;
  elsif p_event_id is not null then
    raise exception 'لا يتم ربط هذا الدور بفعالية';
  end if;

  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;

  delete from public.event_role_assignments
  where user_id = p_user_id;

  if p_role in ('gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values (p_user_id,p_event_id,p_role);
  end if;
end;
$function$;

-- private.capture_admin_activity()
CREATE OR REPLACE FUNCTION private.capture_admin_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := auth.uid(); v_actor_name text := 'مستخدم غير معروف'; v_actor_role text := 'unknown';
 v_old jsonb; v_new jsonb; v_row jsonb; v_entity_id uuid; v_event_id uuid; v_booking_id uuid;
 v_label text; v_action text; v_entity_type text; v_details jsonb := '{}'::jsonb;
begin
 if v_actor is null then if tg_op='DELETE' then return old; else return new; end if; end if;
 select coalesce(p.full_name,'بدون اسم'),coalesce(p.role,'unknown') into v_actor_name,v_actor_role from public.profiles p where p.id=v_actor;
 v_actor_name:=coalesce(v_actor_name,'بدون اسم'); v_actor_role:=coalesce(v_actor_role,'unknown');
 if v_actor_role not in ('owner','admin','supervisor','gatekeeper','organizer') then if tg_op='DELETE' then return old; else return new; end if; end if;
 if v_actor_role in ('gatekeeper','organizer') and tg_table_name <> 'tickets' then if tg_op='DELETE' then return old; else return new; end if; end if;
 if v_actor_role='supervisor' and tg_table_name not in ('bookings','payment_submissions') then if tg_op='DELETE' then return old; else return new; end if; end if;
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 begin v_entity_id:=nullif(v_row->>'id','')::uuid; exception when others then v_entity_id:=null; end;
 begin v_event_id:=nullif(v_row->>'event_id','')::uuid; exception when others then v_event_id:=null; end;
 begin v_booking_id:=nullif(v_row->>'booking_id','')::uuid; exception when others then v_booking_id:=null; end;
 if tg_table_name='events' then v_event_id:=v_entity_id; end if;
 if tg_table_name='bookings' then v_booking_id:=v_entity_id; v_event_id:=nullif(v_row->>'event_id','')::uuid; end if;
 if tg_table_name='payment_submissions' and v_booking_id is not null then select b.event_id into v_event_id from public.bookings b where b.id=v_booking_id; end if;
 if tg_op='DELETE' and tg_table_name='events' then v_event_id:=null; end if;
 if tg_op='DELETE' and tg_table_name='bookings' then v_booking_id:=null; end if;
 v_label:=coalesce(v_row->>'title',v_row->>'booking_number',v_row->>'full_name',v_row->>'ticket_code',v_row->>'name',v_row->>'account_name',v_row->>'id');
 if tg_op='INSERT' then v_action:=tg_table_name||'.created'; elsif tg_op='DELETE' then v_action:=tg_table_name||'.deleted'; else v_action:=tg_table_name||'.updated'; end if;
 if tg_table_name='events' then v_entity_type:='event'; elsif tg_table_name='profiles' then v_entity_type:='user';
 elsif tg_table_name='bookings' then v_entity_type:='booking'; elsif tg_table_name='payment_submissions' then v_entity_type:='payment';
 elsif tg_table_name='tickets' then v_entity_type:='ticket'; elsif tg_table_name='ticket_types' then v_entity_type:='ticket_type';
 elsif tg_table_name='event_payment_accounts' then v_entity_type:='payment_account'; else v_entity_type:=tg_table_name; end if;
 if tg_op='UPDATE' then
  if tg_table_name='profiles' and v_old->>'role' is distinct from v_new->>'role' then v_action:='user.role_changed';
  elsif tg_table_name='events' and v_old->>'status' is distinct from v_new->>'status' and v_new->>'status'='cancelled' then v_action:='event.cancelled';
  elsif tg_table_name='events' and v_old->>'status' is distinct from v_new->>'status' and v_new->>'status'='published' then v_action:='event.published';
  elsif tg_table_name='bookings' and v_old->>'status' is distinct from v_new->>'status' then v_action:='booking.'||coalesce(v_new->>'status','status_changed');
  elsif tg_table_name='payment_submissions' and v_old->>'status' is distinct from v_new->>'status' then v_action:='payment.'||coalesce(v_new->>'status','status_changed');
  elsif tg_table_name='tickets' and (v_old->>'status' is distinct from v_new->>'status' or v_old->>'used_at' is distinct from v_new->>'used_at') then
   if v_new->>'status'='used' or (v_old->>'used_at' is null and v_new->>'used_at' is not null) then v_action:='ticket.checked_in';
   elsif v_old->>'status'='used' or (v_old->>'used_at' is not null and v_new->>'used_at' is null) then v_action:='ticket.checkin_reversed';
   else v_action:='ticket.status_changed'; end if;
  end if;
 end if;
 if tg_table_name='profiles' then v_label:=coalesce(v_row->>'full_name','عميل'); end if;
 if tg_table_name='events' then v_label:=coalesce(v_row->>'title','فعالية'); end if;
 if tg_table_name='bookings' then v_label:=coalesce(v_row->>'booking_number','حجز'); end if;
 if tg_table_name='tickets' then v_label:=coalesce(v_row->>'ticket_code','تذكرة'); end if;
 if tg_op='UPDATE' then
  select coalesce(jsonb_object_agg(key,jsonb_build_object('before',v_old->key,'after',v_new->key)),'{}'::jsonb)
   into v_details from jsonb_object_keys(v_new) as k(key)
   where v_old->key is distinct from v_new->key and key not in ('email','phone','customer_email','customer_phone','receipt_path','account_number','payment_account_number','qr_token');
 elsif tg_op='INSERT' then v_details:=jsonb_build_object('status',v_new->>'status'); else v_details:=jsonb_build_object('deleted',true); end if;
 insert into public.admin_activity_log(actor_id,actor_name,actor_role,action,entity_type,entity_id,entity_label,event_id,booking_id,details)
 values(v_actor,v_actor_name,v_actor_role,v_action,v_entity_type,v_entity_id,v_label,v_event_id,v_booking_id,v_details);
 if tg_op='DELETE' then return old; end if; return new;
end; $function$;

-- private.current_profile_role()
CREATE OR REPLACE FUNCTION private.current_profile_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.role from public.profiles p where p.id = (select auth.uid()) limit 1
$function$;

-- private.current_user_is_owner()
CREATE OR REPLACE FUNCTION private.current_user_is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'owner'); $function$;

-- private.dispatch_haddir_web_push()
CREATE OR REPLACE FUNCTION private.dispatch_haddir_web_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hook_secret text;
  destination text;
begin
  select ds.decrypted_secret
    into hook_secret
  from vault.decrypted_secrets ds
  where ds.name = 'haddir_push_hook_secret'
  limit 1;

  if hook_secret is null then
    return new;
  end if;

  destination := case
    when new.type in ('ticket_approved', 'event_reminder_3d', 'event_reminder_24h', 'event_reminder_6h')
      then '/?tab=tickets'
    else '/?tab=notifications'
  end;

  perform net.http_post(
    url := 'https://puhmvcekxkcxfdvgygpk.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-haddir-push-hook', hook_secret
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'notification_id', new.id,
      'title', new.title,
      'message', new.message,
      'type', new.type,
      'url', destination
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$function$;

-- private.enqueue_booking_notification_email()
CREATE OR REPLACE FUNCTION private.enqueue_booking_notification_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.type in ('ticket_approved','payment_rejected') then
    insert into public.email_outbox(notification_id, booking_id, recipient_user_id, notification_type)
    values (new.id, new.booking_id, new.user_id, new.type)
    on conflict (notification_id) do nothing;
  end if;
  return new;
end;
$function$;

-- private.expire_pending_bookings()
CREATE OR REPLACE FUNCTION private.expire_pending_bookings()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_booking record;
  v_item record;
  v_expired_count integer := 0;
begin
  perform pg_advisory_xact_lock(748231905441::bigint);

  for v_booking in
    select b.id, b.user_id, b.booking_number
    from public.bookings b
    where b.status = 'pending_payment'
      and b.expires_at is not null
      and b.expires_at <= now()
    order by b.expires_at, b.id
    for update skip locked
  loop
    update public.bookings
       set status = 'expired', updated_at = now()
     where id = v_booking.id
       and status = 'pending_payment';

    if not found then
      continue;
    end if;

    for v_item in
      select bi.ticket_type_id, bi.quantity
      from public.booking_items bi
      where bi.booking_id = v_booking.id
      order by bi.ticket_type_id
    loop
      update public.ticket_types
         set quantity_sold = greatest(0, quantity_sold - v_item.quantity),
             updated_at = now()
       where id = v_item.ticket_type_id;
    end loop;

    if v_booking.user_id is not null then
      insert into public.notifications(user_id, booking_id, title, message, type)
      values (
        v_booking.user_id,
        v_booking.id,
        'انتهت مهلة الحجز',
        'انتهت مهلة الدفع للحجز رقم ' || v_booking.booking_number ||
        ' وتم تحرير كمية التذاكر المحجوزة. يمكنك إنشاء حجز جديد إذا كانت التذاكر لا تزال متاحة.',
        'booking_expired'
      );
    end if;

    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$function$;

-- private.gatekeeper_manual_ticket_action(p_ticket_code text, p_confirm boolean)
CREATE OR REPLACE FUNCTION private.gatekeeper_manual_ticket_action(p_ticket_code text, p_confirm boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

-- private.gatekeeper_ticket_action(p_ticket_code text, p_confirm boolean)
CREATE OR REPLACE FUNCTION private.gatekeeper_ticket_action(p_ticket_code text, p_confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

-- private.gatekeeper_ticket_action_core(p_ticket_code text, p_confirm boolean)
CREATE OR REPLACE FUNCTION private.gatekeeper_ticket_action_core(p_ticket_code text, p_confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- private.generate_event_reminders()
CREATE OR REPLACE FUNCTION private.generate_event_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  inserted_count integer := 0;
begin
  with reminder_windows as (
    select *
    from (values
      ('event_reminder_3d'::text, interval '3 days', 'بعد 3 أيام'::text),
      ('event_reminder_24h'::text, interval '24 hours', 'بعد 24 ساعة'::text),
      ('event_reminder_6h'::text, interval '6 hours', 'بعد 6 ساعات'::text)
    ) as r(notification_type, lead_time, label)
  ),
  due as (
    select
      b.user_id,
      b.id as booking_id,
      e.title as event_title,
      e.venue,
      e.starts_at,
      rw.notification_type,
      rw.label
    from public.bookings b
    join public.events e on e.id = b.event_id
    cross join reminder_windows rw
    where b.status = 'confirmed'
      and b.user_id is not null
      and e.status = 'published'
      and e.starts_at > now() + rw.lead_time - interval '5 minutes'
      and e.starts_at <= now() + rw.lead_time
  )
  insert into public.notifications (user_id, booking_id, title, message, type, is_read)
  select
    due.user_id,
    due.booking_id,
    'تذكير بفعاليتك القادمة',
    'فعالية ' || due.event_title || ' تبدأ ' || due.label ||
      '. الموعد: ' || to_char(due.starts_at at time zone 'Africa/Khartoum', 'DD/MM/YYYY HH24:MI') ||
      case when nullif(due.venue, '') is not null then '. المكان: ' || due.venue else '' end ||
      '. افتح تذاكري لعرض تذكرتك.',
    due.notification_type,
    false
  from due
  on conflict (booking_id, type)
    where booking_id is not null
      and type in ('event_reminder_3d', 'event_reminder_24h', 'event_reminder_6h')
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

-- private.get_advertiser_event_statistics()
CREATE OR REPLACE FUNCTION private.get_advertiser_event_statistics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_result jsonb;
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.role = 'advertiser'
  ) then
    raise exception 'هذه الإحصائيات متاحة لحسابات المعلنين فقط';
  end if;

  select a.event_id into v_event_id
  from public.event_role_assignments a
  where a.user_id = v_user_id and a.assignment_role = 'advertiser';

  if v_event_id is null then
    raise exception 'لا توجد فعالية مرتبطة بحساب المعلن';
  end if;

  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'starts_at', e.starts_at,
      'ends_at', e.ends_at, 'venue', e.venue, 'city', e.city,
      'status', e.status, 'platform_fee_percent', coalesce(e.platform_fee_percent, 0)
    ),
    'totals', jsonb_build_object(
      'confirmed_bookings', (select count(*) from public.bookings b where b.event_id = e.id and b.status = 'confirmed'),
      'rejected_bookings', (select count(*) from public.bookings b where b.event_id = e.id and b.status = 'rejected'),
      'bookers', (select count(distinct b.user_id) from public.bookings b where b.event_id = e.id and b.status = 'confirmed'),
      'confirmed_tickets', (select coalesce(sum(bi.quantity), 0) from public.booking_items bi join public.bookings b on b.id = bi.booking_id where b.event_id = e.id and b.status = 'confirmed'),
      'rejected_tickets', (select coalesce(sum(bi.quantity), 0) from public.booking_items bi join public.bookings b on b.id = bi.booking_id where b.event_id = e.id and b.status = 'rejected')
    ),
    'financials', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', x.currency, 'sales', x.sales,
        'platform_fee', round(x.sales * coalesce(e.platform_fee_percent,0) / 100, 2),
        'advertiser_net', x.sales - round(x.sales * coalesce(e.platform_fee_percent,0) / 100, 2)
      ) order by x.currency)
      from (
        select b.currency, sum(b.subtotal)::numeric as sales
        from public.bookings b
        where b.event_id = e.id and b.status = 'confirmed'
        group by b.currency
      ) x
    ), '[]'::jsonb),
    'ticket_types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tt.id, 'name', tt.name, 'price', tt.price, 'currency', tt.currency,
        'quantity_total', tt.quantity_total,
        'confirmed_quantity', coalesce(s.confirmed_quantity,0),
        'reserved_quantity', coalesce(s.reserved_quantity,0),
        'rejected_quantity', coalesce(s.rejected_quantity,0),
        -- quantity_sold includes confirmed tickets and active reservations.
        'remaining_quantity', greatest(0, tt.quantity_total - coalesce(tt.quantity_sold,0)),
        'sales', coalesce(s.sales,0)
      ) order by tt.created_at)
      from public.ticket_types tt
      left join lateral (
        select
          sum(bi.quantity) filter (where b.status = 'confirmed')::integer as confirmed_quantity,
          sum(bi.quantity) filter (where b.status in ('pending_payment','under_review'))::integer as reserved_quantity,
          sum(bi.quantity) filter (where b.status = 'rejected')::integer as rejected_quantity,
          sum(bi.line_total) filter (where b.status = 'confirmed')::numeric as sales
        from public.booking_items bi
        join public.bookings b on b.id = bi.booking_id
        where bi.ticket_type_id = tt.id and b.event_id = e.id
      ) s on true
      where tt.event_id = e.id
    ), '[]'::jsonb)
  ) into v_result
  from public.events e
  where e.id = v_event_id;

  return v_result;
end;
$function$;

-- private.get_gatekeeper_scan_history(p_event_id uuid)
CREATE OR REPLACE FUNCTION private.get_gatekeeper_scan_history(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_history jsonb;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if coalesce(v_role, '') not in ('gatekeeper', 'organizer') then
    raise exception 'هذه الخدمة مخصصة للبواب فقط';
  end if;
  if not exists (
    select 1 from public.event_role_assignments a
    where a.user_id = v_uid and a.event_id = p_event_id
      and a.assignment_role in ('gatekeeper', 'organizer')
  ) then raise exception 'هذه الفعالية غير مصرح بها لحسابك'; end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', l.id,
      'ticket_code', coalesce(l.entered_code, t.ticket_code),
      'outcome', l.outcome,
      'scanned_at', l.scanned_at,
      'ticket_id', l.ticket_id,
      'entry_method', l.entry_method,
      'gatekeeper_name', coalesce(nullif(p.full_name, ''), 'بواب الفعالية')
    ) order by l.scanned_at desc),
    '[]'::jsonb
  ) into v_history
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

-- private.get_gatekeeper_scan_stats(p_event_id uuid)
CREATE OR REPLACE FUNCTION private.get_gatekeeper_scan_stats(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_stats jsonb;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if coalesce(v_role, '') not in ('gatekeeper', 'organizer') then
    raise exception 'هذه الخدمة مخصصة للبواب فقط';
  end if;
  if not exists (
    select 1 from public.event_role_assignments a
    where a.user_id = v_uid and a.event_id = p_event_id
      and a.assignment_role in ('gatekeeper', 'organizer')
  ) then raise exception 'هذه الفعالية غير مصرح بها لحسابك'; end if;

  select jsonb_build_object(
    'accepted', count(*) filter (where l.outcome = 'accepted'),
    'used', count(*) filter (where l.outcome = 'used'),
    'forged', count(*) filter (where l.outcome = 'forged'),
    'invalid', count(*) filter (where l.outcome = 'invalid')
  ) into v_stats
  from public.gatekeeper_scan_logs l
  where l.event_id = p_event_id;

  return coalesce(v_stats, '{"accepted":0,"used":0,"forged":0,"invalid":0}'::jsonb);
end;
$function$;

-- private.handle_new_user()
CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- private.save_admin_event(p_event_id uuid, p_event jsonb, p_tickets jsonb, p_accounts jsonb)
CREATE OR REPLACE FUNCTION private.save_admin_event(p_event_id uuid, p_event jsonb, p_tickets jsonb, p_accounts jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_event_id uuid;
  v_slug text;
  v_ticket jsonb;
  v_account jsonb;
  v_old record;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_role := private.current_profile_role();
  if v_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية إدارة الفعاليات'; end if;

  if p_event is null or jsonb_typeof(p_event) <> 'object'
     or p_tickets is null or jsonb_typeof(p_tickets) <> 'array' or jsonb_array_length(p_tickets)=0
     or p_accounts is null or jsonb_typeof(p_accounts) <> 'array' then
    raise exception 'بيانات الفعالية أو التذاكر أو حسابات الدفع غير مكتملة';
  end if;
  if nullif(btrim(p_event->>'title'),'') is null
     or nullif(btrim(p_event->>'city'),'') is null
     or nullif(btrim(p_event->>'venue'),'') is null then
    raise exception 'اسم الفعالية والمدينة والمكان حقول مطلوبة';
  end if;
  if coalesce((p_event->>'is_continuous')::boolean,false)=false
     and nullif(p_event->>'starts_at','') is null then
    raise exception 'موعد بداية الفعالية مطلوب ما لم تكن مستمرة';
  end if;
  if nullif(p_event->>'ends_at','') is not null and nullif(p_event->>'starts_at','') is not null
     and (p_event->>'ends_at')::timestamptz <= (p_event->>'starts_at')::timestamptz then
    raise exception 'موعد نهاية الفعالية يجب أن يكون بعد البداية';
  end if;
  if coalesce((p_event->>'platform_fee_percent')::numeric,0) not between 0 and 100 then
    raise exception 'نسبة عمولة المنصة يجب أن تكون بين صفر و100';
  end if;

  if p_event_id is not null then
    select e.id into v_event_id from public.events e where e.id=p_event_id for update;
    if v_event_id is null then raise exception 'الفعالية المطلوب تعديلها غير موجودة'; end if;
    perform 1 from public.ticket_types tt where tt.event_id=v_event_id for update;
    update public.events set
      title=btrim(p_event->>'title'),
      description=nullif(btrim(p_event->>'description'),''),
      category=nullif(btrim(p_event->>'category'),''),
      city=nullif(btrim(p_event->>'city'),''),
      venue=nullif(btrim(p_event->>'venue'),''),
      address=nullif(btrim(p_event->>'address'),''),
      location_url=nullif(btrim(p_event->>'location_url'),''),
      starts_at=case when coalesce((p_event->>'is_continuous')::boolean,false) then null else nullif(p_event->>'starts_at','')::timestamptz end,
      ends_at=case when coalesce((p_event->>'is_continuous')::boolean,false) then null else nullif(p_event->>'ends_at','')::timestamptz end,
      is_continuous=coalesce((p_event->>'is_continuous')::boolean,false),
      cover_image_url=nullif(btrim(p_event->>'cover_image_url'),''),
      is_trending=coalesce((p_event->>'is_trending')::boolean,false),
      platform_fee_percent=coalesce((p_event->>'platform_fee_percent')::numeric,0),
      updated_at=now()
    where id=v_event_id;
  else
    v_slug:=nullif(btrim(p_event->>'slug'),'');
    if v_slug is null then raise exception 'معرّف رابط الفعالية مطلوب'; end if;
    insert into public.events(
      title,slug,description,category,city,venue,address,location_url,starts_at,ends_at,
      is_continuous,cover_image_url,is_trending,platform_fee_percent,status,created_by
    ) values (
      btrim(p_event->>'title'),v_slug,nullif(btrim(p_event->>'description'),''),
      nullif(btrim(p_event->>'category'),''),nullif(btrim(p_event->>'city'),''),
      nullif(btrim(p_event->>'venue'),''),nullif(btrim(p_event->>'address'),''),
      nullif(btrim(p_event->>'location_url'),''),
      case when coalesce((p_event->>'is_continuous')::boolean,false) then null else nullif(p_event->>'starts_at','')::timestamptz end,
      case when coalesce((p_event->>'is_continuous')::boolean,false) then null else nullif(p_event->>'ends_at','')::timestamptz end,
      coalesce((p_event->>'is_continuous')::boolean,false),nullif(btrim(p_event->>'cover_image_url'),''),
      coalesce((p_event->>'is_trending')::boolean,false),coalesce((p_event->>'platform_fee_percent')::numeric,0),
      'draft',auth.uid()
    ) returning id into v_event_id;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_tickets) item
    where nullif(item->>'id','') is not null
      and not exists(select 1 from public.ticket_types tt where tt.id=(item->>'id')::uuid and tt.event_id=v_event_id)
  ) then raise exception 'إحدى فئات التذاكر لا تتبع هذه الفعالية'; end if;

  -- Validate all tickets before changing or deleting any of them.
  for v_ticket in select value from jsonb_array_elements(p_tickets) loop
    if nullif(btrim(v_ticket->>'name'),'') is null
       or nullif(v_ticket->>'price','') is null
       or (v_ticket->>'price')::numeric < 0
       or (nullif(v_ticket->>'quantity_total','') is not null and
           (nullif(v_ticket->>'quantity_total','')::integer < 1 or
            nullif(v_ticket->>'quantity_total','')::integer <
              coalesce((select tt.quantity_sold from public.ticket_types tt
                where tt.id=nullif(v_ticket->>'id','')::uuid and tt.event_id=v_event_id),0)))
       or (nullif(v_ticket->>'sales_start_at','') is not null and nullif(v_ticket->>'sales_end_at','') is not null
           and (v_ticket->>'sales_end_at')::timestamptz <= (v_ticket->>'sales_start_at')::timestamptz) then
      raise exception 'راجع اسم وسعر وكمية ومواعيد بيع التذاكر';
    end if;
  end loop;

  -- Remove omitted existing types first. New types are inserted only after this pass.
  for v_old in select tt.id,tt.quantity_sold from public.ticket_types tt
    where tt.event_id=v_event_id for update loop
    if not exists(select 1 from jsonb_array_elements(p_tickets) item where nullif(item->>'id','')=v_old.id::text) then
      if v_old.quantity_sold>0 or exists(select 1 from public.booking_items bi where bi.ticket_type_id=v_old.id) then
        update public.ticket_types set is_active=false,updated_at=now() where id=v_old.id;
      else
        delete from public.ticket_types where id=v_old.id;
      end if;
    end if;
  end loop;

  for v_ticket in select value from jsonb_array_elements(p_tickets) loop
    if nullif(v_ticket->>'id','') is not null then
      update public.ticket_types set
        name=btrim(v_ticket->>'name'),description=nullif(btrim(v_ticket->>'description'),''),
        price=(v_ticket->>'price')::numeric,currency=coalesce(nullif(btrim(v_ticket->>'currency'),''),'SDG'),
        quantity_total=nullif(v_ticket->>'quantity_total','')::integer,
        sales_start_at=nullif(v_ticket->>'sales_start_at','')::timestamptz,
        sales_end_at=nullif(v_ticket->>'sales_end_at','')::timestamptz,
        is_active=coalesce((v_ticket->>'is_active')::boolean,true),updated_at=now()
      where id=(v_ticket->>'id')::uuid and event_id=v_event_id;
    else
      insert into public.ticket_types(event_id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active)
      values(v_event_id,btrim(v_ticket->>'name'),nullif(btrim(v_ticket->>'description'),''),
        (v_ticket->>'price')::numeric,coalesce(nullif(btrim(v_ticket->>'currency'),''),'SDG'),
        nullif(v_ticket->>'quantity_total','')::integer,0,
        nullif(v_ticket->>'sales_start_at','')::timestamptz,nullif(v_ticket->>'sales_end_at','')::timestamptz,
        coalesce((v_ticket->>'is_active')::boolean,true));
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_accounts) item
    where nullif(item->>'id','') is not null
      and not exists(select 1 from public.event_payment_accounts a where a.id=item->>'id' and a.event_id=v_event_id)
  ) then raise exception 'إحدى حسابات الدفع لا تتبع هذه الفعالية'; end if;

  -- Remove omitted accounts before inserting new accounts so they are not mistaken for omitted rows.
  delete from public.event_payment_accounts a
  where a.event_id=v_event_id
    and not exists(select 1 from jsonb_array_elements(p_accounts) item where nullif(item->>'id','')=a.id);

  for v_account in select value from jsonb_array_elements(p_accounts) loop
    if nullif(btrim(v_account->>'account_name'),'') is null
       or nullif(btrim(v_account->>'account_number'),'') is null
       or nullif(btrim(v_account->>'beneficiary'),'') is null then
      raise exception 'أكمل اسم ورقم الحساب واسم المستفيد';
    end if;
    if nullif(v_account->>'id','') is not null then
      update public.event_payment_accounts set
        account_name=btrim(v_account->>'account_name'),account_number=btrim(v_account->>'account_number'),
        beneficiary=nullif(btrim(v_account->>'beneficiary'),''),is_active=coalesce((v_account->>'is_active')::boolean,true),
        sort_order=coalesce((v_account->>'sort_order')::integer,10),updated_at=now()
      where id=v_account->>'id' and event_id=v_event_id;
    else
      insert into public.event_payment_accounts(event_id,account_name,account_number,beneficiary,is_active,sort_order)
      values(v_event_id,btrim(v_account->>'account_name'),btrim(v_account->>'account_number'),
        nullif(btrim(v_account->>'beneficiary'),''),coalesce((v_account->>'is_active')::boolean,true),
        coalesce((v_account->>'sort_order')::integer,10));
    end if;
  end loop;
  return v_event_id;
end;
$function$;

-- public.admin_search_profiles(p_query text, p_limit integer, p_offset integer, p_role text)
CREATE OR REPLACE FUNCTION public.admin_search_profiles(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_role text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, full_name text, phone text, email text, role text, created_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.admin_search_profiles(p_query,p_limit,p_offset,p_role);
$function$;

-- public.admin_update_profile_role(p_user_id uuid, p_role text, p_event_id uuid)
CREATE OR REPLACE FUNCTION public.admin_update_profile_role(p_user_id uuid, p_role text, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_update_profile_role(p_user_id,p_role,p_event_id);
$function$;

-- public.create_booking(p_event_id uuid, p_ticket_type_id uuid, p_quantity integer)
CREATE OR REPLACE FUNCTION public.create_booking(p_event_id uuid, p_ticket_type_id uuid, p_quantity integer)
 RETURNS TABLE(booking_id uuid, booking_number text, subtotal numeric, currency character)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.ticket_types%rowtype;
  v_event public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
  v_booking_id uuid;
  v_booking_number text;
  v_total numeric;
  v_expired_quantity integer := 0;
begin
  if v_user_id is null then raise exception 'يجب تسجيل الدخول لإتمام الحجز'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 5 then
    raise exception 'عدد التذاكر يجب أن يكون بين 1 و5';
  end if;
  perform pg_advisory_xact_lock(748231905441::bigint);
  select * into v_ticket from public.ticket_types
   where id=p_ticket_type_id and event_id=p_event_id for update;
  if not found or not v_ticket.is_active then raise exception 'فئة التذكرة غير متاحة'; end if;
  select * into v_event from public.events where id=p_event_id;
  if not found or v_event.status <> 'published' or (not coalesce(v_event.is_continuous,false) and (v_event.starts_at is null or v_event.starts_at <= now())) then
    raise exception 'الفعالية غير متاحة للحجز';
  end if;
  if (v_ticket.sales_start_at is not null and now()<v_ticket.sales_start_at)
     or (v_ticket.sales_end_at is not null and now()>v_ticket.sales_end_at) then
    raise exception 'فترة بيع هذه التذكرة غير متاحة حالياً';
  end if;
  with expired as (
    update public.bookings b set status='expired',updated_at=now()
     where b.status='pending_payment' and b.expires_at is not null and b.expires_at<=now()
       and exists(select 1 from public.booking_items bi where bi.booking_id=b.id and bi.ticket_type_id=p_ticket_type_id)
     returning b.id
  )
  select coalesce(sum(bi.quantity),0)::integer into v_expired_quantity
    from public.booking_items bi join expired e on e.id=bi.booking_id
   where bi.ticket_type_id=p_ticket_type_id;
  if v_expired_quantity>0 then
    update public.ticket_types set quantity_sold=greatest(0,quantity_sold-v_expired_quantity),updated_at=now()
     where id=p_ticket_type_id;
    select * into v_ticket from public.ticket_types where id=p_ticket_type_id;
  end if;
  if v_ticket.quantity_total is not null and v_ticket.quantity_sold+p_quantity>v_ticket.quantity_total then
    raise exception 'الكمية المطلوبة غير متوفرة. المتاح حالياً: %',greatest(0,v_ticket.quantity_total-v_ticket.quantity_sold);
  end if;
  select * into v_profile from public.profiles where id=v_user_id;
  select email into v_email from auth.users where id=v_user_id;
  if coalesce(nullif(trim(v_profile.full_name),''),'')='' or coalesce(nullif(trim(v_profile.phone),''),'')='' then
    raise exception 'أكمل اسمك ورقم هاتفك في الملف الشخصي قبل الحجز';
  end if;
  v_total:=v_ticket.price*p_quantity;
  v_booking_id:=gen_random_uuid();
  v_booking_number:='HDR-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.bookings(id,booking_number,user_id,customer_name,customer_email,customer_phone,event_id,subtotal,currency,status,expires_at)
  values(v_booking_id,v_booking_number,v_user_id,v_profile.full_name,v_email,v_profile.phone,p_event_id,v_total,v_ticket.currency,'pending_payment',now()+interval '20 minutes');
  insert into public.booking_items(booking_id,ticket_type_id,quantity,unit_price,line_total)
  values(v_booking_id,p_ticket_type_id,p_quantity,v_ticket.price,v_total);
  update public.ticket_types set quantity_sold=quantity_sold+p_quantity,updated_at=now() where id=p_ticket_type_id;
  return query select v_booking_id,v_booking_number,v_total,v_ticket.currency;
end;
$function$;

-- public.gatekeeper_manual_ticket_action(p_ticket_code text, p_confirm boolean)
CREATE OR REPLACE FUNCTION public.gatekeeper_manual_ticket_action(p_ticket_code text, p_confirm boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.gatekeeper_manual_ticket_action(p_ticket_code,p_confirm);
$function$;

-- public.gatekeeper_ticket_action(p_ticket_code text, p_confirm boolean)
CREATE OR REPLACE FUNCTION public.gatekeeper_ticket_action(p_ticket_code text, p_confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.gatekeeper_ticket_action(p_ticket_code,p_confirm);
$function$;

-- public.get_advertiser_event_statistics()
CREATE OR REPLACE FUNCTION public.get_advertiser_event_statistics()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.get_advertiser_event_statistics();
$function$;

-- public.get_gatekeeper_manual_history(p_event_id uuid)
CREATE OR REPLACE FUNCTION public.get_gatekeeper_manual_history(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;

-- public.get_gatekeeper_scan_history(p_event_id uuid)
CREATE OR REPLACE FUNCTION public.get_gatekeeper_scan_history(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.get_gatekeeper_scan_history(p_event_id);
$function$;

-- public.get_gatekeeper_scan_stats(p_event_id uuid)
CREATE OR REPLACE FUNCTION public.get_gatekeeper_scan_stats(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.get_gatekeeper_scan_stats(p_event_id);
$function$;

-- public.get_haddir_push_config()
CREATE OR REPLACE FUNCTION public.get_haddir_push_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'public_key', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'haddir_vapid_public_key' limit 1),
    'private_key', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'haddir_vapid_private_key' limit 1),
    'hook_secret', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'haddir_push_hook_secret' limit 1)
  );
$function$;

-- public.review_payment_submission(p_submission_id uuid, p_decision text, p_rejection_reason text)
CREATE OR REPLACE FUNCTION public.review_payment_submission(p_submission_id uuid, p_decision text, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_role text;
 v_payment public.payment_submissions%rowtype;
 v_booking public.bookings%rowtype;
 v_item record;
 v_ticket_code text;
 v_ticket_count integer := 0;
 v_attendee_count integer := 0;
begin
 v_role := private.current_profile_role();
 if coalesce(v_role,'') not in ('owner','admin','supervisor') then
  raise exception 'غير مصرح لك بمراجعة المدفوعات';
 end if;
 if p_decision not in ('approve','reject') then
  raise exception 'قرار المراجعة غير صحيح';
 end if;
 if p_decision='reject' and nullif(trim(coalesce(p_rejection_reason,'')),'') is null then
  raise exception 'اكتب سبب رفض إثبات الدفع';
 end if;
 perform pg_advisory_xact_lock(748231905441::bigint);
 select * into v_payment from public.payment_submissions where id=p_submission_id for update;
 if not found then raise exception 'إثبات الدفع غير موجود'; end if;
 if v_payment.status <> 'submitted' then raise exception 'تمت مراجعة إثبات الدفع مسبقاً'; end if;
 select * into v_booking from public.bookings where id=v_payment.booking_id for update;
 if not found then raise exception 'الحجز غير موجود'; end if;
 if v_booking.user_id is null then raise exception 'الحجز غير مرتبط بحساب مستخدم'; end if;
 if p_decision='approve' then
  select coalesce(sum(bi.quantity),0)::integer into v_attendee_count
  from public.booking_items bi where bi.booking_id=v_booking.id;
  for v_item in
   select bi.*,tt.name as ticket_name
   from public.booking_items bi
   join public.ticket_types tt on tt.id=bi.ticket_type_id
   where bi.booking_id=v_booking.id
  loop
   loop
    v_ticket_code := lpad(floor(random()*10000000000)::bigint::text,10,'0');
    exit when not exists(select 1 from public.tickets where ticket_code=v_ticket_code);
   end loop;
   insert into public.tickets(
    booking_item_id,booking_id,event_id,ticket_type_id,ticket_code,attendee_name,status
   ) values (
    v_item.id,v_booking.id,v_booking.event_id,v_item.ticket_type_id,
    v_ticket_code,v_booking.customer_name,'valid'
   );
   v_ticket_count := v_ticket_count+1;
  end loop;
  update public.payment_submissions
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=null
  where id=v_payment.id;
  update public.bookings
  set status='confirmed',expires_at=null,updated_at=now()
  where id=v_booking.id;
  insert into public.notifications(user_id,booking_id,title,message,type)
  values(
   v_booking.user_id,v_booking.id,'تم قبول حجزك وإصدار تذكرتك',
   'تم اعتماد الدفع لحجزك رقم '||v_booking.booking_number||
   '. أُصدرت '||v_ticket_count||' تذكرة تشمل '||v_attendee_count||
   ' من الأشخاص، ويمكنك مشاهدة كود الدخول في قسم تذاكري.','ticket_approved'
  );
 else
  update public.payment_submissions
  set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(p_rejection_reason)
  where id=v_payment.id;
  for v_item in
   select ticket_type_id,quantity from public.booking_items where booking_id=v_booking.id
  loop
   update public.ticket_types
   set quantity_sold=greatest(0,quantity_sold-v_item.quantity),updated_at=now()
   where id=v_item.ticket_type_id;
  end loop;
  update public.bookings set status='rejected',updated_at=now() where id=v_booking.id;
  insert into public.notifications(user_id,booking_id,title,message,type)
  values(
   v_booking.user_id,v_booking.id,'تعذر قبول إثبات الدفع',
   'تم رفض إثبات الدفع للحجز رقم '||v_booking.booking_number||
   '. السبب: '||trim(p_rejection_reason),'payment_rejected'
  );
 end if;
 return jsonb_build_object(
  'success',true,'decision',p_decision,'tickets_created',v_ticket_count,
  'attendee_count',v_attendee_count,'booking_id',v_booking.id
 );
end;
$function$;

-- public.save_admin_event(p_event_id uuid, p_event jsonb, p_tickets jsonb, p_accounts jsonb)
CREATE OR REPLACE FUNCTION public.save_admin_event(p_event_id uuid, p_event jsonb, p_tickets jsonb, p_accounts jsonb)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.save_admin_event(p_event_id, p_event, p_tickets, p_accounts);
$function$;

-- public.set_updated_at()
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$function$;

-- public.submit_payment(p_booking_id uuid, p_payment_method_id text, p_receipt_path text, p_transfer_reference text)
CREATE OR REPLACE FUNCTION public.submit_payment(p_booking_id uuid, p_payment_method_id text, p_receipt_path text, p_transfer_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_submission uuid;
  v_account_name text;
  v_account_number text;
  v_account_beneficiary text;
begin
  if v_user is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if p_booking_id is null or p_payment_method_id is null or btrim(p_payment_method_id) = '' then
    raise exception 'اختر حساب الدفع الخاص بهذه الفعالية';
  end if;

  if p_receipt_path is null
     or p_receipt_path !~ ('^'||v_user::text||'/'||p_booking_id::text||'/[A-Za-z0-9._-]+$') then
    raise exception 'مسار الإيصال غير صالح';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
    and user_id = v_user
  for update;

  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  select epa.account_name, epa.account_number, epa.beneficiary
    into v_account_name, v_account_number, v_account_beneficiary
  from public.event_payment_accounts epa
  where epa.id = p_payment_method_id
    and epa.event_id = v_booking.event_id
    and epa.is_active = true;

  if not found or v_account_name is null or v_account_number is null then
    raise exception 'حساب الدفع غير متاح لهذه الفعالية';
  end if;

  if v_booking.status <> 'pending_payment'
     or v_booking.expires_at is null
     or v_booking.expires_at <= now() then
    raise exception 'انتهت مهلة الحجز أو تم إرسال إثبات دفع مسبقاً';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'payment-receipts'
      and so.name = p_receipt_path
  ) then
    raise exception 'لم يتم العثور على الإيصال المرفوع';
  end if;

  insert into public.payment_submissions (
    booking_id, submitted_by, transfer_reference, receipt_path,
    amount, currency, status, payment_account_id,
    payment_account_name, payment_account_number, payment_account_beneficiary
  )
  values (
    p_booking_id, v_user, nullif(btrim(p_transfer_reference), ''),
    p_receipt_path, v_booking.subtotal, v_booking.currency, 'submitted',
    p_payment_method_id, v_account_name, v_account_number, v_account_beneficiary
  )
  returning id into v_submission;

  update public.bookings
  set status = 'under_review', updated_at = now()
  where id = p_booking_id;

  return v_submission;
end;
$function$;

-- public.sync_haddir_push_subscription(p_endpoint text, p_subscription jsonb, p_device_label text)
CREATE OR REPLACE FUNCTION public.sync_haddir_push_subscription(p_endpoint text, p_subscription jsonb, p_device_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_endpoint is null
    or p_endpoint !~ '^https://'
    or p_subscription is null
    or jsonb_typeof(p_subscription) <> 'object'
    or not (p_subscription ? 'keys')
    or not (p_subscription ? 'endpoint')
    or p_subscription->>'endpoint' <> p_endpoint then
    raise exception 'Invalid push subscription' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, subscription, device_label, updated_at
  )
  values (
    v_user_id, p_endpoint, p_subscription, p_device_label, now()
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        device_label = excluded.device_label,
        updated_at = now();
end;
$function$;

```
