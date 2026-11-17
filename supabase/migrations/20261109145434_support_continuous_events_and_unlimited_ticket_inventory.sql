alter table public.events alter column starts_at drop not null;
alter table public.events add column if not exists is_continuous boolean not null default false;
alter table public.ticket_types alter column quantity_total drop not null;

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
