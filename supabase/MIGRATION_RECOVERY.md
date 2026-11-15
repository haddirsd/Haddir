# Supabase migration recovery and reconciliation

The forensic migration recovery and ledger reconciliation report is maintained at [recovery/MIGRATION_RECONCILIATION_FINAL.md](recovery/MIGRATION_RECONCILIATION_FINAL.md).

The report records the production ledger inventory, all exact version/name matches, all timestamp mismatches, the eight historical repository files without same-name ledger entries, the 15 SQL payloads recovered verbatim from the production ledger, and seven historical GitHub candidate files. It also records the original Git provenance that remains unavailable.

Recovered SQL is quarantined under `recovery/production-ledger-sql/` and `recovery/historical-sql/`, outside the active `migrations/` directory. These archives are not runnable migration history.

No production schema, data, migration-ledger row, or Edge Function was changed during this reconciliation. Do not replay the archives or use `supabase db push` to force timestamp alignment.
