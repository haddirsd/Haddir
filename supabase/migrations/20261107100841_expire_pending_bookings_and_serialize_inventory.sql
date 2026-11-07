create or replace function public.create_booking(
  p_event_id uuid, p_ticket_type_id uuid, p_quantity integer
)
returns table(booking_id uuid, booking_number text, subtotal numeric, currency character)
language plpgsql security definer set search_path to ''
as $function$
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
  if not found or v_event.status <> 'published' or v_event.starts_at <= now() then
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
  if v_ticket.quantity_sold+p_quantity>v_ticket.quantity_total then
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

create or replace function public.review_payment_submission(
 p_submission_id uuid,p_decision text,p_rejection_reason text default null
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
 v_role text; v_payment public.payment_submissions%rowtype; v_booking public.bookings%rowtype;
 v_item record; v_ticket_code text; v_ticket_count integer:=0; v_attendee_count integer:=0;
begin
 v_role:=private.current_profile_role();
 if coalesce(v_role,'') not in ('owner','admin','supervisor') then raise exception 'غير مصرح لك بمراجعة المدفوعات'; end if;
 if p_decision not in ('approve','reject') then raise exception 'قرار المراجعة غير صحيح'; end if;
 if p_decision='reject' and nullif(trim(coalesce(p_rejection_reason,'')),'') is null then raise exception 'اكتب سبب رفض إثبات الدفع'; end if;
 perform pg_advisory_xact_lock(748231905441::bigint);
 select * into v_payment from public.payment_submissions where id=p_submission_id for update;
 if not found then raise exception 'إثبات الدفع غير موجود'; end if;
 if v_payment.status<>'submitted' then raise exception 'تمت مراجعة إثبات الدفع مسبقاً'; end if;
 select * into v_booking from public.bookings where id=v_payment.booking_id for update;
 if not found then raise exception 'الحجز غير موجود'; end if;
 if v_booking.user_id is null then raise exception 'الحجز غير مرتبط بحساب مستخدم'; end if;
 if p_decision='approve' then
  select coalesce(sum(bi.quantity),0)::integer into v_attendee_count from public.booking_items bi where bi.booking_id=v_booking.id;
  for v_item in select bi.*,tt.name as ticket_name from public.booking_items bi join public.ticket_types tt on tt.id=bi.ticket_type_id where bi.booking_id=v_booking.id loop
   loop
    v_ticket_code:=lpad(floor(random()*10000000000)::bigint::text,10,'0');
    exit when not exists(select 1 from public.tickets where ticket_code=v_ticket_code);
   end loop;
   insert into public.tickets(booking_item_id,booking_id,event_id,ticket_type_id,ticket_code,attendee_name,status)
   values(v_item.id,v_booking.id,v_booking.event_id,v_item.ticket_type_id,v_ticket_code,v_booking.customer_name,'valid');
   v_ticket_count:=v_ticket_count+1;
  end loop;
  update public.payment_submissions set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=null where id=v_payment.id;
  update public.bookings set status='confirmed',expires_at=null,updated_at=now() where id=v_booking.id;
  insert into public.notifications(user_id,booking_id,title,message,type)
  values(v_booking.user_id,v_booking.id,'تم قبول حجزك وإصدار تذكرتك',
   'تم اعتماد الدفع لحجزك رقم '||v_booking.booking_number||'. أُصدرت '||v_ticket_count||
   ' تذكرة تشمل '||v_attendee_count||' من الأشخاص، ويمكنك مشاهدة كود الدخول في قسم تذاكري.','ticket_approved');
 else
  update public.payment_submissions set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(p_rejection_reason) where id=v_payment.id;
  for v_item in select ticket_type_id,quantity from public.booking_items where booking_id=v_booking.id loop
   update public.ticket_types set quantity_sold=greatest(0,quantity_sold-v_item.quantity),updated_at=now() where id=v_item.ticket_type_id;
  end loop;
  update public.bookings set status='rejected',updated_at=now() where id=v_booking.id;
  insert into public.notifications(user_id,booking_id,title,message,type)
  values(v_booking.user_id,v_booking.id,'تعذر قبول إثبات الدفع',
   'تم رفض إثبات الدفع للحجز رقم '||v_booking.booking_number||'. السبب: '||trim(p_rejection_reason),'payment_rejected');
 end if;
 return jsonb_build_object('success',true,'decision',p_decision,'tickets_created',v_ticket_count,'attendee_count',v_attendee_count,'booking_id',v_booking.id);
end;
$function$;

create or replace function private.expire_pending_bookings()
returns integer language plpgsql security definer set search_path to ''
as $function$
declare v_booking record; v_item record; v_expired_count integer:=0;
begin
 perform pg_advisory_xact_lock(748231905441::bigint);
 for v_booking in
  select b.id,b.user_id,b.booking_number from public.bookings b
   where b.status='pending_payment' and b.expires_at is not null and b.expires_at<=now()
   order by b.expires_at,b.id for update skip locked
 loop
  update public.bookings set status='expired',updated_at=now() where id=v_booking.id and status='pending_payment';
  if not found then continue; end if;
  for v_item in select bi.ticket_type_id,bi.quantity from public.booking_items bi where bi.booking_id=v_booking.id order by bi.ticket_type_id loop
   update public.ticket_types set quantity_sold=greatest(0,quantity_sold-v_item.quantity),updated_at=now() where id=v_item.ticket_type_id;
  end loop;
  if v_booking.user_id is not null then
   insert into public.notifications(user_id,booking_id,title,message,type)
   values(v_booking.user_id,v_booking.id,'انتهت مهلة الحجز',
    'انتهت مهلة الدفع للحجز رقم '||v_booking.booking_number||
    ' وتم تحرير كمية التذاكر المحجوزة. يمكنك إنشاء حجز جديد إذا كانت التذاكر لا تزال متاحة.','booking_expired');
  end if;
  v_expired_count:=v_expired_count+1;
 end loop;
 return v_expired_count;
end;
$function$;

revoke all on function private.expire_pending_bookings() from public,anon,authenticated;
select cron.unschedule(jobid) from cron.job where jobname='haddir-expire-pending-bookings';
select cron.schedule('haddir-expire-pending-bookings','* * * * *','select private.expire_pending_bookings();');
