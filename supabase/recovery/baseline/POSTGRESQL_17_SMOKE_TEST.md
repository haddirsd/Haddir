# PostgreSQL 17 baseline DDL smoke-test report

**Result: PASS**  
**Workflow run:** https://github.com/haddirsd/Haddir/actions/runs/43638185720  
**Tested branch commit:** 4c039dc926f57499e2b603e0131ec4d9c9a7d4d6  
**Runtime:** disposable PostgreSQL 17.12 service container in GitHub Actions  
**Date:** 2026-11-14

## What passed

The harness created a fresh temporary database, then applied the recovery drafts in dependency order:

1. Minimal platform stubs for Supabase-managed interfaces.
2. 16 application tables.
3. 32 application routines.
4. 81 constraints and 57 total indexes.
5. RLS enablement and 29 public policies.
6. 12 public trigger objects.
7. Table, column, and routine grants from the draft.
8. Six Storage object policies against a minimal stub relation.
9. Two cron job definitions against a minimal stub scheduler.

The assertions passed for:
- 16 public tables and 158 public columns.
- 81 constraints and 57 total indexes.
- 29 public policies and 12 public triggers.
- 32 public/private application routines.
- all application routines owned by postgres with explicit empty search_path.
- RLS enabled on all 16 public tables.
- six Storage policies and two active cron jobs.
- secret-returning push configuration routine not executable by authenticated, but executable by service_role.
- faithful capture of the currently observed authenticated EXECUTE grant on the private gatekeeper core (documented security finding, not an endorsement).

The separate bucket TOML excerpt parsed successfully and matched the two expected bucket IDs, public/private flags, and size limits.

## Issues found and corrected during test development

- First run found missing semicolons after all 32 reconstructed function bodies. All 32 routine terminators were corrected.
- Second run found foreign keys ordered before referenced primary/unique constraints. The constraint stage was reordered: candidate keys first, then CHECK constraints, then foreign keys.
- The next isolated PostgreSQL 17 run passed all DDL stages and assertions.

## Scope and limitations

This is a real PostgreSQL DDL smoke test, but it is **not a full Supabase integration test**:
- auth, storage, vault, net, and cron are represented by minimal test stubs, not actual Supabase-managed services/extensions.
- It does not validate Auth JWT behavior, Storage API/bucket provisioning, Vault secret delivery, pg_cron worker execution, pg_net HTTP delivery, Realtime, or Edge Functions.
- It does not seed production data or test application workflows/authorization decisions.
- It validates the draft DDL's ability to create the captured structures in PostgreSQL 17, not byte-for-byte provenance of missing historical migration files.

No production database was modified. No migrations were applied to production. No Vercel deployment or change to main occurred. The SQL drafts remain quarantined under supabase/recovery/baseline/ and are not active migrations.