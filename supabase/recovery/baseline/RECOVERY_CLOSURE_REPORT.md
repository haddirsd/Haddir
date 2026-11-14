# Haddir Supabase recovery — closure report

**Status:** forensic recovery and catalog-derived baseline validation completed within the documented scope. The 15 early SQL payloads have been recovered from the production migration ledger; the original Git file history remains unavailable. The baseline is not approved for production replay.

## Scope and safety boundary

Target: haddirsd/Haddir, branch chore/restore-supabase-migration-history.

- No production database DDL or data was changed.
- No migration was replayed against production.
- No changes were made to main.
- No Vercel deployment was triggered.
- No paid Supabase branch or resource was created.
- Historical SQL remains quarantined outside supabase/migrations/.
- The baseline drafts remain non-executable documentation artifacts (mostly .sql.md).

## 1. Historical migration recovery

| Item | Result |
|---|---:|
| Production migration ledger entries | 64 |
| SQL files in branch supabase/migrations/ | 50 |
| Exact version + name matches | 21 |
| Same-name entries with timestamp mismatch | 21 |
| Production entries with no same-name file in active migration directory | 22 |
| Candidate SQL files recovered verbatim from GitHub history into archive | 7 |
| SQL payloads recovered verbatim from production ledger | 15 |
| Ledger-to-archive text verification | 15/15 exact |

The 15 entries are listed individually in MISSING_MIGRATIONS_REGISTER.md. They are early entries dated 2026-11-02 and 2026-11-03. The inspected GitHub migration-path history did not contain their original Git files. A read-only extraction from production `supabase_migrations.schema_migrations.statements` returned one stored SQL text for each entry. Those 15 texts are archived under `supabase/recovery/production-ledger-sql/` and were fetched back from GitHub and compared character-for-character against a fresh ledger read: **15/15 exact**. This recovers the ledger-preserved SQL payloads, not the lost Git commit history or any separate workstation file bytes.

The seven archived files are source-provenanced GitHub artifacts, but only candidate correspondences to production ledger entries. They are not asserted to be byte-for-byte copies of the exact production-applied SQL. Do not rename, replay, or promote them as original migration history.

The 21 timestamp mismatches remain explicit. For example, production records 20261105131539 / event_reminder_notifications, whereas the GitHub filename uses 20261105190000.

## 2. What was restored

- Seven historical SQL files recovered from identifiable GitHub commits and archived under supabase/recovery/historical-sql/.
- Fifteen early migration SQL payloads extracted verbatim from the production ledger and archived under supabase/recovery/production-ledger-sql/; all 15 were verified against the live ledger text.
- Read-only production catalog evidence under supabase/recovery/production-catalog/: migration ledger, columns, structure, functions/grants, and Storage/RLS/Cron.
- Catalog-derived baseline drafts for tables, routines, constraints/indexes, RLS, triggers, privileges, Storage and Cron.
- Detailed audit reports covering dependencies, table/data integrity, workflow routines, application integration, RLS/effective access, routine ACLs, and Storage/Cron.
- The baseline was corrected during smoke-test development for missing function terminators and dependency ordering of primary/unique constraints before foreign keys.

## 3. What was validated

The preserved catalog and drafts were reconciled against live production through read-only catalog queries:

- Tables: 16/16.
- Columns: 158/158, including types, defaults, and nullability.
- Constraints: 81/81.
- Indexes: 57/57 total (33 standalone indexes plus indexes backing constraints).
- Public RLS policies: 29/29.
- Routine identities and definitions: 32/32 exact; owners, security modes, and explicit empty search_path inventoried.
- Routine ACLs: 32 per-signature REVOKE draft statements and 41 explicit EXECUTE grant entries reconciled to live ACLs.
- Triggers: 12 distinct public trigger objects.
- Storage: 2/2 buckets and 6/6 object policies matched exactly.
- Cron: 2/2 active jobs matched; both target routines exist and have expected ownership/security configuration.
- Cron runtime history sampled over 24 hours at the 2026-11-14 inspection: reminders 288/288 succeeded; pending-booking expiry 1,440/1,440 succeeded.
- Live data integrity checks found no orphan booking relationships or the recorded cross-link/amount/inventory inconsistencies described in TABLES_COLUMNS_REVIEW.md.
- Application source contracts were statically checked against relevant production RPC/routine signatures.

### PostgreSQL DDL smoke test

An isolated PostgreSQL 17.12 GitHub Actions service-container test passed the staged baseline DDL and catalog assertions. It uses minimal stubs for Supabase-managed interfaces. It is a genuine PostgreSQL DDL smoke test, but not a full Supabase integration test.

**Final rerun result: PASS.** GitHub Actions run 43641848388 completed successfully on commit 6b12489299134fe20bb49ee933bd7044eabb1ac9. The postgres-ddl-smoke-test job and all steps completed successfully. [Open final validation run](https://github.com/haddirsd/Haddir/actions/runs/43641848388). This test was run against the closure-report commit; the only later change to the report is this final result record, with no SQL draft or test-harness changes.

## 4. Known findings and remaining uncertainty

1. **Original Git history gap:** the original Git file objects/commit history for the 15 early migrations remain absent from inspected repository history. Their SQL payloads are now recovered from the production ledger; this does not recreate Git history or prove equivalence to a separate lost workstation copy.
2. **Candidate provenance:** seven archived scripts are not proven byte-for-byte identical to production-applied migration SQL.
3. **Timestamp drift:** 21 same-name production/repository migration pairs have version mismatch; no mass renaming was performed.
4. **Full Supabase integration:** Auth JWT/RLS runtime, Storage provisioning/API, Vault secret delivery, pg_cron worker behavior, pg_net delivery, Realtime, and Edge Functions were not exercised by the PostgreSQL stubs test.
5. **Application runtime:** the integration review was static; it was not a complete browser/device/end-to-end acceptance test.
6. **Security findings retained:** the payment-review NULL-decision edge case and authenticated EXECUTE on private.gatekeeper_ticket_action_core(text, boolean) remain documented findings. They were not changed during forensic recovery.
7. **Legacy ticket display:** the known attendee-count rendering mismatch for older individual-ticket rows and omission from downloaded PNG remain application issues, not migration-recovery fixes.
8. **Repository config gap:** no active supabase/config.toml was found on the recovery branch; bucket settings are preserved in the recovery draft/evidence.
9. **Migration identity mismatch:** reminder migration ledger timestamp differs from the GitHub SQL filename timestamp despite the live routine/job being reconciled.

## 5. Closure decision

**Forensic recovery:** closed for the sources inspected and evidence captured.

**Catalog-derived baseline:** structurally reconciled and passed isolated PostgreSQL 17 DDL smoke testing, subject to the test limitations above.

**Historical SQL payload recovery:** 15/15 early SQL texts recovered verbatim from the production ledger and archived; original Git file/commit history for those entries remains unavailable. Seven later candidate archives remain unverified mappings and are not asserted to be byte-for-byte production originals. The 21 timestamp mismatches remain explicit.

**Production readiness:** not approved. Do not replay this baseline or archived SQL on production. A future controlled migration/rebuild would require a separate review, full Supabase-compatible validation, and explicit approval.

## 6. Final validation record

- Branch: chore/restore-supabase-migration-history
- Tested branch commit: 6b12489299134fe20bb49ee933bd7044eabb1ac9
- Final PostgreSQL 17 Actions run: 43641848388 (success)
- Final result-record update: documentation-only; SQL drafts and test harness unchanged
- Production writes: none
- Main branch changes: none
- Vercel deployment: none
