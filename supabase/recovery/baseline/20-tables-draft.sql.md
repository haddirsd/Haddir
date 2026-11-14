# Draft table definitions

This file is a first-pass reconstruction of the **16 Haddir public tables / 158 columns** from the production catalog. It is intentionally isolated under `supabase/recovery/baseline/` and is **not a migration**.

- Column order, types, defaults and nullability were taken from the read-only catalog export.
- Numeric precision and fixed currency width were reconciled against a fresh `format_type()` catalog query.
- Primary keys, unique/check/foreign-key constraints and indexes are excluded here and must be applied in the later constraints/indexes stage.
- RLS, policies, grants, functions, triggers, Storage and cron are also excluded.
- This file has not been run against PostgreSQL; do not execute it in production.

```sql
-- DRAFT ONLY: Haddir public table columns reconstructed from a read-only production catalog snapshot.
-- Not an original historical migration. Not yet validated on PostgreSQL.
-- Constraints, indexes, policies, grants, routines and triggers are intentionally separate.
-- Requires a compatible Supabase project with managed auth schema and gen_random_uuid().

CREATE TABLE public."admin_activity_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid,
  "actor_name" text DEFAULT 'مستخدم غير معروف'::text NOT NULL,
  "actor_role" text DEFAULT 'unknown'::text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "entity_label" text,
  "event_id" uuid,
  "booking_id" uuid,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."booking_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL,
  "ticket_type_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "line_total" numeric(12,2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."bookings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "booking_number" text NOT NULL,
  "user_id" uuid,
  "customer_name" text NOT NULL,
  "customer_email" text,
  "customer_phone" text NOT NULL,
  "event_id" uuid NOT NULL,
  "subtotal" numeric(12,2) NOT NULL,
  "currency" character(3) DEFAULT 'SDG'::bpchar NOT NULL,
  "status" text DEFAULT 'pending_payment'::text NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."checkins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "checked_in_by" uuid,
  "checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
  "gate_name" text
);

CREATE TABLE public."email_outbox" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "notification_id" uuid NOT NULL,
  "booking_id" uuid,
  "recipient_user_id" uuid NOT NULL,
  "notification_type" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone
);

CREATE TABLE public."event_payment_accounts" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "event_id" uuid NOT NULL,
  "account_name" text NOT NULL,
  "account_number" text NOT NULL,
  "sort_order" integer DEFAULT 10 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "beneficiary" text
);

CREATE TABLE public."event_role_assignments" (
  "user_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "assignment_role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "category" text,
  "venue" text,
  "city" text,
  "address" text,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "cover_image_url" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_trending" boolean DEFAULT false NOT NULL,
  "location_url" text,
  "platform_fee_percent" numeric(5,2) DEFAULT 0 NOT NULL,
  "is_continuous" boolean DEFAULT false NOT NULL
);

CREATE TABLE public."gatekeeper_scan_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "gatekeeper_user_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "ticket_id" uuid,
  "outcome" text NOT NULL,
  "scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "entry_method" text DEFAULT 'qr'::text NOT NULL,
  "entered_code" text
);

CREATE TABLE public."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "booking_id" uuid,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."payment_methods" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "account_details" text NOT NULL,
  "beneficiary" text NOT NULL,
  "instructions" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."payment_submissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL,
  "submitted_by" uuid,
  "transfer_reference" text,
  "receipt_path" text,
  "amount" numeric(12,2) NOT NULL,
  "currency" character(3) DEFAULT 'SDG'::bpchar NOT NULL,
  "status" text DEFAULT 'submitted'::text NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "payment_account_id" text,
  "payment_account_name" text,
  "payment_account_number" text,
  "payment_account_beneficiary" text
);

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "full_name" text,
  "phone" text,
  "role" text DEFAULT 'customer'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "subscription" jsonb NOT NULL,
  "device_label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."ticket_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric(12,2) DEFAULT 0 NOT NULL,
  "currency" character(3) DEFAULT 'SDG'::bpchar NOT NULL,
  "quantity_total" integer,
  "quantity_sold" integer DEFAULT 0 NOT NULL,
  "sales_start_at" timestamp with time zone,
  "sales_end_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."tickets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "booking_item_id" uuid NOT NULL,
  "booking_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "ticket_type_id" uuid NOT NULL,
  "ticket_code" text NOT NULL,
  "qr_token" uuid DEFAULT gen_random_uuid() NOT NULL,
  "attendee_name" text,
  "status" text DEFAULT 'valid'::text NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "used_at" timestamp with time zone
);

```
