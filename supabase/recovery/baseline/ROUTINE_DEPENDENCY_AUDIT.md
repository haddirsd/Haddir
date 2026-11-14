# Routine dependency and creation-order audit

**Status: static source scan completed for all 32 captured definitions; no SQL execution test.**

Source: `supabase/recovery/baseline/10-routines-draft.sql.md`, compared with the production routine inventory and the trigger/ACL catalog evidence. The scan extracted all 32 `CREATE OR REPLACE FUNCTION` definitions, checked each declared language/security mode, and searched every body for direct calls to another captured application routine and references to Supabase-managed services. This is a source-level dependency audit, not PostgreSQL's complete dependency graph: dynamic SQL, operator/function overload resolution, implicit casts, and indirect calls may not be discoverable by text scanning.

## 1. Inventory reconciliation

- 32 definitions found; 32 unique schema-qualified routine names.
- 18 PL/pgSQL routines and 14 SQL routines.
- All 32 were previously confirmed owned by `postgres` and configured with an explicitly empty `search_path`.
- All 16 private routines are SECURITY DEFINER.
- Public SECURITY DEFINER routines: `create_booking`, `get_gatekeeper_manual_history`, `get_haddir_push_config`, `review_payment_submission`, `submit_payment`, and `sync_haddir_push_subscription`.
- No direct self-recursive routine calls or cycles were found in the captured application-routine call graph.

## 2. Direct application-routine call graph

| Caller | Direct callee | Caller language |
|---|---|---|
| `private.admin_search_profiles` | `private.current_profile_role` | PL/pgSQL |
| `private.admin_update_profile_role` | `private.current_profile_role` | PL/pgSQL |
| `private.gatekeeper_manual_ticket_action` | `private.gatekeeper_ticket_action_core` | PL/pgSQL |
| `private.gatekeeper_ticket_action` | `private.gatekeeper_ticket_action_core` | PL/pgSQL |
| `private.save_admin_event` | `private.current_profile_role` | PL/pgSQL |
| `public.admin_search_profiles` | `private.admin_search_profiles` | SQL |
| `public.admin_update_profile_role` | `private.admin_update_profile_role` | SQL |
| `public.gatekeeper_manual_ticket_action` | `private.gatekeeper_manual_ticket_action` | SQL |
| `public.gatekeeper_ticket_action` | `private.gatekeeper_ticket_action` | SQL |
| `public.get_advertiser_event_statistics` | `private.get_advertiser_event_statistics` | SQL |
| `public.get_gatekeeper_scan_history` | `private.get_gatekeeper_scan_history` | SQL |
| `public.get_gatekeeper_scan_stats` | `private.get_gatekeeper_scan_stats` | SQL |
| `public.review_payment_submission` | `private.current_profile_role` | PL/pgSQL |
| `public.save_admin_event` | `private.save_admin_event` | SQL |

The captured bodies of `private.current_profile_role()` and `private.current_user_is_owner()` each query `public.profiles`; neither directly calls the other. Do not add an invented edge between them.

## 3. Dependency-safe creation groups

The following is a safe creation grouping for the captured definitions, subject to the platform prerequisites and real database validation:

1. **Tables first:** all 16 application tables must exist before creating routines whose bodies reference them. Keep foreign keys deferred to the later constraint stage.
2. **Private role helpers:** create `private.current_profile_role()` and `private.current_user_is_owner()` after `public.profiles` exists.
3. **Private routines without captured application-routine callees:** create the remaining private routines, including trigger functions and business implementations. In particular, create `private.gatekeeper_ticket_action_core()` before its two private wrappers.
4. **Private callers/wrappers:** create `private.admin_search_profiles()`, `private.admin_update_profile_role()`, `private.gatekeeper_manual_ticket_action()`, `private.gatekeeper_ticket_action()`, and `private.save_admin_event()` after their private callees.
5. **Public SQL wrappers:** create all public SQL wrappers only after their private implementation targets exist. This is especially important because SQL-language bodies are parsed/resolved at function creation and can fail immediately if the target function is absent.
6. **Remaining public PL/pgSQL routines:** create the booking, payment, gatekeeper-history, payment-review, push-subscription, and timestamp routines after their referenced tables and platform functions/schemas are available.
7. **ACLs and triggers:** apply exact per-signature ownership/security/EXECUTE ACLs as part of the controlled routine stage; create trigger bindings only after the three trigger functions and their target tables exist.

