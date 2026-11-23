create or replace function public.admin_get_report_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_role := private.current_profile_role();
  if v_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية عرض التقارير'; end if;
  select jsonb_build_object(
    'profiles', coalesce((select jsonb_object_agg(x.role,x.total) from (select p.role,count(*)::bigint total from public.profiles p group by p.role) x),'{}'::jsonb),
    'bookings', jsonb_build_object(
      'total',(select count(*)::bigint from public.bookings),
      'confirmed',(select count(*)::bigint from public.bookings where status='confirmed'),
      'rejected',(select count(*)::bigint from public.bookings where status='rejected'),
      'pending',(select count(*)::bigint from public.bookings where status in ('pending_payment','under_review')),
      'sold_quantity',(select coalesce(sum(bi.quantity),0)::bigint from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.status='confirmed'),
      'reserved_quantity',(select coalesce(sum(bi.quantity),0)::bigint from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.status in ('pending_payment','under_review')),
      'rejected_quantity',(select coalesce(sum(bi.quantity),0)::bigint from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.status='rejected'),
      'revenue',coalesce((select jsonb_agg(jsonb_build_object('currency',x.currency,'value',x.value)) from (select coalesce(nullif(b.currency,''),'SDG') currency,sum(b.subtotal)::numeric value from public.bookings b where b.status='confirmed' group by 1) x),'[]'::jsonb),
      'commission',coalesce((select jsonb_agg(jsonb_build_object('currency',x.currency,'value',x.value)) from (select coalesce(nullif(b.currency,''),'SDG') currency,sum(round(coalesce(b.subtotal,0)*coalesce(e.platform_fee_percent,0)/100,2))::numeric value from public.bookings b join public.events e on e.id=b.event_id where b.status='confirmed' group by 1) x),'[]'::jsonb)
    ),
    'tickets',jsonb_build_object('total',(select count(*)::bigint from public.tickets),'used',(select count(*)::bigint from public.tickets where status='used')),
    'event_metrics',coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id',e.id,
        'booking_total',(select count(*)::bigint from public.bookings b where b.event_id=e.id),
        'confirmed_count',(select count(*)::bigint from public.bookings b where b.event_id=e.id and b.status='confirmed'),
        'pending_count',(select count(*)::bigint from public.bookings b where b.event_id=e.id and b.status in ('pending_payment','under_review')),
        'rejected_count',(select count(*)::bigint from public.bookings b where b.event_id=e.id and b.status='rejected'),
        'people_count',(select count(distinct coalesce(b.user_id::text,nullif(b.customer_email,''),nullif(b.customer_phone,''),b.id::text))::bigint from public.bookings b where b.event_id=e.id and b.status not in ('rejected','cancelled','expired')),
        'sold_quantity',(select coalesce(sum(bi.quantity),0)::bigint from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.event_id=e.id and b.status='confirmed'),
        'reserved_quantity',(select coalesce(sum(bi.quantity),0)::bigint from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.event_id=e.id and b.status in ('pending_payment','under_review')),
        'rejected_quantity',(select coalesce(sum(bi.quantity),0)::bigint from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.event_id=e.id and b.status='rejected'),
        'ticket_total',(select count(*)::bigint from public.tickets t where t.event_id=e.id),
        'ticket_used',(select count(*)::bigint from public.tickets t where t.event_id=e.id and t.status='used'),
        'ticket_invalid',(select count(*)::bigint from public.tickets t where t.event_id=e.id and t.status not in ('valid','used')),
        'revenue',coalesce((select jsonb_agg(jsonb_build_object('currency',x.currency,'value',x.value)) from (select coalesce(nullif(b.currency,''),'SDG') currency,sum(b.subtotal)::numeric value from public.bookings b where b.event_id=e.id and b.status='confirmed' group by 1) x),'[]'::jsonb),
        'commission',coalesce((select jsonb_agg(jsonb_build_object('currency',x.currency,'value',x.value)) from (select coalesce(nullif(b.currency,''),'SDG') currency,sum(round(coalesce(b.subtotal,0)*coalesce(e.platform_fee_percent,0)/100,2))::numeric value from public.bookings b where b.event_id=e.id and b.status='confirmed' group by 1) x),'[]'::jsonb),
        'ticket_type_metrics',coalesce((
          select jsonb_agg(to_jsonb(q)) from (
            select tt.id ticket_type_id,
              coalesce(sum(bi.quantity) filter (where b.status='confirmed'),0)::bigint sold,
              coalesce(sum(bi.quantity) filter (where b.status in ('pending_payment','under_review')),0)::bigint reserved,
              coalesce(sum(bi.quantity) filter (where b.status='rejected'),0)::bigint rejected,
              coalesce(sum(coalesce(bi.line_total,coalesce(bi.unit_price,0)*coalesce(bi.quantity,0))) filter (where b.status='confirmed'),0)::numeric revenue
            from public.ticket_types tt
            left join public.booking_items bi on bi.ticket_type_id=tt.id
            left join public.bookings b on b.id=bi.booking_id and b.event_id=e.id
            where tt.event_id=e.id group by tt.id
          ) q
        ),'[]'::jsonb)
      )) from public.events e
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_get_report_summary() from public,anon;
grant execute on function public.admin_get_report_summary() to authenticated;
