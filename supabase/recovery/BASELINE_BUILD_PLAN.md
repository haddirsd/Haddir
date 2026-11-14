# Haddir production baseline — build plan

Status: **planning document only; no executable SQL generated or run**.

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

- `README.md` — prerequisites, provenance, limitations, and safe-use instructions.
- `00-prerequisites.sql` — only app-owned schema/extension prerequisites that are safe and supported on a fresh Supabase project.
- `10-routines.sql` — routines in dependency order, after their referenced schemas and types exist.
- `20-tables.sql` — tables and column definitions in dependency order.
- `30-constraints-indexes.sql` — primary/unique/check/foreign-key constraints and indexes, with foreign keys added after all referenced tables exist.
- `40-privileges-rls.sql` — schema/table/column/function grants, RLS enablement, and policies.
- `50-triggers.sql` — trigger functions and trigger bindings after their target tables and routines exist.
- Storage and scheduled jobs remain separate deployment steps, not part of the generic database bootstrap.

These are proposed file names, not files already generated.

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
- Review all 32 routine definitions, their owners, security-definer settings, search paths, and EXECUTE ACLs against `functions-and-grants.json`.
- Reconcile the complete grant/default-privilege model with Supabase-managed roles; do not copy managed role memberships into a generic bootstrap.
- Verify table dependency order and confirm all foreign-key targets exist before constraints are added.
- Review Storage bucket configuration, object policies, and cron definitions separately.
- Obtain a real PostgreSQL/Supabase-compatible validation runtime before calling the result tested. The current execution environment has no `psql`, `postgres`, Docker, or Supabase CLI; no database execution test has been performed.

## Current safety status

- Production catalog inspection was read-only.
- No production DDL or data was changed.
- No paid Supabase branch was created.
- No Vercel deployment was triggered.
- No changes were made to `main`.
- The baseline has **not** been generated, tested, or approved for execution.
