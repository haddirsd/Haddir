# Supabase project sources

Project: `haddir` (`puhmvcekxkcxfdvgygpk`).

## Edge Functions

The source files in `functions/` are snapshots of the active Edge Functions retrieved from Supabase. GitHub edits to these files do not deploy or change the live functions.

- `send-booking-email` — JWT verification enabled.
- `send-web-push` — gateway JWT verification disabled; the function validates its private hook secret.
- `delete-customer-account` — JWT verification enabled.

## Migrations

The repository contains **51 SQL files** in `migrations/`. The production project has **64 applied migration-ledger entries** (latest observed: `20261114101634_sync_haddir_push_subscription`).

The migration directory is not a byte-for-byte mirror of the production ledger:
- 21 files match production by exact version and name.
- 21 same-name migrations have timestamp drift; all 21 SQL pairs were reviewed, with 13 exact text matches and 8 comment/whitespace-normalized matches.
- Eight historical repository files without same-name ledger entries were individually classified.
- `20261115120000_atomic_customer_account_deletion.sql` is a new forward migration in the repository and is **not applied to production**.

The 22 production entries without same-name active files are accounted for in the forensic register: 15 SQL payloads recovered exactly from the production ledger and seven historical GitHub candidates with documented provenance and mapping limitations.

See [the final reconciliation report](recovery/MIGRATION_RECONCILIATION_FINAL.md), the [exact ledger SQL archive](recovery/production-ledger-sql/README.md), and the [historical candidate archive](recovery/historical-sql/README.md).

**Important:** files under `recovery/` are forensic evidence only, not active migrations. Do not move them into `migrations/`, replay them, rename active migration timestamps, or run `supabase db push` to force reconciliation. Production database and migration history were not changed by this review.
