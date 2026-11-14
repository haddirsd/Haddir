# Draft object ownership and privilege reconstruction

**Status: catalog-derived draft only. Not executable or tested. Do not apply to production.**

Source evidence:
- `../production-catalog/functions-and-grants.json` — 333 table-grant rows, 1,961 column-privilege rows, and 32 routine definitions.
- `DEPENDENCY_ORDER_REVIEW.md` — exact per-signature routine EXECUTE ACL inventory.
- `ACCESS_CONTROL_STORAGE_CRON.md` — schema ACL and default-privilege findings.

This file deliberately reconstructs only app-object ACLs visible in the preserved evidence. It does not create roles, memberships, schemas, or hosted-platform defaults.

## Important interpretation of column privileges

The catalog export's `column_grants` array includes table-level privileges expanded across each table column. Comparing it with table-level grants leaves exactly **three explicit column-only grants**:
- `authenticated`: UPDATE `public.profiles(full_name, phone)`
- `authenticated`: UPDATE `public.notifications(is_read)`

Do not interpret the other column-privilege rows as independent per-column grants.

## Execution prerequisites and safety

- Target must be a compatible Supabase project where `anon`, `authenticated`, and `service_role` already exist.
- All 16 app tables and all 32 routines must already exist with the exact identity signatures.
- Execute under the intended privileged migration owner after confirming object ownership.
- `postgres` owns all 16 application tables and all 32 routines in production. Creating them as `postgres` preserves that ownership; this draft does not include owner-changing commands.
- `public` schema is Supabase-managed in this project. Do not recreate it or change its owner.
- The app-owned `private` schema must already exist. Its observed ACL is USAGE for authenticated and USAGE/CREATE for postgres. This file includes only the grants needed to express that ACL; the schema owner remains postgres.
- Do not copy Supabase-managed role memberships.
- Do not copy project default privileges. They include broad hosted-platform grants and must not become generic defaults.
- The ACL inventory records existing production permissions; it is not a least-privilege endorsement. In particular, anon/authenticated table grants are broad on several tables but RLS remains enabled. Keep this faithful-recovery evidence separate from any later hardening change.

## Schema ACL

```sql
-- private schema is app-owned; create it in the schema stage, not here.
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE, CREATE ON SCHEMA private TO postgres;

-- public schema is managed by Supabase and is not created or re-owned here.
-- Observed: USAGE to PUBLIC, anon, authenticated, service_role;
-- CREATE to pg_database_owner and postgres.
-- Reconcile these with the target project's platform-managed schema ACL rather
-- than blindly changing public schema privileges from an application bootstrap.
```

## Table-level ACLs

The following statements are grouped by table and grantee from the captured catalog. No grant option was observed for these rows. Owner privileges for postgres are supplied by object ownership and are not redundantly emitted.

```sql
GRANT SELECT ON TABLE public.admin_activity_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_activity_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.booking_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.booking_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.booking_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bookings TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bookings TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bookings TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.checkins TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.checkins TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.checkins TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.email_outbox TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_payment_accounts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_payment_accounts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_payment_accounts TO service_role;
GRANT SELECT ON TABLE public.event_role_assignments TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_role_assignments TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO service_role;
GRANT SELECT ON TABLE public.gatekeeper_scan_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.gatekeeper_scan_logs TO service_role;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notifications TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_methods TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_methods TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_methods TO service_role;
GRANT SELECT ON TABLE public.payment_submissions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_submissions TO service_role;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.push_subscriptions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.push_subscriptions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_types TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_types TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_types TO service_role;
GRANT SELECT ON TABLE public.tickets TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tickets TO service_role;
```

## Explicit column-only ACLs

```sql
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;
GRANT UPDATE (full_name, phone) ON TABLE public.profiles TO authenticated;
```

## Routine EXECUTE ACLs

Each signature is first revoked from PUBLIC and the application roles so PostgreSQL's default PUBLIC EXECUTE does not leak through on newly created functions. Then the observed grants are reapplied. Object owner postgres retains inherent owner privileges. The explicit PUBLIC EXECUTE grant on `public.set_updated_at()` is preserved as an observed exception.

