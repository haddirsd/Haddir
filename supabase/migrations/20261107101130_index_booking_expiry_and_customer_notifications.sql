create index if not exists bookings_pending_expiry_idx
 on public.bookings (expires_at,id)
 where status='pending_payment' and expires_at is not null;
create index if not exists notifications_user_created_idx
 on public.notifications (user_id,created_at desc);
