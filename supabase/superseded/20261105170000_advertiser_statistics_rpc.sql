create or replace function private.get_advertiser_event_statistics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  where a.user_id = v_user_id and a.assignment_role = 'advertiser'
  order by a.created_at desc
  limit 1;

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
      from (select b.currency, sum(b.subtotal)::numeric as sales
        from public.bookings b where b.event_id = e.id and b.status = 'confirmed'
        group by b.currency) x
    ), '[]'::jsonb),
    'ticket_types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tt.id, 'name', tt.name, 'price', tt.price, 'currency', tt.currency,
        'quantity_total', tt.quantity_total,
        'confirmed_quantity', coalesce(s.confirmed_quantity,0),
        'rejected_quantity', coalesce(s.rejected_quantity,0),
        'remaining_quantity', greatest(0, tt.quantity_total - coalesce(s.confirmed_quantity,0)),
        'sales', coalesce(s.sales,0)
      ) order by tt.created_at)
      from public.ticket_types tt
      left join lateral (
        select
          sum(bi.quantity) filter (where b.status = 'confirmed')::integer as confirmed_quantity,
          sum(bi.quantity) filter (where b.status = 'rejected')::integer as rejected_quantity,
          sum(bi.line_total) filter (where b.status = 'confirmed')::numeric as sales
        from public.booking_items bi join public.bookings b on b.id = bi.booking_id
        where bi.ticket_type_id = tt.id and b.event_id = e.id
      ) s on true
      where tt.event_id = e.id
    ), '[]'::jsonb)
  ) into v_result
  from public.events e where e.id = v_event_id;

  return v_result;
end;
$$;

revoke all on function private.get_advertiser_event_statistics() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_advertiser_event_statistics() to authenticated;

create or replace function public.get_advertiser_event_statistics()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_advertiser_event_statistics(); $$;

revoke all on function public.get_advertiser_event_statistics() from public, anon;
grant execute on function public.get_advertiser_event_statistics() to authenticated;
