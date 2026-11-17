create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('ticket_approved','payment_rejected')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox(status, created_at)
  where status in ('pending','failed');

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;
grant all on public.email_outbox to service_role;

create or replace function private.enqueue_booking_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type in ('ticket_approved','payment_rejected') then
    insert into public.email_outbox(notification_id, booking_id, recipient_user_id, notification_type)
    values (new.id, new.booking_id, new.user_id, new.type)
    on conflict (notification_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.enqueue_booking_notification_email() from public, anon, authenticated;

drop trigger if exists enqueue_booking_notification_email on public.notifications;
create trigger enqueue_booking_notification_email
after insert on public.notifications
for each row execute function private.enqueue_booking_notification_email();
