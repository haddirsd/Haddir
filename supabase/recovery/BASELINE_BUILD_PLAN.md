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
- Storage and scheduled jobs remain separate deployment steps and must not be silently omitted from a future full bootstrap.

All SQL is embedded in Markdown with a `.sql.md` suffix deliberately; these are evidence-backed drafts, not deployable SQL files.

## Dependency and safety rules

1. Treat Supabase-managed schemas and roles (`auth`, `storage`, `vault`, `realtime`, `cron`, `net`, and service roles) as platform prerequisites. Do not recreate them.
2. Create the app-owned `private` schema and required application routines only after confirming exact ownership and grants.
3. Create tables before adding cross-table foreign keys. Preserve exact check expressions and delete actions from the catalog evidence.
4. Recreate indexes from their captured `pg_indexes.indexdef`, checking for duplicate/overlapping indexes rather than silently simplifying them.
5. Enable RLS and recreate policies from captured expressions. Do not substitute broad policies or blanket grants.
6. Create triggers only after their trigger functions exist. Keep the 12 distinct trigger definitions; do not mistakenly generate 26 duplicate triggers from the event-expanded information-schema rows.
7. Do not export Vault secret values, auth user data, production rows, or project-specific credentials.
8. Storage buckets/policies and cron jobs need a separate deployment review because they may depend on project-specific settings, URLs, and secrets.
9. Never place a reconstructed baseline in `supabase/migrations` or replay it against production.

## Remaining evidence/review gates

- Review every column's exact type, default, collation, identity/generated status, and nullability against `columns.json`.
- Routine definitions are now drafted. The read-only review found all 32 owned by `postgres`, all with empty `search_path`, and mixed SECURITY DEFINER / INVOKER execution; per-routine EXECUTE ACLs must be reconstructed exactly and reviewed before executable SQL is produced.
- Reconcile the complete grant/default-privilege model with Supabase-managed roles; do not copy managed role memberships into a generic bootstrap.
- Verify table dependency order and confirm all foreign-key targets exist before constraints are added.
- Storage review is now documented in `baseline/ACCESS_CONTROL_STORAGE_CRON.md`: 2 buckets, 6 object policies, and 2 active cron jobs. Preserve the private receipt bucket, public cover reads, user/booking path checks, and the exact cron schedules/functions.
- Grant review is documented alongside Storage: public/private schema ACLs, per-object table/routine grants, three column-level UPDATE grant groups, and default privileges for postgres/supabase_admin. Do not copy the broad hosted-project default ACLs as generic defaults. Reconstruct only verified object-specific grants.
- Security follow-up: some existing application tables have broad anon/authenticated table-level SQL grants while RLS is enabled. Review each table's effective policy/grant combination before executable DDL; do not assume the grants alone prove exposure or that RLS makes every grant harmless.
- Obtain a real PostgreSQL/Supabase-compatible validation runtime before calling the result tested. The current execution environment has no `psql`, `postgres`, Docker, or Supabase CLI; no database execution test has been performed.

## Current safety status

- Production catalog inspection was read-only.
- No production DDL or data was changed.
- No paid Supabase branch was created.
- No Vercel deployment was triggered.
- No changes were made to `main`.
- The baseline has **not** been generated, tested, or approved for execution.
