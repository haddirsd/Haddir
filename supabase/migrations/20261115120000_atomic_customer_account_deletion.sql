-- Make customer-account cleanup atomic in Postgres and retryable across Storage/Auth boundaries.
-- Apply only after the migration has been reviewed and validated in a disposable project.

create table if not exists private.customer_account_deletion_cleanup (
  user_id uuid primary key,
  receipt_paths text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

revoke all on table private.customer_account_deletion_cleanup from public, anon, authenticated;
grant select, insert, update, delete on table private.customer_account_deletion_cleanup to service_role;

create or replace function public.prepare_customer_account_deletion(p_user_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_paths text[] := '{}'::text[];
begin
  if p_user_id is null then
    raise exception 'معرّف الحساب مطلوب';
  end if;

  select p.role into v_role
    from public.profiles p
   where p.id = p_user_id
   for update;

  if not found or v_role <> 'customer' then
    raise exception 'حذف الحساب الذاتي متاح لحسابات العملاء فقط';
  end if;

  if exists (select 1 from public.events e where e.created_by = p_user_id)
     or exists (select 1 from public.event_role_assignments a where a.user_id = p_user_id)
     or exists (select 1 from public.gatekeeper_scan_logs g where g.gatekeeper_user_id = p_user_id) then
    raise exception 'الحساب مرتبط بفعاليات أو مهام تشغيلية';
  end if;

  if exists (
    select 1
      from public.bookings b
      join public.events e on e.id = b.event_id
     where b.user_id = p_user_id
       and b.status = 'confirmed'
       and e.starts_at > now()
  ) then
    raise exception 'لديك تذكرة مؤكدة لفعالية قادمة';
  end if;

  select coalesce(array_agg(distinct ps.receipt_path), '{}'::text[])
    into v_paths
    from public.payment_submissions ps
   where ps.receipt_path is not null
     and (ps.submitted_by = p_user_id
       or ps.booking_id in (select b.id from public.bookings b where b.user_id = p_user_id));

  insert into private.customer_account_deletion_cleanup as existing(user_id, receipt_paths, updated_at)
  values (p_user_id, v_paths, now())
  on conflict (user_id) do update
    set receipt_paths = (
      select coalesce(array_agg(distinct u.path), '{}'::text[])
        from unnest(existing.receipt_paths || excluded.receipt_paths) as u(path)
    ),
    updated_at = now();

  delete from public.email_outbox where recipient_user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.push_subscriptions where user_id = p_user_id;

  update public.payment_submissions
     set submitted_by = null,
         receipt_path = null
   where submitted_by = p_user_id
      or booking_id in (select b.id from public.bookings b where b.user_id = p_user_id);

  update public.bookings
     set user_id = null,
         customer_name = 'مستخدم محذوف',
         customer_email = null,
         customer_phone = 'محذوف'
   where user_id = p_user_id;

  select c.receipt_paths into v_paths
    from private.customer_account_deletion_cleanup c
   where c.user_id = p_user_id;

  return coalesce(v_paths, '{}'::text[]);
end;
$$;

create or replace function public.complete_customer_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'معرّف الحساب مطلوب';
  end if;

  delete from private.customer_account_deletion_cleanup
   where user_id = p_user_id;
end;
$$;

revoke all on function public.prepare_customer_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.complete_customer_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_customer_account_deletion(uuid) to service_role;
grant execute on function public.complete_customer_account_deletion(uuid) to service_role;
