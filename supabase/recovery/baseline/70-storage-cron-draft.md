# Draft Storage and cron reconstruction

**Status: catalog-derived deployment draft. Not applied, not tested, and not part of executable migration history.**

This file preserves Haddir's two bucket definitions, six Storage object policies, and two active cron jobs. Supabase manages the `storage` and `cron` schemas; do not recreate or alter those schemas or their internal tables.

## 1. Storage bucket configuration

Supabase's current local-development guidance defines buckets in `supabase/config.toml`, rather than treating the Storage schema as application-owned DDL. The following TOML is a configuration excerpt only; it has not been added to the active project config.

```toml
[storage.buckets.event-covers]
public = true
file_size_limit = "10MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]

[storage.buckets.payment-receipts]
public = false
file_size_limit = "5MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
```

Verified production settings:
- `event-covers`: public, 10 MiB maximum, JPEG/PNG/WebP/GIF/AVIF.
- `payment-receipts`: private, 5 MiB maximum, JPEG/PNG/WebP.

No Storage object data or files are part of this reconstruction. Do not modify `storage.buckets` or `storage.objects` directly; use supported Supabase configuration and Storage APIs.

## 2. Storage object policies

These six policy definitions were reconstructed from the captured `pg_policies` expressions. They require the Supabase-managed `storage.objects` relation and the app helper `private.current_profile_role()` created earlier.

```sql
-- DRAFT ONLY. Requires Supabase Storage and all referenced app tables/functions.
-- Never recreate storage schema/tables. Do not apply to production.

CREATE POLICY "Customers upload own payment receipts" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (((bucket_id = 'payment-receipts'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE (((b.id)::text = (storage.foldername(objects.name))[2]) AND (b.user_id = ( SELECT auth.uid() AS uid)) AND (b.status = 'pending_payment'::text) AND (b.expires_at > now()))))));

CREATE POLICY "Event cover images are public" ON storage.objects AS PERMISSIVE FOR SELECT TO public
USING ((bucket_id = 'event-covers'::text));

CREATE POLICY "Owners and admins delete event covers" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
USING (((bucket_id = 'event-covers'::text) AND (( SELECT private.current_profile_role() AS current_profile_role) = ANY (ARRAY['owner'::text, 'admin'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "Owners and admins read payment receipts" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
USING (((bucket_id = 'payment-receipts'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])))));

CREATE POLICY "Owners and admins update event covers" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
USING (((bucket_id = 'event-covers'::text) AND (( SELECT private.current_profile_role() AS current_profile_role) = ANY (ARRAY['owner'::text, 'admin'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))
WITH CHECK (((bucket_id = 'event-covers'::text) AND (( SELECT private.current_profile_role() AS current_profile_role) = ANY (ARRAY['owner'::text, 'admin'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "Owners and admins upload event covers" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (((bucket_id = 'event-covers'::text) AND (( SELECT private.current_profile_role() AS current_profile_role) = ANY (ARRAY['owner'::text, 'admin'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
```

Important semantics preserved:
- Public SELECT for objects in `event-covers`.
- Owner/admin event-cover INSERT, UPDATE, and DELETE are bound to the caller's first path segment.
- Customer receipt INSERT is bound to caller UUID, booking UUID, booking ownership, pending-payment state, and non-expiry.
- Receipt SELECT permits the caller's own path or platform owner/admin/supervisor.
- Receipt bucket remains private and upload remains INSERT-only; no UPDATE/UPSERT permission is introduced.

## 3. Scheduled jobs

The production jobs are active and run as database user `postgres`. The exact job names, schedules, and SQL commands are:

```sql
-- DRAFT ONLY. Run as postgres only after worker routines and pg_cron exist.
-- cron.schedule with an existing same-name job replaces that job; verify target job state first.

SELECT cron.schedule('haddir-event-reminders', '*/5 * * * *', 'select private.generate_event_reminders();');
SELECT cron.schedule('haddir-expire-pending-bookings', '* * * * *', 'select private.expire_pending_bookings();');
```

- `haddir-event-reminders`: every five minutes, calls `private.generate_event_reminders()`.
- `haddir-expire-pending-bookings`: every minute, calls `private.expire_pending_bookings()`.

The job IDs in the production catalog are not portable and are intentionally not hard-coded; job names are the stable identifiers. Do not create duplicates or run the jobs during a baseline test until the relevant worker side effects and notification/push integrations are isolated.

## 4. Platform prerequisites

- Supabase-managed `storage`, `auth`, `vault`, `cron`, and `net` schemas must already exist.
- `pg_cron` and `pg_net` must be provisioned by the target Supabase environment at compatible versions.
- The two worker routines must exist and have the intended postgres-only EXECUTE permissions.
- The push dispatch trigger requires the named Vault secrets and the Edge Function endpoint to be configured separately. Secret values and credentials are intentionally excluded.
- Bucket configuration must be applied through the supported Supabase configuration workflow, not by recreating Storage tables.

## 5. Validation boundary

- The bucket, policy, and cron definitions were cross-checked against the preserved production catalog JSON.
- No bucket configuration, Storage policy, cron job, secret, Edge Function, or Storage object was changed.
- No cron job was executed.
- This draft has not been applied to a local or disposable Supabase runtime.
- Do not place this file under `supabase/migrations/` or replay it against production.
