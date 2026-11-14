# Draft constraints and indexes

This draft reconstructs **81 constraints** and the standalone indexes from the production catalog. Indexes that back primary-key/unique constraints are deliberately excluded from the standalone index section to avoid duplicate index creation.

- Requires all table definitions in `20-tables-draft.sql.md` to be created first.
- Primary-key and unique constraints are applied before CHECK and foreign-key constraints so referenced candidate keys exist before FK creation. Foreign keys rely on Supabase-managed `auth.users` where specified.
- Apply primary-key and unique constraints first, then checks, then foreign keys so every referenced unique key already exists.
- Standalone indexes follow all constraints; constraint-backed indexes are not duplicated.
- Not tested on PostgreSQL; never apply to production.

```sql

-- DRAFT ONLY: reconstructed from production pg_constraint / pg_indexes catalog definitions.
-- Run only after all 16 public tables exist. Not tested. Do not apply to production.

-- Standalone indexes only. Constraint-backed indexes are created by the ALTER TABLE statements above.

ALTER TABLE public."admin_activity_log" ADD CONSTRAINT "admin_activity_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."booking_items" ADD CONSTRAINT "booking_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_pkey" PRIMARY KEY (id);
ALTER TABLE public."checkins" ADD CONSTRAINT "checkins_pkey" PRIMARY KEY (id);
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_payment_accounts" ADD CONSTRAINT "event_payment_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_role_assignments" ADD CONSTRAINT "event_role_assignments_pkey" PRIMARY KEY (user_id, event_id, assignment_role);
ALTER TABLE public."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);
ALTER TABLE public."gatekeeper_scan_logs" ADD CONSTRAINT "gatekeeper_scan_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_methods" ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."ticket_types" ADD CONSTRAINT "ticket_types_pkey" PRIMARY KEY (id);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_pkey" PRIMARY KEY (id);
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_booking_number_key" UNIQUE (booking_number);
ALTER TABLE public."checkins" ADD CONSTRAINT "checkins_ticket_id_key" UNIQUE (ticket_id);
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_notification_id_key" UNIQUE (notification_id);
ALTER TABLE public."event_role_assignments" ADD CONSTRAINT "event_role_assignments_one_event_per_user" UNIQUE (user_id);
ALTER TABLE public."events" ADD CONSTRAINT "events_slug_key" UNIQUE (slug);
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE (endpoint);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_qr_token_key" UNIQUE (qr_token);
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_ticket_code_key" UNIQUE (ticket_code);
ALTER TABLE public."booking_items" ADD CONSTRAINT "booking_items_line_total_check" CHECK ((line_total >= (0)::numeric));
ALTER TABLE public."booking_items" ADD CONSTRAINT "booking_items_quantity_check" CHECK ((quantity > 0));
ALTER TABLE public."booking_items" ADD CONSTRAINT "booking_items_unit_price_check" CHECK ((unit_price >= (0)::numeric));
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_status_check" CHECK ((status = ANY (ARRAY['pending_payment'::text, 'under_review'::text, 'confirmed'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text])));
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_subtotal_check" CHECK ((subtotal >= (0)::numeric));
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_notification_type_check" CHECK ((notification_type = ANY (ARRAY['ticket_approved'::text, 'payment_rejected'::text])));
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text])));
ALTER TABLE public."event_payment_accounts" ADD CONSTRAINT "event_payment_accounts_account_name_check" CHECK ((length(TRIM(BOTH FROM account_name)) > 0));
ALTER TABLE public."event_payment_accounts" ADD CONSTRAINT "event_payment_accounts_account_number_check" CHECK ((length(TRIM(BOTH FROM account_number)) > 0));
ALTER TABLE public."event_role_assignments" ADD CONSTRAINT "event_role_assignments_assignment_role_check" CHECK ((assignment_role = ANY (ARRAY['gatekeeper'::text, 'advertiser'::text])));
ALTER TABLE public."events" ADD CONSTRAINT "events_platform_fee_percent_check" CHECK (((platform_fee_percent >= (0)::numeric) AND (platform_fee_percent <= (100)::numeric)));
ALTER TABLE public."events" ADD CONSTRAINT "events_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text, 'completed'::text])));
ALTER TABLE public."events" ADD CONSTRAINT "events_valid_dates" CHECK (((ends_at IS NULL) OR (ends_at > starts_at)));
ALTER TABLE public."gatekeeper_scan_logs" ADD CONSTRAINT "gatekeeper_scan_logs_entry_method_check" CHECK ((entry_method = ANY (ARRAY['qr'::text, 'manual'::text])));
ALTER TABLE public."gatekeeper_scan_logs" ADD CONSTRAINT "gatekeeper_scan_logs_outcome_check" CHECK ((outcome = ANY (ARRAY['accepted'::text, 'used'::text, 'forged'::text, 'invalid'::text])));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ((type = ANY (ARRAY['ticket_approved'::text, 'payment_rejected'::text, 'general'::text, 'booking_expired'::text, 'event_reminder_3d'::text, 'event_reminder_24h'::text, 'event_reminder_6h'::text, 'ticket_checked_in'::text])));
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_amount_check" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_status_check" CHECK ((status = ANY (ARRAY['submitted'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['customer'::text, 'organizer'::text, 'gatekeeper'::text, 'advertiser'::text, 'supervisor'::text, 'admin'::text, 'owner'::text])));
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_https_endpoint" CHECK ((endpoint ~ '^https://'::text));
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_subscription_object" CHECK (((jsonb_typeof(subscription) = 'object'::text) AND (subscription ? 'keys'::text) AND (subscription ? 'endpoint'::text)));
ALTER TABLE public."ticket_types" ADD CONSTRAINT "ticket_types_check" CHECK (((quantity_sold >= 0) AND (quantity_sold <= quantity_total)));
ALTER TABLE public."ticket_types" ADD CONSTRAINT "ticket_types_price_check" CHECK ((price >= (0)::numeric));
ALTER TABLE public."ticket_types" ADD CONSTRAINT "ticket_types_quantity_total_check" CHECK ((quantity_total >= 0));
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_status_check" CHECK ((status = ANY (ARRAY['valid'::text, 'used'::text, 'cancelled'::text])));
ALTER TABLE public."admin_activity_log" ADD CONSTRAINT "admin_activity_log_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."admin_activity_log" ADD CONSTRAINT "admin_activity_log_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public."admin_activity_log" ADD CONSTRAINT "admin_activity_log_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE public."booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public."booking_items" ADD CONSTRAINT "booking_items_ticket_type_id_fkey" FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT;
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT;
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."checkins" ADD CONSTRAINT "checkins_checked_in_by_fkey" FOREIGN KEY (checked_in_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."checkins" ADD CONSTRAINT "checkins_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT;
ALTER TABLE public."checkins" ADD CONSTRAINT "checkins_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE RESTRICT;
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
ALTER TABLE public."email_outbox" ADD CONSTRAINT "email_outbox_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."event_payment_accounts" ADD CONSTRAINT "event_payment_accounts_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_role_assignments" ADD CONSTRAINT "event_role_assignments_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_role_assignments" ADD CONSTRAINT "event_role_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."gatekeeper_scan_logs" ADD CONSTRAINT "gatekeeper_scan_logs_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."gatekeeper_scan_logs" ADD CONSTRAINT "gatekeeper_scan_logs_gatekeeper_user_id_fkey" FOREIGN KEY (gatekeeper_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."gatekeeper_scan_logs" ADD CONSTRAINT "gatekeeper_scan_logs_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_submitted_by_fkey" FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."ticket_types" ADD CONSTRAINT "ticket_types_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_booking_item_id_fkey" FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE;
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT;
ALTER TABLE public."tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT;
CREATE INDEX admin_activity_log_actor_idx ON public.admin_activity_log USING btree (actor_id, created_at DESC);
CREATE INDEX admin_activity_log_booking_idx ON public.admin_activity_log USING btree (booking_id, created_at DESC);
CREATE INDEX admin_activity_log_created_at_idx ON public.admin_activity_log USING btree (created_at DESC);
CREATE INDEX admin_activity_log_event_idx ON public.admin_activity_log USING btree (event_id, created_at DESC);
CREATE INDEX booking_items_booking_id_idx ON public.booking_items USING btree (booking_id);
CREATE INDEX booking_items_ticket_type_id_idx ON public.booking_items USING btree (ticket_type_id);
CREATE INDEX bookings_event_idx ON public.bookings USING btree (event_id, status);
CREATE INDEX bookings_pending_expiry_idx ON public.bookings USING btree (expires_at, id) WHERE ((status = 'pending_payment'::text) AND (expires_at IS NOT NULL));
CREATE INDEX bookings_user_idx ON public.bookings USING btree (user_id, created_at DESC);
CREATE INDEX checkins_checked_in_by_idx ON public.checkins USING btree (checked_in_by);
CREATE INDEX checkins_event_id_idx ON public.checkins USING btree (event_id);
CREATE INDEX email_outbox_pending_idx ON public.email_outbox USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));
CREATE INDEX event_payment_accounts_event_idx ON public.event_payment_accounts USING btree (event_id, sort_order);
CREATE INDEX event_role_assignments_event_role_idx ON public.event_role_assignments USING btree (event_id, assignment_role);
CREATE INDEX events_created_by_idx ON public.events USING btree (created_by);
CREATE INDEX events_public_listing_idx ON public.events USING btree (starts_at) WHERE (status = 'published'::text);
CREATE INDEX gatekeeper_scan_logs_event_time_idx ON public.gatekeeper_scan_logs USING btree (event_id, scanned_at DESC);
CREATE INDEX gatekeeper_scan_logs_ticket_id_idx ON public.gatekeeper_scan_logs USING btree (ticket_id);
CREATE INDEX gatekeeper_scan_logs_user_event_time_idx ON public.gatekeeper_scan_logs USING btree (gatekeeper_user_id, event_id, scanned_at DESC);
CREATE UNIQUE INDEX notifications_booking_reminder_unique ON public.notifications USING btree (booking_id, type) WHERE ((booking_id IS NOT NULL) AND (type = ANY (ARRAY['event_reminder_3d'::text, 'event_reminder_24h'::text, 'event_reminder_6h'::text])));
CREATE UNIQUE INDEX notifications_booking_terminal_once_idx ON public.notifications USING btree (booking_id, type) WHERE ((booking_id IS NOT NULL) AND (type = ANY (ARRAY['ticket_approved'::text, 'payment_rejected'::text, 'booking_expired'::text])));
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX payment_submissions_booking_idx ON public.payment_submissions USING btree (booking_id, created_at DESC);
CREATE INDEX payment_submissions_reviewed_by_idx ON public.payment_submissions USING btree (reviewed_by);
CREATE INDEX payment_submissions_submitted_by_idx ON public.payment_submissions USING btree (submitted_by);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX ticket_types_event_idx ON public.ticket_types USING btree (event_id, is_active);
CREATE INDEX tickets_booking_id_idx ON public.tickets USING btree (booking_id);
CREATE INDEX tickets_booking_item_id_idx ON public.tickets USING btree (booking_item_id);
CREATE INDEX tickets_event_status_idx ON public.tickets USING btree (event_id, status);
CREATE UNIQUE INDEX tickets_one_active_per_booking_item_uidx ON public.tickets USING btree (booking_item_id) WHERE ((booking_item_id IS NOT NULL) AND (status = ANY (ARRAY['valid'::text, 'used'::text])));
CREATE UNIQUE INDEX tickets_ticket_code_unique ON public.tickets USING btree (ticket_code);
CREATE INDEX tickets_ticket_type_id_idx ON public.tickets USING btree (ticket_type_id);```
