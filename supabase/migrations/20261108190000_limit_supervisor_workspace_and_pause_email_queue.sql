-- Keep the supervisor workspace limited to booking and payment review.
-- Activity logs contain platform-wide operational details and are reserved for managers.
drop policy if exists "Admins and supervisors read activity log" on public.admin_activity_log;
create policy "Platform managers read activity log"
on public.admin_activity_log
for select
to authenticated
using (private.current_profile_role() in ('owner','admin'));

-- Email delivery is intentionally paused until the sender domain and Resend credentials are ready.
-- In-app notifications continue independently.
drop trigger if exists enqueue_booking_notification_email on public.notifications;
