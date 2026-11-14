# Haddir production baseline — build plan

Status: **first-pass SQL reconstruction artifacts drafted in Markdown; not executable, not tested, and not approved**.

This plan is based on the read-only production catalog evidence stored in this directory. The goal is to preserve the current Haddir application schema as a reproducible baseline without pretending that reconstructed SQL is the original migration history.

## Verified application object inventory

Latest read-only count against production:

| Object | Count |
|---|---:|
| Public application tables | 16 |
| Public table columns | 158 |
| Public constraints | 81 |
| Public indexes | 57 |
| Public RLS policies | 29 |
| Public/private routines | 32 |
| Distinct public trigger objects | 12 |
| Trigger event bindings | 26 |
| Haddir Storage buckets | 2 |
| Storage object policies | 6 |
| Active cron jobs | 2 |

The trigger counts are different measures: multi-event triggers produce multiple rows in `information_schema.triggers`.

## Proposed output layout

Keep all generated artifacts quarantined under `supabase/recovery/baseline/`:

- `README.md` — added with safety boundaries and artifact inventory.
- `10-routines-draft.sql.md` — 32 routine definitions, still requiring dependency/ACL review.
- `20-tables-draft.sql.md` — all 16 public tables / 158 columns.
- `30-constraints-indexes-draft.sql.md` — 81 constraints and 33 standalone index definitions.
- `40-rls-policies-draft.sql.md` — RLS enabled on 16 public tables and 29 policy definitions.
- `50-triggers-draft.sql.md` — 12 distinct trigger definitions.
- `SECURITY_REVIEW.md` — routine ownership, security mode, search_path and EXECUTE ACL review.
- `ACCESS_CONTROL_STORAGE_CRON.md` — exact Storage bucket/policy inventory, cron job definitions, schema/object grants, and default-privilege findings.
- `RLS_EFFECTIVE_ACCESS_REVIEW.md` — effective row-level access matrix, public payment-account data boundary, broad SQL grant/RLS interaction, and static review of key SECURITY DEFINER routines.
- `DEPENDENCY_ORDER_REVIEW.md` — table/FK/function/policy/trigger ordering, observed extension prerequisites, and exact per-signature routine EXECUTE ACL inventory.
- Storage and scheduled jobs remain separate deployment steps and must not be silently omitted from a future full bootstrap.

All SQL is embedded in Markdown with a `.sql.md` suffix deliberately; these are evidence-backed drafts, not deployable SQL files.

## Dependency and safety rules

1. Treat Supabase-managed schemas and roles (`auth`, `storage`, `vault`, `realtime`, `cron`, `net`, and service roles) as platform prerequisites. Do not recreate them.
2. Create the app-owned `private` schema with its reviewed minimum ACL; do not recreate Supabase-managed schemas or roles.
3. Create all 16 application tables without foreign keys first; production column defaults use built-in expressions/constants and no observed app-defined default routine.
4. Create application routines after tables, in source-reviewed dependency order; public SQL wrappers must follow their private implementation targets.
5. Add the 81 constraints and 33 standalone indexes from exact catalog definitions, preserving FK delete actions and avoiding duplicate constraint-backed indexes.
6. Enable RLS and create all 29 policies only after their helper routines exist. Do not substitute broad policies or blanket grants.
7. Create the 12 distinct triggers only after their trigger functions and target tables exist; 26 event bindings are not 26 separate trigger objects.
8. Reconcile per-signature routine EXECUTE ACLs, object grants, column grants, and default privileges; never copy hosted-project defaults blindly.
9. Do not export Vault secret values, auth user data, production rows, or project-specific credentials.
10. Storage buckets/policies and cron jobs need a separate deployment review because they depend on platform schemas, worker routines, URLs, and secrets.
11. Never place a reconstructed baseline in `supabase/migrations` or replay it against production.

## Remaining evidence/review gates

- Review every column's exact type, default, collation, identity/generated status, and nullability against `columns.json`.
- Routine definitions are now drafted. The read-only review found all 32 owned by `postgres`, all with empty `search_path`, and mixed SECURITY DEFINER / INVOKER execution; per-routine EXECUTE ACLs must be reconstructed exactly and reviewed before executable SQL is produced.
- Reconcile the complete grant/default-privilege model with Supabase-managed roles; do not copy managed role memberships into a generic bootstrap.
- Dependency review is documented in `baseline/DEPENDENCY_ORDER_REVIEW.md`: all 16 tables are staged before the 30 foreign keys; observed column defaults do not call application routines; routine ACLs are inventoried by exact signature; policies and triggers are sequenced after their dependencies.
- The same dependency report records installed extension evidence (`pg_cron`, `pg_net`, `pgcrypto`, `pg_stat_statements`, `plpgsql`, `supabase_vault`, `uuid-ossp`). This is not permission or instruction to recreate/install every extension in a generic environment.
- Storage review is now documented in `baseline/ACCESS_CONTROL_STORAGE_CRON.md`: 2 buckets, 6 object policies, and 2 active cron jobs. Preserve the private receipt bucket, public cover reads, user/booking path checks, and the exact cron schedules/functions.
- Grant review is documented alongside Storage: public/private schema ACLs, per-object table/routine grants, three column-level UPDATE grant groups, and default privileges for postgres/supabase_admin. Do not copy the broad hosted-project default ACLs as generic defaults. Reconstruct only verified object-specific grants.
- Security follow-up: the effective policy map is now documented in `baseline/RLS_EFFECTIVE_ACCESS_REVIEW.md`. All 16 public tables have RLS enabled; anon policies are limited to published event/ticket/payment-account reads. Sensitive application tables have no anon row policy. Broad anon/authenticated SQL grants remain a least-privilege hardening backlog item, but no exploit was demonstrated. Do not assume grants alone prove exposure or that RLS makes every grant harmless.
- The public `event_payment_accounts` SELECT policy exposes account name, account number, and beneficiary for active accounts on published events. Confirm these are all intended customer-facing payment details before any future schema expansion.
- The SECURITY DEFINER static review confirmed key booking, payment, role-management, event-save, gatekeeper, and push-subscription RPCs contain explicit identity/role/ownership checks. `get_haddir_push_config()` returns Vault secrets but EXECUTE is restricted to postgres/service_role; keep it server-side. This was source review, not runtime penetration testing.
- Obtain a real PostgreSQL/Supabase-compatible validation runtime before calling the result tested. The current execution environment has no `psql`, `postgres`, Docker, or Supabase CLI; no database execution test has been performed.

## Current safety status

- Production catalog inspection was read-only.
- No production DDL or data was changed.
- No paid Supabase branch was created.
- No Vercel deployment was triggered.
- No changes were made to `main`.
- The baseline has **not** been generated, tested, or approved for execution.