The exact order among independent routines within a group is not semantically required by the captured direct-call graph. The current alphabetically arranged draft is not itself an approved executable ordering.

## 4. Managed-platform dependencies found in routine bodies

| Routine(s) | External/platform dependency | Required target prerequisite |
|---|---|---|
| All routines that call `auth.uid()` | Supabase Auth | `auth` schema and Auth helper available |
| `private.admin_search_profiles` | `auth.users` | Supabase Auth users relation available |
| `private.handle_new_user` | Auth user trigger row shape | Supabase Auth trigger integration must be provisioned separately |
| `private.dispatch_haddir_web_push`, `public.get_haddir_push_config` | `vault.decrypted_secrets` | Supabase Vault schema and named secrets configured outside source control |
| `private.dispatch_haddir_web_push` | `net.http_post` | pg_net installed/configured and network egress permitted |
| `public.submit_payment` | `storage.objects` | Supabase Storage schema/bucket and object policies available |
| `public.create_booking`, `public.review_payment_submission`, `private.expire_pending_bookings` | `pg_advisory_xact_lock` | PostgreSQL advisory-lock support |
| Routines using UUID generation | `gen_random_uuid()` | Compatible PostgreSQL core function / platform version |

No Vault secret values, hook secrets, VAPID private keys, or credentials are included in this report. The push dispatch routine also embeds the current project Edge Function endpoint; this is deployment-specific configuration and must not be generalized or replayed without a separate environment review.

## 5. Trigger routine prerequisites

Production has 12 distinct trigger objects on seven tables. The trigger stage requires these three trigger functions to exist first:

- `private.capture_admin_activity()` — audit triggers on bookings, event payment accounts, events, payment submissions, profiles, ticket types, and tickets.
- `private.dispatch_haddir_web_push()` — notification push dispatch trigger; also requires Vault/pg_net configuration.
- `public.set_updated_at()` — updated-at triggers on bookings, events, profiles, and ticket types.

The notification email enqueue routine is not currently listed among the 12 active trigger bindings in the preserved trigger inventory. Do not invent a trigger for it during reconstruction.

## 6. ACL-sensitive ordering notes

- Preserve the production identity signatures; do not collapse overloads by routine name.
- `public.get_haddir_push_config()` must remain executable only by `postgres` and `service_role`; it reads Vault-backed secret material.
- `private.gatekeeper_ticket_action_core(text, boolean)` currently has an unnecessary authenticated EXECUTE grant in production. The wrappers call it as SECURITY DEFINER and record scan logs; the remediation finding is documented in `WORKFLOW_ROUTINES_AUDIT.md`. Do not silently reproduce this grant as a desirable pattern. A faithful recovery record and a security-hardening change must be kept distinct.
- `public.set_updated_at()` currently has PUBLIC EXECUTE. Preserve or change only through an explicit ACL decision; do not let default function privileges decide accidentally.
- Every function's empty `search_path`, owner, SECURITY DEFINER/INVOKER mode, and grants must be set and verified explicitly.

## 7. Validation still required

- Run the staged definitions on a real PostgreSQL/Supabase-compatible instance; static scanning cannot prove PL/pgSQL body compilation or runtime behavior.
- Verify actual SQL-language wrapper creation order and PL/pgSQL lazy statement resolution on the selected PostgreSQL version.
- Verify managed extension versions and the Auth, Storage, Vault, and pg_net integrations in the target Supabase environment.
- Test trigger execution, cron invocation, Vault access, and Edge Function dispatch without exposing secrets.
- Run regression tests for the known payment-review NULL-decision and gatekeeper-core ACL findings before treating the workflow as hardened.

**No production SQL, grants, triggers, cron jobs, Storage policies, or data were changed by this audit. No migrations were executed and no deployment was triggered.**
