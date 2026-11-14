# Baseline dependency-order review

Status: **read-only evidence review; documentation only; no executable SQL approved**.

Reviewed against the production catalog on 2026-11-14. This document defines a proposed reconstruction order. It does not claim to reproduce the original migration sequence.

## 1. Platform prerequisites (do not recreate blindly)

The live project reports these installed extensions:

| Extension | Schema | Observed version |
|---|---|---:|
| pg_cron | pg_catalog | 1.6.4 |
| pg_net | extensions | 0.20.4 |
| pg_stat_statements | extensions | 1.11 |
| pgcrypto | extensions | 1.3 |
| plpgsql | pg_catalog | 1.0 |
| supabase_vault | vault | 0.3.1 |
| uuid-ossp | extensions | 1.1 |

The following schemas and objects are Supabase/platform prerequisites, not app-owned bootstrap targets: `auth`, `storage`, `vault`, `extensions`, `cron`, `net`, and platform roles such as `anon`, `authenticated`, and `service_role`.

The app-owned `private` schema is required. Its observed ACL is USAGE for `authenticated`, and USAGE/CREATE for `postgres`; do not grant CREATE to application roles. The `public` schema is platform-managed in this project and must not be recreated.

Extension presence is evidence, not an instruction to install every extension in a generic PostgreSQL instance. Before a future executable build, map actual function/operator references to required extensions and verify compatible versions and Supabase-managed prerequisites.

## 2. Table creation and defaults

All 16 public application tables can be created as a first table stage **without foreign-key constraints**. Their column defaults observed in production use built-in expressions/constants such as `gen_random_uuid()`, `now()`, booleans, integers, text literals, JSONB literals, and the `SDG` currency literal. No observed column default calls an application-defined routine.

This avoids a table/function cycle: create table shells first, then add foreign keys after all referenced tables and platform targets exist. The current table draft already separates constraints from table definitions.

Recommended table stage (ordering is organizational, not a topological requirement while FKs are omitted):

1. `profiles`
2. `events`
3. `ticket_types`
4. `event_payment_accounts`
5. `event_role_assignments`
6. `bookings`
7. `booking_items`
8. `payment_methods`
9. `payment_submissions`
10. `tickets`
11. `checkins`
12. `gatekeeper_scan_logs`
13. `notifications`
14. `email_outbox`
15. `push_subscriptions`
16. `admin_activity_log`

The order above makes the principal business entities easy to inspect first. It does not replace the later constraint stage.

## 3. Foreign-key dependency map

Production has 32 observed foreign-key constraints. All 16 application tables should exist before adding these constraints. The references to `auth.users` require the Supabase Auth schema to be present.

| Child table | Referenced table(s) |
|---|---|
| `profiles` | `auth.users` |
| `events` | `auth.users` |
| `ticket_types` | `events` |
| `event_payment_accounts` | `events` |
| `event_role_assignments` | `profiles`, `events` |
| `bookings` | `events`, `auth.users` |
| `booking_items` | `bookings`, `ticket_types` |
| `payment_submissions` | `bookings`, `auth.users` |
| `tickets` | `booking_items`, `bookings`, `events`, `ticket_types` |
| `checkins` | `tickets`, `events`, `auth.users` |
| `gatekeeper_scan_logs` | `events`, `tickets`, `auth.users` |
| `notifications` | `bookings`, `auth.users` |
| `email_outbox` | `bookings`, `notifications`, `auth.users` |
| `push_subscriptions` | `auth.users` |
| `admin_activity_log` | `profiles`, `bookings`, `events` |
| `payment_methods` | no foreign keys observed |

Preserve each catalog-captured FK definition exactly, including `ON DELETE` actions. Do not infer or normalize delete behavior from this summary; use the detailed constraints draft as the source for the exact SQL.

## 4. Routine ordering

The current `10-routines-draft.sql.md` is alphabetically organized and explicitly not dependency-ordered. It must not be used as the final creation order.

Proposed stages after table creation:

