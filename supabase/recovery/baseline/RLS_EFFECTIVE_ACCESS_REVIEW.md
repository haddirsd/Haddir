# Effective RLS and SECURITY DEFINER review

Status: read-only review of the live production catalog and captured function definitions. No policy, grant, or routine was changed.

## Executive result

- RLS is enabled on all 16 public application tables.
- There are 29 PERMISSIVE policies on those tables.
- The `anon` role has matching row policies only for public reads of published events, active payment accounts attached to published events, and active ticket types attached to published events.
- Sensitive tables such as bookings, booking items, profiles, payment submissions, tickets, notifications, check-ins, scan logs, push subscriptions, and admin activity have no anonymous row policy in the captured policy set.
- Authenticated access is mostly row-scoped to the current user or assigned event, with owner/admin/supervisor exceptions where appropriate.
- Broad table-level SQL grants are present for anon/authenticated on multiple tables. RLS currently supplies the row boundary, but the SQL grants are broader than least privilege and should be treated as a hardening backlog item—not copied blindly into a new environment.
- No exploit or data leak was demonstrated by this catalog review. This was not a live adversarial/API penetration test.

## Effective row-policy map

| Table | Anonymous access | Authenticated row scope |
|---|---|---|
| `events` | SELECT published events | Published events; assigned gatekeeper/advertiser events; owner/admin manage all |
| `ticket_types` | SELECT active types for published events | Same public rows; owner/admin manage all |
| `event_payment_accounts` | SELECT active accounts for published events | Same customer rows; owner/admin manage all |
| `bookings` | No row policy | Own bookings; owner/admin/supervisor read all; owner/admin manage |
| `booking_items` | No row policy | Items belonging to own bookings; platform staff read; owner/admin manage |
| `payment_submissions` | No row policy | Own booking submissions; owner/admin/supervisor read submissions |
| `tickets` | No row policy | Own tickets; owner/admin read all |
| `profiles` | No row policy | Own profile; owner can read all; owner/admin staff read; user updates own row |
| `notifications` | No row policy | Own notifications; own-row updates |
| `push_subscriptions` | No row policy | Own subscriptions only |
| `event_role_assignments` | No row policy | Own assignments; owner/admin can read all |
| `gatekeeper_scan_logs` | No row policy | Assigned gatekeepers read logs for their assigned event |
| `checkins` | No row policy | Owner/admin read |
| `admin_activity_log` | No row policy | Owner/admin read |
| `payment_methods` | No row policy | Active methods for customers; owner/admin/supervisor can read inactive; owner/admin manage |
| `email_outbox` | No row policy | No application-role row policy in the captured set; postgres/service_role operate it |

All policies observed were PERMISSIVE. Where a table has multiple SELECT policies, PostgreSQL ORs the applicable permissive policies; do not simplify them into a single policy unless the resulting expression is proven equivalent.

## Notable data-exposure boundary

The public SELECT policy on `event_payment_accounts` exposes the complete row for active payment accounts on published events. The table currently contains `account_name`, `account_number`, and optional `beneficiary` (plus event/status/ordering metadata). This appears consistent with displaying payment instructions to customers, but it is an intentional public disclosure of those payment details. Confirm that only payment destinations intended for public display are stored in this table. If private account metadata is ever added, separate it into a non-public table or expose a narrow view/RPC rather than adding columns to this publicly readable row.

## Broad table grants vs RLS

Catalog ACLs show anon/authenticated table-level grants broader than their row-policy intent on multiple application tables (including write-oriented SQL privileges). RLS is enabled on all 16 public application tables, and the captured policies do not grant anonymous writes. For authenticated users, write policies are limited to:
- owner/admin management policies on selected administrative tables;
- own-row profile updates;
- own notification updates;
- own push-subscription management.

This means the grants alone do not establish that a normal client can write arbitrary rows: RLS still applies to anon/authenticated. However:
1. broad grants increase the impact of any future missing/incorrect RLS policy;
2. they make policy drift harder to notice;
3. they violate least-privilege expectations and should be reduced in a separately planned hardening migration after application call paths are audited.

Do not change production grants as part of migration-history recovery. Do not silently omit them from an exact forensic record either.

## SECURITY DEFINER review highlights

