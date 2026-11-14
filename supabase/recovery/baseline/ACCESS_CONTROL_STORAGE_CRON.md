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
- `public` schema grants USAGE to PUBLIC, anon, authenticated, postgres, and service_role; CREATE is held by `pg_database_owner` and postgres.
- `private` schema grants USAGE to authenticated and USAGE/CREATE to postgres. Authenticated has no CREATE grant.
- Private routine EXECUTE ACLs are selective: internal worker/trigger routines are postgres-only; selected application RPC/helper routines also grant authenticated.
- Public routine EXECUTE ACLs vary by routine. `set_updated_at()` is the notable exception with EXECUTE granted to PUBLIC (and consequently available to anon/authenticated); do not generalize this to other routines.
- Column-level UPDATE grants are limited to `profiles.full_name`, `profiles.phone`, and `notifications.is_read`, each granted to `authenticated` without grant option.
- Default privileges are configured for both `postgres` and `supabase_admin` in `public`. They grant broad table privileges to anon/authenticated/service_role, sequence SELECT/UPDATE/USAGE, and function EXECUTE. These are Supabase/project-specific defaults, not safe generic bootstrap defaults.

Important review gate:
- The current catalog includes broad table-level SQL privileges for anon/authenticated on some application tables. RLS is enabled on all 16 public application tables, so grants and row policies must be considered together. This observation is not, by itself, proof of an exploitable data leak; each policy and table's effective access path needs a deliberate security review.
- Do not copy blanket grants or default privileges into the baseline. Reconstruct object-by-object ACLs and preserve only verified grants.
- Do not recreate Supabase-managed roles, memberships, or managed schemas. The default ACL entries for `supabase_admin` are evidence of the hosted platform configuration, not instructions to create that role in a generic PostgreSQL environment.

## Reproduction boundary

This evidence does not include Storage object data, Auth user data, Vault secrets, API keys, or cron credentials. The bucket and policy configuration plus cron job definitions still need dependency/order review before any executable baseline can be proposed.

The corresponding non-executable configuration draft is preserved in `baseline/70-storage-cron-draft.md`. No production changes, migrations, or Vercel deployments were performed.