```sql
REVOKE ALL ON FUNCTION private.admin_search_profiles(text, integer, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_search_profiles(text, integer, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION private.admin_update_profile_role(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_update_profile_role(uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.capture_admin_activity() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.current_profile_role() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_profile_role() TO authenticated;
REVOKE ALL ON FUNCTION private.current_user_is_owner() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_user_is_owner() TO authenticated;
REVOKE ALL ON FUNCTION private.dispatch_haddir_web_push() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enqueue_booking_notification_email() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.expire_pending_bookings() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.gatekeeper_manual_ticket_action(text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.gatekeeper_manual_ticket_action(text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION private.gatekeeper_ticket_action(text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.gatekeeper_ticket_action(text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION private.gatekeeper_ticket_action_core(text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.gatekeeper_ticket_action_core(text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION private.generate_event_reminders() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_advertiser_event_statistics() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_advertiser_event_statistics() TO authenticated;
REVOKE ALL ON FUNCTION private.get_gatekeeper_scan_history(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_gatekeeper_scan_history(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.get_gatekeeper_scan_stats(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_gatekeeper_scan_stats(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.save_admin_event(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.save_admin_event(uuid, jsonb, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_search_profiles(text, integer, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_profiles(text, integer, integer, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_update_profile_role(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_role(uuid, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_booking(uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, uuid, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gatekeeper_manual_ticket_action(text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gatekeeper_manual_ticket_action(text, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gatekeeper_ticket_action(text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gatekeeper_ticket_action(text, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_advertiser_event_statistics() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_advertiser_event_statistics() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_gatekeeper_manual_history(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gatekeeper_manual_history(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_gatekeeper_scan_history(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gatekeeper_scan_history(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_gatekeeper_scan_stats(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gatekeeper_scan_stats(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_haddir_push_config() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_haddir_push_config() TO service_role;
REVOKE ALL ON FUNCTION public.review_payment_submission(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_payment_submission(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_admin_event(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_admin_event(uuid, jsonb, jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_payment(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_payment(uuid, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_haddir_push_subscription(text, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_haddir_push_subscription(text, jsonb, text) TO authenticated, service_role;
```

## Deliberate exclusions

- No `ALTER DEFAULT PRIVILEGES` statements: the production defaults are configured for postgres and supabase_admin and are deployment-specific.
- No grants to or creation of Supabase-managed roles beyond the existing role names used as grantees.
- No role memberships.
- No sequence grants: the app schema inventory contains no public sequences.
- No storage schema/table grants or Storage object policies: those are separately documented in `ACCESS_CONTROL_STORAGE_CRON.md`.
- No cron job creation or execution.
- No Vault secret values or Edge Function credentials.

## ACL findings kept separate from faithful recovery

- Authenticated has table-level UPDATE on eight application tables, including bookings, events, ticket types, payment methods, and push subscriptions; RLS and function-level authorization remain separate enforcement layers.
- Anon has broad table-level privileges on seven application tables. Their effective row access is constrained by RLS, but this grant surface is a least-privilege review item.
- Authenticated has only the three explicit column-only UPDATE grants listed above on profiles and notifications; the broader column-grant export is table-grant expansion.
- `private.gatekeeper_ticket_action_core(text, boolean)` currently grants EXECUTE to authenticated, but the workflow audit flags this as unnecessary and risky because direct invocation bypasses wrapper scan logging. The statement above reflects the observed grant for faithful reconstruction; do not promote it as an endorsed final permission. A deliberate hardening patch must revoke it and be tested separately.
- `public.get_haddir_push_config()` remains restricted to postgres and service_role; it returns Vault-backed secret configuration.
- `public.set_updated_at()` retains the observed PUBLIC EXECUTE exception.

## Validation gate

Before any execution:
1. Compare every generated table grant and function grant against the target catalog.
2. Verify schema USAGE/CREATE grants and object owners.
3. Confirm RLS remains enabled on all 16 public tables and all 29 policies are installed.
4. Run a role-by-role effective privilege check (including PUBLIC inheritance) and Supabase security advisors.
5. Execute in a disposable compatible PostgreSQL/Supabase environment and test application flows.
6. Review the two high-priority workflow findings before calling the system hardened.

No production ACL, role, schema, or object was changed while producing this draft.