1. Create `private` schema with its reviewed owner and minimal schema ACL.
2. Create table-independent utility/trigger functions only after verifying their referenced objects.
3. Create private application helpers, including role/owner helpers. These helpers query application tables, so they belong after the table stage.
4. Create private business routines and worker routines.
5. Create public RPC wrappers only after their private implementation targets exist.
6. Reconcile exact owners, SECURITY DEFINER/INVOKER mode, empty `search_path`, and per-signature EXECUTE ACLs.
7. Add constraints/indexes before policies where indexes support constraints or policy/query paths.
8. Enable RLS and create policies only after every referenced helper routine exists.
9. Create triggers only after both their target tables and trigger functions exist.
10. Treat Storage policies/buckets and cron jobs as separate platform configuration stages after their referenced routines and schemas are available.

Static body scan of the 32 captured definitions identified these direct application-routine calls (the PL/pgSQL bodies still require manual review; dynamic SQL and indirect dependencies may not be captured):

| Calling routine | Called routine |
|---|---|
| `private.admin_search_profiles` | `private.current_profile_role` |
| `private.admin_update_profile_role` | `private.current_profile_role` |
| `private.gatekeeper_manual_ticket_action` | `private.gatekeeper_ticket_action_core` |
| `private.gatekeeper_ticket_action` | `private.gatekeeper_ticket_action_core` |
| `private.save_admin_event` | `private.current_profile_role` |
| `public.admin_search_profiles` | `private.admin_search_profiles` |
| `public.admin_update_profile_role` | `private.admin_update_profile_role` |
| `public.gatekeeper_manual_ticket_action` | `private.gatekeeper_manual_ticket_action` |
| `public.gatekeeper_ticket_action` | `private.gatekeeper_ticket_action` |
| `public.get_advertiser_event_statistics` | `private.get_advertiser_event_statistics` |
| `public.get_gatekeeper_scan_history` | `private.get_gatekeeper_scan_history` |
| `public.get_gatekeeper_scan_stats` | `private.get_gatekeeper_scan_stats` |
| `public.review_payment_submission` | `private.current_profile_role` |
| `public.save_admin_event` | `private.save_admin_event` |

`private.current_profile_role()` and `private.current_user_is_owner()` are separate SQL helpers that query `public.profiles`; the captured body of `current_profile_role()` does not call `current_user_is_owner()`. Do not invent a helper-to-helper dependency between them.

Important known routine dependencies from source review:
- `private.admin_search_profiles` and `private.admin_update_profile_role` call `private.current_profile_role()`.
- `private.current_profile_role()` and `private.current_user_is_owner()` depend on the application profile/role data model.
- `public.admin_search_profiles`, `public.admin_update_profile_role`, and `public.save_admin_event` are wrappers around private implementations and must be created after those private routines.
- Gatekeeper public/private routines share a core implementation; inspect the exact source before assigning creation order.
- Policies depend on `private.current_profile_role()` and `private.current_user_is_owner()`; they must be created after these helpers.
- Trigger bindings depend on the corresponding trigger functions and tables; do not create triggers during table creation.

PostgreSQL's dependency catalog does not provide a complete dependency graph for PL/pgSQL body references. A catalog query returning no routine-to-routine edges is therefore not proof of independence. The source definitions must be statically reviewed, and actual creation must be tested in a compatible PostgreSQL/Supabase environment.

## 5. Trigger-to-table dependency map

A fresh `pg_trigger` inventory confirms 12 distinct non-internal triggers across eight tables. Their target tables and trigger functions are:

