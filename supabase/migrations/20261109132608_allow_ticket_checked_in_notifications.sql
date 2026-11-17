alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'ticket_approved'::text,
    'payment_rejected'::text,
    'general'::text,
    'booking_expired'::text,
    'event_reminder_3d'::text,
    'event_reminder_24h'::text,
    'event_reminder_6h'::text,
    'ticket_checked_in'::text
  ]));
