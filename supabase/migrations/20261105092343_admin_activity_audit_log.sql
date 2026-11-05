
create table if not exists public.admin_activity_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
 actor_name text not null default 'مستخدم غير معروف', actor_role text not null default 'unknown',
 action text not null, entity_type text not null, entity_id uuid, entity_label text,
 event_id uuid references public.events(id) on delete set null, booking_id uuid references public.bookings(id) on delete set null,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists admin_activity_log_created_at_idx on public.admin_activity_log(created_at desc);
create index if not exists admin_activity_log_actor_idx on public.admin_activity_log(actor_id, created_at desc);
create index if not exists admin_activity_log_event_idx on public.admin_activity_log(event_id, created_at desc);
alter table public.admin_activity_log enable row level security;
drop policy if exists "Admins and supervisors read activity log" on public.admin_activity_log;
create policy "Admins and supervisors read activity log" on public.admin_activity_log for select to authenticated
using (private.current_profile_role() in ('owner','admin','supervisor'));
revoke all on public.admin_activity_log from anon, authenticated;
grant select on public.admin_activity_log to authenticated;

create or replace function private.capture_admin_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := auth.uid(); v_actor_name text := 'مستخدم غير معروف'; v_actor_role text := 'unknown';
 v_old jsonb; v_new jsonb; v_row jsonb; v_entity_id uuid; v_event_id uuid; v_booking_id uuid;
 v_label text; v_action text; v_entity_type text; v_details jsonb := '{}'::jsonb;
begin
 v_old:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 v_new:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 if v_actor is not null then
  select coalesce(p.full_name,'بدون اسم'),coalesce(p.role,'unknown') into v_actor_name,v_actor_role from public.profiles p where p.id=v_actor;
  v_actor_name:=coalesce(v_actor_name,'بدون اسم'); v_actor_role:=coalesce(v_actor_role,'unknown');
 end if;
 v_row:=case when tg_op='DELETE' then v_old else v_new end;
 begin v_entity_id:=nullif(v_row->>'id','')::uuid; exception when others then v_entity_id:=null; end;
 begin v_event_id:=nullif(v_row->>'event_id','')::uuid; exception when others then v_event_id:=null; end;
 begin v_booking_id:=nullif(v_row->>'booking_id','')::uuid; exception when others then v_booking_id:=null; end;
 if tg_table_name='events' then v_event_id:=v_entity_id; end if;
 if tg_table_name='bookings' then v_booking_id:=v_entity_id; v_event_id:=nullif(v_row->>'event_id','')::uuid; end if;
 if tg_table_name='payment_submissions' and v_booking_id is not null then select b.event_id into v_event_id from public.bookings b where b.id=v_booking_id; end if;
 v_label:=coalesce(v_row->>'title',v_row->>'booking_number',v_row->>'full_name',v_row->>'ticket_code',v_row->>'name',v_row->>'account_name',v_row->>'id');
 if tg_op='INSERT' then v_action:=tg_table_name||'.created'; elsif tg_op='DELETE' then v_action:=tg_table_name||'.deleted'; else v_action:=tg_table_name||'.updated'; end if;
 if tg_table_name='events' then v_entity_type:='event'; elsif tg_table_name='profiles' then v_entity_type:='user';
 elsif tg_table_name='bookings' then v_entity_type:='booking'; elsif tg_table_name='payment_submissions' then v_entity_type:='payment';
 elsif tg_table_name='tickets' then v_entity_type:='ticket'; elsif tg_table_name='ticket_types' then v_entity_type:='ticket_type';
 elsif tg_table_name='event_payment_accounts' then v_entity_type:='payment_account'; else v_entity_type:=tg_table_name; end if;
 if tg_op='UPDATE' then
  if tg_table_name='profiles' and v_old->>'role' is distinct from v_new->>'role' then v_action:='user.role_changed';
  elsif tg_table_name='bookings' and v_old->>'status' is distinct from v_new->>'status' then v_action:='booking.'||coalesce(v_new->>'status','status_changed');
  elsif tg_table_name='payment_submissions' and v_old->>'status' is distinct from v_new->>'status' then v_action:='payment.'||coalesce(v_new->>'status','status_changed');
  elsif tg_table_name='tickets' and v_old->>'status' is distinct from v_new->>'status' then
   if v_new->>'status'='used' then v_action:='ticket.checked_in'; elsif v_old->>'status'='used' then v_action:='ticket.checkin_reversed'; else v_action:='ticket.status_changed'; end if;
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
end; $$;
revoke all on function private.capture_admin_activity() from public,anon,authenticated;
do $$ declare t text; begin foreach t in array array['events','profiles','bookings','payment_submissions','tickets','ticket_types','event_payment_accounts'] loop
 execute format('drop trigger if exists audit_%I on public.%I',t,t);
 execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function private.capture_admin_activity()',t,t);
end loop; end; $$;