| Table | Trigger | Timing / events | Trigger function |
|---|---|---|---|
| `bookings` | `audit_bookings` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |
| `bookings` | `bookings_set_updated_at` | BEFORE UPDATE | `public.set_updated_at()` |
| `event_payment_accounts` | `audit_event_payment_accounts` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |
| `events` | `audit_events` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |
| `events` | `events_set_updated_at` | BEFORE UPDATE | `public.set_updated_at()` |
| `notifications` | `dispatch_haddir_web_push_after_insert` | AFTER INSERT | `private.dispatch_haddir_web_push()` |
| `payment_submissions` | `audit_payment_submissions` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |
| `profiles` | `audit_profiles` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |
| `profiles` | `profiles_set_updated_at` | BEFORE UPDATE | `public.set_updated_at()` |
| `ticket_types` | `audit_ticket_types` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |
| `ticket_types` | `ticket_types_set_updated_at` | BEFORE UPDATE | `public.set_updated_at()` |
| `tickets` | `audit_tickets` | AFTER INSERT OR UPDATE OR DELETE | `private.capture_admin_activity()` |

The trigger stage therefore requires the seven target tables and three trigger functions (`private.capture_admin_activity()`, `private.dispatch_haddir_web_push()`, and `public.set_updated_at()`) to exist first. The notification push trigger also depends operationally on its external push-dispatch configuration; do not assume that creating the trigger alone configures delivery.

The four `*_set_updated_at` triggers are BEFORE UPDATE and must remain distinct per table. Audit triggers are AFTER row triggers. Preserve the captured trigger definitions rather than regenerating them from the 26 event-expanded information-schema rows.

## 6. Exact routine ACL inventory

The following EXECUTE ACLs were read from `pg_proc.proacl` by schema, routine name, and identity arguments. `X` means EXECUTE. `PUBLIC` is represented by the empty grantee before `=X`.

| Routine signature | EXECUTE grantees observed |
|---|---|
| `private.admin_search_profiles(text, integer, integer, text)` | postgres, authenticated |
| `private.admin_update_profile_role(uuid, text, uuid)` | postgres, authenticated |
| `private.capture_admin_activity()` | postgres |
| `private.current_profile_role()` | postgres, authenticated |
| `private.current_user_is_owner()` | postgres, authenticated |
| `private.dispatch_haddir_web_push()` | postgres |
| `private.enqueue_booking_notification_email()` | postgres |
| `private.expire_pending_bookings()` | postgres |
| `private.gatekeeper_manual_ticket_action(text, boolean)` | postgres, authenticated |
| `private.gatekeeper_ticket_action(text, boolean)` | postgres, authenticated |
| `private.gatekeeper_ticket_action_core(text, boolean)` | postgres, authenticated |
| `private.generate_event_reminders()` | postgres |
| `private.get_advertiser_event_statistics()` | postgres, authenticated |
| `private.get_gatekeeper_scan_history(uuid)` | postgres, authenticated |
| `private.get_gatekeeper_scan_stats(uuid)` | postgres, authenticated |
| `private.handle_new_user()` | postgres |
| `private.save_admin_event(uuid, jsonb, jsonb, jsonb)` | postgres, authenticated |
| `public.admin_search_profiles(text, integer, integer, text)` | postgres, authenticated, service_role |
| `public.admin_update_profile_role(uuid, text, uuid)` | postgres, authenticated, service_role |
| `public.create_booking(uuid, uuid, integer)` | postgres, authenticated, service_role |
| `public.gatekeeper_manual_ticket_action(text, boolean)` | postgres, authenticated, service_role |
| `public.gatekeeper_ticket_action(text, boolean)` | postgres, authenticated, service_role |
| `public.get_advertiser_event_statistics()` | postgres, authenticated, service_role |
| `public.get_gatekeeper_manual_history(uuid)` | postgres, service_role |
| `public.get_gatekeeper_scan_history(uuid)` | postgres, authenticated, service_role |
| `public.get_gatekeeper_scan_stats(uuid)` | postgres, authenticated, service_role |
| `public.get_haddir_push_config()` | postgres, service_role |
| `public.review_payment_submission(uuid, text, text)` | postgres, authenticated, service_role |
| `public.save_admin_event(uuid, jsonb, jsonb, jsonb)` | postgres, authenticated, service_role |
| `public.set_updated_at()` | PUBLIC, postgres, anon, authenticated, service_role |
| `public.submit_payment(uuid, text, text, text)` | postgres, authenticated, service_role |
| `public.sync_haddir_push_subscription(text, jsonb, text)` | postgres, authenticated, service_role |

