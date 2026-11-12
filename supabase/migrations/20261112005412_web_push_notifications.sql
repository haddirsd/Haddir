create extension if not exists pg_net;
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 subscription jsonb not null,
 device_label text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint push_subscriptions_https_endpoint check (endpoint ~ '^https://'),
 constraint push_subscriptions_subscription_object check (jsonb_typeof(subscription)='object' and subscription ? 'keys' and subscription ? 'endpoint')
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select,insert,update,delete on table public.push_subscriptions to authenticated;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.get_haddir_push_config()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'public_key',(select decrypted_secret from vault.decrypted_secrets where name='haddir_vapid_public_key' limit 1),
  'private_key',(select decrypted_secret from vault.decrypted_secrets where name='haddir_vapid_private_key' limit 1),
  'hook_secret',(select decrypted_secret from vault.decrypted_secrets where name='haddir_push_hook_secret' limit 1)
 );
$$;
revoke all on function public.get_haddir_push_config() from public,anon,authenticated;
grant execute on function public.get_haddir_push_config() to service_role;

create or replace function private.dispatch_haddir_web_push()
returns trigger language plpgsql security definer set search_path=''
as $$
declare hook_secret text; destination text;
begin
 select decrypted_secret into hook_secret from vault.decrypted_secrets where name='haddir_push_hook_secret' limit 1;
 if hook_secret is null then return new; end if;
 destination:=case when new.type in ('ticket_approved','event_reminder_3d','event_reminder_24h','event_reminder_6h') then '/?tab=tickets' else '/?tab=notifications' end;
 perform net.http_post(
  url:='https://puhmvcekxkcxfdvgygpk.supabase.co/functions/v1/send-web-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-haddir-push-hook',hook_secret),
  body:=jsonb_build_object('user_id',new.user_id,'notification_id',new.id,'title',new.title,'message',new.message,'type',new.type,'url',destination),
  timeout_milliseconds:=5000
 );
 return new;
end;
$$;
revoke all on function private.dispatch_haddir_web_push() from public,anon,authenticated;
drop trigger if exists dispatch_haddir_web_push_after_insert on public.notifications;
create trigger dispatch_haddir_web_push_after_insert after insert on public.notifications for each row execute function private.dispatch_haddir_web_push();
