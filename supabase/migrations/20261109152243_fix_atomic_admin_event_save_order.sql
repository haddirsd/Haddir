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
$function$

