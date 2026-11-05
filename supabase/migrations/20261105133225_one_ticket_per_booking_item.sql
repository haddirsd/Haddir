create or replace function public.review_payment_submission(
 p_submission_id uuid,p_decision text,p_rejection_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
 v_role text; v_payment public.payment_submissions%rowtype; v_booking public.bookings%rowtype;
 v_item record; v_ticket_code text; v_ticket_count integer:=0; v_attendee_count integer:=0;
begin
 v_role:=private.current_profile_role();
 if coalesce(v_role,'') not in ('owner','admin','supervisor') then raise exception 'غير مصرح لك بمراجعة المدفوعات'; end if;
 if p_decision not in ('approve','reject') then raise exception 'قرار المراجعة غير صحيح'; end if;
 if p_decision='reject' and nullif(trim(coalesce(p_rejection_reason,'')),'') is null then raise exception 'اكتب سبب رفض إثبات الدفع'; end if;
 select * into v_payment from public.payment_submissions where id=p_submission_id for update;
 if not found then raise exception 'إثبات الدفع غير موجود'; end if;
 if v_payment.status<>'submitted' then raise exception 'تمت مراجعة إثبات الدفع مسبقاً'; end if;
 select * into v_booking from public.bookings where id=v_payment.booking_id for update;
 if not found then raise exception 'الحجز غير موجود'; end if;
 if v_booking.user_id is null then raise exception 'الحجز غير مرتبط بحساب مستخدم'; end if;
 if p_decision='approve' then
  select coalesce(sum(quantity),0)::integer into v_attendee_count from public.booking_items where booking_id=v_booking.id;
  for v_item in select bi.* from public.booking_items bi join public.ticket_types tt on tt.id=bi.ticket_type_id where bi.booking_id=v_booking.id loop
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
  values(v_booking.user_id,v_booking.id,'تعذر قبول إثبات الدفع','تم رفض إثبات الدفع للحجز رقم '||v_booking.booking_number||'. السبب: '||trim(p_rejection_reason),'payment_rejected');
 end if;
 return jsonb_build_object('success',true,'decision',p_decision,'tickets_created',v_ticket_count,'attendee_count',v_attendee_count,'booking_id',v_booking.id);
end;$function$;
revoke all on function public.review_payment_submission(uuid,text,text) from public,anon;
grant execute on function public.review_payment_submission(uuid,text,text) to authenticated;