These are observed ACL entries, not an endorsement that every current grant is ideal. Preserve exact grants only after the security review approves them. In particular, `public.get_haddir_push_config()` returns Vault-backed secret configuration and must remain unavailable to `anon` and `authenticated`; the observed EXECUTE ACL is postgres/service_role only. `public.set_updated_at()` has PUBLIC EXECUTE in production; this exception must be consciously reviewed rather than generalized.

All 32 routines are owned by `postgres` and have an explicitly empty `search_path`. The inventory distinguishes routine signatures to avoid accidentally merging overloaded names.

## 8. Proposed baseline phase order

| Phase | Objects |
|---|---|
| 0 | Verify compatible Supabase platform prerequisites; do not recreate managed schemas/roles |
| 1 | App-owned `private` schema and minimum schema ACL |
| 2 | 16 public application tables, without FKs |
| 3 | Private/public routines in dependency-aware order, with exact security attributes |
| 4 | 81 constraints and 33 standalone indexes, preserving exact definitions |
| 5 | RLS enablement and 29 policies |
| 6 | 12 distinct triggers (26 event bindings are not 26 separate trigger objects) |
| 7 | Storage bucket configuration and six Storage policies |
| 8 | Two cron jobs, only after worker routines and platform integrations are verified |
| 9 | Object grants, column grants, and carefully scoped default privileges after a least-privilege review |
| 10 | PostgreSQL/Supabase-compatible validation and application smoke tests in a non-production environment |

The ordering of grants is deliberately late in the proposed sequence, but function EXECUTE ACLs must be applied as part of the routine security stage and checked before policies or application tests rely on them. Do not copy broad project default privileges.

## 9. Open validation gates

- Inspect all 32 routine definitions for cross-routine calls and managed extension references, including SQL wrappers, trigger functions, cron workers, Vault, and `net`.
- Constraint/index audit is documented in `CONSTRAINTS_INDEXES_REVIEW.md`: 81 constraints (16 PK, 8 UNIQUE, 32 FK, 25 CHECK), all validated and non-deferrable; 57 indexes, all valid/ready; two FKs have no child-side leading index; and one redundant unique index duplicates a constraint-backed key. The global UNIQUE on `event_role_assignments.user_id` is a product-rule confirmation item.
- Verify whether every required extension is already provisioned by the target Supabase project; do not assume extension installation rights in generic PostgreSQL.
- Confirm exact trigger-to-table bindings and trigger firing order.
- Reconcile every table/column grant and every default ACL entry against least privilege.
- Reconcile exact constraint and index definitions, including predicates and operator classes.
- Validate the full staged build in a real compatible PostgreSQL runtime. The current workspace has no PostgreSQL server, psql, Docker, or Supabase CLI, so no execution test has occurred.

## Safety statement

This review used read-only production catalog queries and source/document inspection. No production DDL/data was changed, no migrations were run, no paid branch/resource was created, no Vercel deployment was triggered, and `main` was not modified. All baseline SQL remains quarantined in Markdown drafts and is not approved for execution.


## 10. Source-level routine dependency scan (completed)

A separate source scan of all 32 definitions is recorded in `ROUTINE_DEPENDENCY_AUDIT.md`. It confirms 32 unique schema-qualified names, 18 PL/pgSQL and 14 SQL routines, and the 14 direct caller/callee edges listed below. No direct application-routine call cycle was found.

- Role helper prerequisites: `private.current_profile_role()` and `private.current_user_is_owner()` follow table creation; the captured definitions do not call one another.
- Private implementation prerequisites: `private.gatekeeper_ticket_action_core()` precedes both private gatekeeper wrappers.
- Private callers follow their helper: admin search/update and event-save routines follow `private.current_profile_role()`.
- Public SQL wrappers follow their private targets: admin search/update, gatekeeper QR/manual, advertiser statistics, gatekeeper history/stats, and event-save wrappers.
- Remaining public PL/pgSQL routines follow table and platform prerequisites.

