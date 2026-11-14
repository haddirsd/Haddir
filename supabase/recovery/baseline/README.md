# Haddir baseline recovery workspace

**Status: draft / not executable / not tested.**

This directory contains first-pass SQL reconstruction artifacts based on read-only catalog evidence from the live Supabase project.

## Files

- `10-routines-draft.sql.md` — 32 public/private application routine definitions.
- `20-tables-draft.sql.md` — 16 public application tables and 158 columns.
- `30-constraints-indexes-draft.sql.md` — 81 constraints and 33 standalone indexes (constraint-backed indexes are not duplicated).
- `40-rls-policies-draft.sql.md` — RLS enablement for 16 tables and all 29 policies.
- `50-triggers-draft.sql.md` — 12 distinct trigger definitions.
- `SECURITY_REVIEW.md` — ownership, SECURITY DEFINER, search_path and EXECUTE ACL findings.
- `ACCESS_CONTROL_STORAGE_CRON.md` — bucket configuration, six Storage policies, two active cron jobs, schema/object grants, and default-privilege review.
- `RLS_EFFECTIVE_ACCESS_REVIEW.md` — effective row-access map for all 16 tables, public payment-account disclosure, broad-grant/RLS interaction, and static review of key SECURITY DEFINER routines.
- `DEPENDENCY_ORDER_REVIEW.md` — staged build order, FK graph, extension prerequisites, routine call ordering notes, and exact per-signature EXECUTE ACL inventory.

The `.sql.md` suffix is deliberate: the SQL is embedded in Markdown so these files cannot be mistaken for deployable migration scripts by Supabase tooling.

## Important exclusions

The drafts do not yet reconstruct a complete executable bootstrap. The dependency review proposes creating tables first without FKs, then routines, constraints/indexes, RLS policies, triggers, and finally separately reviewed Storage/cron configuration. Routine ACLs are inventoried by exact signature. Supabase-managed schemas and roles are prerequisites and must not be recreated. PL/pgSQL body dependencies still require source review and a real PostgreSQL-compatible creation test.

## Safe-use rules

1. Do not copy these drafts into `supabase/migrations/`.
2. Do not run them against production.
3. Do not treat this reconstruction as the original migration history.
4. Do not use them until exact dependency, privilege, and Supabase prerequisite reviews are complete.
5. A real PostgreSQL/Supabase-compatible execution test is mandatory before any future proposal to adopt the baseline.

No production changes were made during this recovery work.
