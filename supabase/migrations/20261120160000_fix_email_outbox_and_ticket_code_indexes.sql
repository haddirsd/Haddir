-- Cover both email_outbox foreign keys for joins and referenced-row maintenance.
create index if not exists email_outbox_booking_id_idx
  on public.email_outbox (booking_id);

create index if not exists email_outbox_recipient_user_id_idx
  on public.email_outbox (recipient_user_id);

-- ticket_code already has a UNIQUE constraint backed by tickets_ticket_code_key.
-- This standalone index duplicates that constraint's unique index and is safe to remove.
drop index if exists public.tickets_ticket_code_unique;