The following function bodies were inspected in the captured production definitions:

- `public.create_booking`: requires `auth.uid()`, caps quantity at 1–5, locks ticket inventory, verifies event/ticket availability, checks customer profile completeness, and creates the booking atomically.
- `public.submit_payment`: requires authentication, constrains receipt path to the caller UUID and booking UUID, verifies booking ownership/status/expiry, verifies the event-specific active payment account, confirms the receipt object exists in the private bucket, then records a submission and moves the booking to review.
- `public.review_payment_submission`: restricts reviewers to owner/admin/supervisor, validates decision/rejection reason, locks the payment and booking, prevents repeat review, issues attendee tickets on approval, and releases inventory on rejection.
- `private.admin_search_profiles` and `private.admin_update_profile_role`: require authentication and owner/admin authorization; role changes protect the owner/admin boundary and validate event-scoped roles.
- `private.save_admin_event`: requires owner/admin and validates event/ticket/payment-account payload structure before writing.
- `private.gatekeeper_ticket_action` and `private.gatekeeper_manual_ticket_action`: require gatekeeper/organizer role and an event assignment before ticket actions.
- `public.sync_haddir_push_subscription`: requires authentication and binds the subscription to `auth.uid()`.
- `public.get_haddir_push_config`: returns VAPID private key and hook secret from Vault. Its observed EXECUTE grants are restricted to postgres and service_role, not anon/authenticated. Keep this server-side only; never expose service_role credentials or call this RPC from browser code.

These are static source inspections, not runtime authorization tests. All 32 routines use an explicit empty search_path, and all are owned by postgres. Keep schema-qualified references when reconstructing them.

## Function ACL and default-privilege cautions

- Preserve routine EXECUTE ACLs by exact signature, not just function name.
- Private worker/trigger functions are postgres-only in the observed ACLs; selected private RPC/helper routines grant authenticated.
- Public RPC grants differ by signature. Do not use blanket EXECUTE grants.
- `public.set_updated_at()` grants EXECUTE to PUBLIC. It is a no-argument trigger helper; preserve the observed state only if reproducing production exactly, and assess whether future hardening should revoke direct execution.
- Default privileges for both postgres and supabase_admin in public include broad table, sequence, and function privileges. In particular, newly created public functions may inherit EXECUTE for anon/authenticated/service_role. This is a material future privilege-drift risk. Do not reproduce hosted-project defaults as generic PostgreSQL defaults without an explicit decision.
- Supabase-managed roles and memberships are platform prerequisites; do not create or alter them in this recovery.

## Recommended next actions (not executed)

1. Keep this recovery branch as forensic documentation; do not change production.
2. Before any future baseline adoption, make a per-signature ACL manifest and compare it with the captured live ACLs.
3. Plan a separate, reviewed least-privilege migration to reduce broad table grants and tighten default privileges, only after checking every frontend/RPC/storage call path.
4. Confirm the public payment-account disclosure is intentional and contains only customer-facing destination details.
5. Run a real PostgreSQL/Supabase-compatible restore test in a free local environment before calling the baseline executable or tested.


## Fresh live-production reconciliation — 2026-11-14

A direct read-only comparison against the active production catalog confirmed:

- All 16 public application tables remain owned by postgres, with RLS enabled and FORCE RLS disabled.
- All 29 policy identities, target tables, roles, commands, USING expressions, and WITH CHECK expressions match the preserved policy snapshot and policy draft. All are PERMISSIVE.
- email_outbox has RLS enabled and no policy, matching production; no policy was invented.
- All 32 routine definitions match production; all are owned by postgres and use an explicit empty search_path. The corrected inventory is 17 private SECURITY DEFINER routines and six public SECURITY DEFINER routines.
- Table and column grant inventories match the live production catalog exactly (333 table-grant rows; 1,961 expanded column-privilege rows). The three explicit column-only UPDATE grants are unchanged.
- The 41 per-signature routine EXECUTE grants in the draft match live production. The authenticated grant on private.gatekeeper_ticket_action_core(text, boolean) remains a high-priority bypass-of-wrapper-logging finding; no production permissions were changed.

This is a metadata/source comparison, not a live role-based API penetration test. No production policy, grant, routine, or schema was changed.
