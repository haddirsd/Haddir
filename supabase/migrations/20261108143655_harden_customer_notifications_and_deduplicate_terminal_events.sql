-- Keep customer notification rows immutable except for the read flag.
revoke all privileges on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

-- A terminal booking transition may produce each notification type only once.
create unique index if not exists notifications_booking_terminal_once_idx
  on public.notifications (booking_id, type)
  where booking_id is not null
    and type in ('ticket_approved', 'payment_rejected', 'booking_expired');
