# Production access-control, Storage, and scheduled-job evidence

Status: read-only production inventory. This document records observed configuration; it is not deployment SQL.

## Storage buckets

| Bucket | Public | Max object size | Allowed MIME types |
|---|---:|---:|---|
| `event-covers` | yes | 10 MiB | image/jpeg, image/png, image/webp, image/gif, image/avif |
| `payment-receipts` | no | 5 MiB | image/jpeg, image/png, image/webp |

Both buckets have no explicit owner value in the catalog. Creation/update timestamps were captured in the production catalog query on 2026-11-14.

## Storage object policies (6)

All six observed policies are PERMISSIVE on `storage.objects`.

1. **Event cover images are public** — SELECT to PUBLIC for objects in `event-covers`.
2. **Owners and admins upload event covers** — INSERT to authenticated; bucket must be `event-covers`, caller must be owner/admin, and first path segment must equal `auth.uid()`.
3. **Owners and admins update event covers** — UPDATE with matching USING and WITH CHECK constraints for the same bucket, roles, and user-owned path.
4. **Owners and admins delete event covers** — DELETE under the same bucket, role, and path restrictions.
5. **Customers upload own payment receipts** — INSERT to authenticated for `payment-receipts`; first path segment must equal the caller UUID and the second segment must identify a booking owned by that user, in `pending_payment` state, and not expired.
6. **Owners and admins read payment receipts** — SELECT to authenticated for the user's own receipt path, or for callers whose profile role is owner/admin/supervisor.

Security review notes:
- The receipt-read policy's name says “Owners and admins” but its expression also permits `supervisor`; the actual expression, not the label, is authoritative.
- The receipt bucket is private; do not change it to public during reconstruction.
- Receipt uploads are INSERT-only in the captured policy set. Do not add UPDATE/UPSERT permissions unless a separate verified requirement proves they exist in production.
- Public cover-image reads are intentional in the observed policy; writes remain restricted to owner/admin and user-prefixed paths.

## Scheduled jobs (2 active)

| Job | Schedule | Database / role | Command |
|---|---|---|---|
| `haddir-event-reminders` | `*/5 * * * *` (every 5 minutes) | postgres / postgres | `select private.generate_event_reminders();` |
| `haddir-expire-pending-bookings` | `* * * * *` (every minute) | postgres / postgres | `select private.expire_pending_bookings();` |

Only command text without credentials was retained. No cron job was changed or executed as part of this inspection.

## Grants and default privileges

A read-only ACL inventory was taken for public/private application objects, schemas, and default privileges.

- All observed application tables and routines are owned by `postgres`.
- The direct `public` schema ACL grants USAGE to `PUBLIC`, `pg_database_owner`, and `postgres`; CREATE is held by `pg_database_owner` only. `anon`, `authenticated`, and `service_role` inherit USAGE through PUBLIC rather than receiving separate direct schema ACL entries.
- `private` schema grants USAGE to authenticated and USAGE/CREATE to postgres. Authenticated has no CREATE grant.
- Private routine EXECUTE ACLs are selective: internal worker/trigger routines are postgres-only; selected application RPC/helper routines also grant authenticated.
- Public routine EXECUTE ACLs vary by routine. `set_updated_at()` is the notable exception with EXECUTE granted to PUBLIC (and consequently available to anon/authenticated); do not generalize this to other routines.
- Column-level UPDATE grants are limited to `profiles.full_name`, `profiles.phone`, and `notifications.is_read`, each granted to `authenticated` without grant option.
- Default privileges are configured for both `postgres` and `supabase_admin` in `public`. They grant broad table privileges (including PostgreSQL 17's `MAINTAIN` privilege) to anon/authenticated/service_role, sequence SELECT/UPDATE/USAGE, and function EXECUTE. These are Supabase/project-specific defaults, not safe generic bootstrap defaults.

Important review gate:
- The current catalog includes broad table-level SQL privileges for anon/authenticated on some application tables. RLS is enabled on all 16 public application tables, so grants and row policies must be considered together. This observation is not, by itself, proof of an exploitable data leak; each policy and table's effective access path needs a deliberate security review.
- Do not copy blanket grants or default privileges into the baseline. Reconstruct object-by-object ACLs and preserve only verified grants.
- Do not recreate Supabase-managed roles, memberships, or managed schemas. The default ACL entries for `supabase_admin` are evidence of the hosted platform configuration, not instructions to create that role in a generic PostgreSQL environment.

## 2026-11-14 live reconciliation and runtime checks

A fresh catalog-only query was run against production and compared with `supabase/recovery/production-catalog/storage-rls-cron.json` and `baseline/70-storage-cron-draft.md`.

- Buckets: **2/2 exact matches** for ID, public/private flag, byte size limit, and MIME allow-list. Production reports `STANDARD` type, versioning disabled, no explicit lifecycle configuration, and null owner fields for both buckets.
- Storage policies: **6/6 exact matches** for policy name, command, role, permissive mode, USING, and WITH CHECK expressions. No extra `storage.objects` policies were observed.
- Cron: **2/2 exact matches** for job name, active state, schedule, database, execution user, and command.
- Required routines: both cron targets exist, are owned by `postgres`, are SECURITY DEFINER, and have explicit empty `search_path`.
- Extensions observed: `pg_cron 1.6.4` in `pg_catalog`, `pg_net 0.20.4` in `extensions`; the catalog also reports `supabase_vault 0.3.1`.
- Cron run history over the latest 24 hours at inspection time: `haddir-event-reminders` **288 succeeded / 0 failed**; `haddir-expire-pending-bookings` **1,440 succeeded / 0 failed**. Latest recorded executions were at 2026-11-14 21:10 UTC. This verifies scheduler invocations, not the business correctness of every notification or expiration result.
- The two migration ledger entries are present in production: `20261105131539 / event_reminder_notifications` and `20261107100841 / expire_pending_bookings_and_serialize_inventory`. The expiration migration timestamp matches the GitHub file; the reminder migration's GitHub filename timestamp is `20261105190000`, which differs from the production ledger version `20261105131539`. This is a migration-history identity mismatch, not a difference in the observed live job definition.
- Application integration spot-check: the receipt API enforces exactly JPEG/PNG/WebP and 5 MiB, uploads to `payment-receipts` using `<user UUID>/<booking UUID>/<random file>` and `upsert: false`; admin screens create 15-minute signed URLs for the private bucket. Cover uploads use `event-covers`, a user-UUID-prefixed path, `upsert: false`, and a 10 MiB client size check.
- Minor client-validation mismatch: the cover uploader accepts any browser MIME beginning with `image/`, while the bucket allow-list accepts only JPEG/PNG/WebP/GIF/AVIF. Storage remains the enforcing boundary, but unsupported image formats may fail only after upload is attempted; align the client allow-list in a separate application change if desired.
- **Repository configuration gap:** `supabase/config.toml` is absent from the inspected recovery branch (and no active bucket configuration file was found by repository search). The TOML bucket excerpt remains only in the quarantined recovery draft; it is not an active local Supabase CLI config. Do not mistake the smoke-test's parsed excerpt for a checked-in active config.
- All queries in this reconciliation were read-only. No bucket, policy, cron job, extension, secret, Storage object, production schema, or application data was changed. No scheduled job was manually invoked.

## Reproduction boundary

This evidence does not include Storage object data, Auth user data, Vault secrets, API keys, or cron credentials. The bucket and policy configuration plus cron job definitions still need dependency/order review before any executable baseline can be proposed.

The corresponding non-executable configuration draft is preserved in `baseline/70-storage-cron-draft.md`. No production changes, migrations, or Vercel deployments were performed.
