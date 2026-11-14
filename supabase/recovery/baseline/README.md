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

The `.sql.md` suffix is deliberate: the SQL is embedded in Markdown so these files cannot be mistaken for deployable migration scripts by Supabase tooling.

## Important exclusions

The drafts do not yet reconstruct application routines, RLS policies, grants/default privileges, trigger functions/triggers, Storage buckets/policies, or scheduled jobs. Supabase-managed schemas and roles are prerequisites and must not be recreated.

## Safe-use rules

1. Do not copy these drafts into `supabase/migrations/`.
2. Do not run them against production.
3. Do not treat this reconstruction as the original migration history.
4. Do not use them until exact dependency, privilege, and Supabase prerequisite reviews are complete.
5. A real PostgreSQL/Supabase-compatible execution test is mandatory before any future proposal to adopt the baseline.

No production changes were made during this recovery work.
