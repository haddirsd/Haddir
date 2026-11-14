# Haddir baseline recovery workspace

**Status: draft / not executable / not tested.**

This directory contains first-pass SQL reconstruction artifacts based on read-only catalog evidence from the live Supabase project.

## Files

- `10-routines-draft.sql.md` — 32 public/private application routine definitions.
- `20-tables-draft.sql.md` — 16 public application tables and 158 columns.
- `30-constraints-indexes-draft.sql.md` — 81 constraints and 33 standalone indexes (constraint-backed indexes are not duplicated).
- `40-rls-policies-draft.sql.md` — RLS enablement for 16 tables and all 29 policies.
- `50-triggers-draft.sql.md` — 12 distinct trigger definitions across eight target tables.
- `60-privileges-draft.sql.md` — catalog-derived table, column-only, schema, and per-signature routine ACL reconstruction; hosted default privileges and managed roles are excluded.
- `DDL_RECONCILIATION_AUDIT.md` — structural cross-check of table/column, constraint/index, RLS policy, trigger, and privilege drafts against production catalog evidence.
- `70-storage-cron-draft.md` — two Storage bucket configuration blocks, six Storage object policies, and two cron job definitions, with Supabase-managed prerequisites.
- `APPLICATION_INTEGRATION_AUDIT.md` — static comparison of booking, receipt, payment review, event save, gatekeeper, customer tickets, and push-notification frontend contracts against production routines.
- `SECURITY_REVIEW.md` — ownership, SECURITY DEFINER, search_path and EXECUTE ACL findings.
- `ACCESS_CONTROL_STORAGE_CRON.md` — bucket configuration, six Storage policies, two active cron jobs, schema/object grants, and default-privilege review.
- `RLS_EFFECTIVE_ACCESS_REVIEW.md` — effective row-access map for all 16 tables, public payment-account disclosure, broad-grant/RLS interaction, and static review of key SECURITY DEFINER routines.
- `DEPENDENCY_ORDER_REVIEW.md` — staged build order, FK graph, extension prerequisites, trigger dependencies, and exact per-signature EXECUTE ACL inventory.
- `ROUTINE_DEPENDENCY_AUDIT.md` — source-level scan of all 32 definitions, direct application-routine call graph, SQL/PLpgSQL creation groups, and managed-platform dependencies.
- `CONSTRAINTS_INDEXES_REVIEW.md` — production integrity audit and outstanding index/business-rule review findings.
- `TABLES_COLUMNS_REVIEW.md` — production column/default/nullability review, booking/payment/ticket consistency checks, and mixed legacy/current ticket issuance semantics.
- `WORKFLOW_ROUTINES_AUDIT.md` — source/ACL review of booking, stock, receipt, payment review, ticket issuance, and gatekeeper routines, with current-data reconciliation and remediation findings.

The `.sql.md` suffix is deliberate: the SQL is embedded in Markdown so these files cannot be mistaken for deployable migration scripts by Supabase tooling.

## Important exclusions

The drafts do not yet reconstruct a complete executable bootstrap. The dependency review proposes creating tables first without FKs, then routines, constraints/indexes, RLS policies, triggers, and finally separately reviewed Storage/cron configuration. Routine ACLs are inventoried by exact signature. The routine dependency audit found 32 unique definitions (18 PL/pgSQL and 14 SQL), with no direct application-routine call cycles; it identifies private helpers and implementations that must precede their callers and public SQL wrappers. This is a static source scan, not a PostgreSQL compilation test. The constraints/index review reconciles all 81 constraints and 57 indexes, and records the two unindexed FK columns, duplicate unique index, and global event-role assignment uniqueness rule. Supabase-managed schemas and roles are prerequisites and must not be recreated. The table/column review found no current orphan or cross-link inconsistencies in the checked booking/payment/ticket rows; it also documents the mixed historical ticket issuance model (64 tickets linked to 55 confirmed booking items representing 137 attendees; 52 items have one ticket each and three older items retain 3/4/5 attendee-level tickets), the global event-role uniqueness rule, nullable unlimited inventory, and invariants not enforced by declarative constraints. The workflow audit records the NULL payment-decision validation gap and unnecessary authenticated EXECUTE on the private gatekeeper core routine; neither was changed in production.

## Safe-use rules

1. Do not copy these drafts into `supabase/migrations/`.
2. Do not run them against production.
3. Do not treat this reconstruction as the original migration history.
4. Do not use them until exact dependency, privilege, and Supabase prerequisite reviews are complete.
5. A real PostgreSQL/Supabase-compatible execution test is mandatory before any future proposal to adopt the baseline.

No production changes were made during this recovery work.

- `POSTGRESQL_17_SMOKE_TEST.md` — passing disposable PostgreSQL 17 DDL smoke test report, including exact scope and limitations.