The scan also recorded direct Auth, Storage, Vault, pg_net, and advisory-lock dependencies. It is lexical/static source review; it cannot establish full PostgreSQL dependency resolution or prove PL/pgSQL runtime compilation. SQL wrappers have an especially strict creation-order dependency because their referenced private functions are resolved as SQL function bodies are created.

The email enqueue function has no corresponding active trigger in the preserved 12-trigger inventory; do not invent one. The push trigger depends on Vault and pg_net configuration as well as the trigger function. Keep all secret values outside the repository.

See `ROUTINE_DEPENDENCY_AUDIT.md` for the full call graph, managed-platform dependency matrix, creation groups, ACL-sensitive notes, and outstanding validation gates.


## 11. RLS and trigger draft cross-check (completed)

The SQL blocks in the policy, trigger, and table drafts were cross-checked directly:

- 16 `CREATE TABLE` definitions are present.
- 29 `CREATE POLICY` statements target 15 of those 16 tables. The remaining table has no RLS policy in the production snapshot; do not invent one.
- The only application helper routines referenced directly by policy expressions are `private.current_profile_role()` and `private.current_user_is_owner()`; both exist in the 32-routine draft.
- 12 `CREATE TRIGGER` statements are present and target eight existing application tables: bookings, event_payment_accounts, events, notifications, payment_submissions, profiles, ticket_types, and tickets.
- The trigger statements reference three captured trigger functions: `private.capture_admin_activity()`, `private.dispatch_haddir_web_push()`, and the unqualified `set_updated_at()` (captured as `public.set_updated_at()`). All three definitions exist in the routine draft.
- No missing policy helper, trigger target table, or trigger function was found in this source-level cross-check.

This corrects the earlier seven-table wording: the live 12-trigger inventory spans **eight** target tables. The audit/activity log table is written by the audit trigger function but is not itself a trigger target.


## 12. Object privilege reconstruction stage

The exact observed application-object grants are now represented in `60-privileges-draft.sql.md`:

- 38 grouped table-grant statements for `anon`, `authenticated`, and `service_role`; owner postgres privileges are represented by ownership rather than redundant GRANT statements.
- Two column-grant statements representing the three explicit column-only UPDATE grants: `profiles.full_name`, `profiles.phone`, and `notifications.is_read`. Column privilege rows expanded from table-level grants were excluded.
- Per-signature EXECUTE ACL reconstruction for all 32 routines, including explicit revocation of PostgreSQL's default PUBLIC EXECUTE before restoring the observed grantees. The `public.set_updated_at()` PUBLIC EXECUTE exception is retained.
- The app-owned `private` schema ACL is recorded; the platform-managed `public` schema ACL is not blindly rewritten.
- No default privileges or Supabase-managed role memberships are recreated.

This is a faithful catalog reconstruction draft, not a least-privilege recommendation. It intentionally records broad anon/authenticated table grants that are constrained by RLS in production. The private gatekeeper core authenticated EXECUTE grant is also recorded as observed but remains a high-priority hardening finding; do not confuse a recovery snapshot with approval of that grant.

The draft ACL statements have not been applied or tested. Before execution, verify every role and object on the target and compare effective privileges, including PUBLIC inheritance, against the intended recovery policy.


## 13. Constraint-stage execution order confirmed by PostgreSQL smoke test

The first PostgreSQL 17 smoke-test attempt exposed an ordering defect in the draft: the alphabetically arranged constraint statements attempted to add foreign keys before the referenced tables' primary/unique constraints existed. PostgreSQL rejected the first FK referencing profiles(id) with “there is no unique constraint matching given keys”.

The draft was reordered without changing any constraint or index definition:

1. 16 primary keys.
2. 8 UNIQUE constraints.
3. 25 CHECK constraints.
4. 32 foreign keys.
5. 33 standalone indexes.

All 81 constraints and 33 index definitions remain byte-for-byte unchanged; only statement order changed. The next isolated PostgreSQL run will verify this corrected order.
