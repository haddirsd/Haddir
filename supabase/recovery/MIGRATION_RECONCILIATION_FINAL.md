# Haddir — final migration reconciliation

**Status:** ledger/file reconciliation classified and evidence archived. Original Git history for the early migrations is not fully recoverable. **No production migration, DDL, data, or migration-ledger row was changed.**

- Repository: `haddirsd/Haddir`
- Reconciliation branch: `chore/close-migration-reconciliation`
- Production Supabase project: `puhmvcekxkcxfdvgygpk`
- Inventory: 2026-11-15
- Production latest applied migration: `20261114101634_sync_haddir_push_subscription`

## 1. Current inventory

| Measure | Verified count |
|---|---:|
| Production migration-ledger rows | 64 |
| SQL files in `main/supabase/migrations/` | 51 |
| Exact version + name matches | 21 |
| Same migration name, different timestamp | 21 |
| Historical repository files with no same-name production ledger row | 8 |
| New forward migration not yet applied to production | 1 |
| Production entries with no same-name active migration file | 22 |

The 51st active file is `20261115120000_atomic_customer_account_deletion.sql`. It was introduced by the customer-account-deletion repair and is a new forward migration. It is not one of the missing historical files and is not recorded as applied in production. The 50-file historical comparison therefore remains 21 exact matches + 21 timestamp mismatches + 8 historical unmatched files.

## 2. Timestamp mismatches — all 21 classified

The 21 same-name pairs are individually mapped in [MIGRATION_VERSION_MISMATCH_REVIEW.md](baseline/MIGRATION_VERSION_MISMATCH_REVIEW.md).

- 13/21 SQL payloads are byte-for-byte identical to the corresponding production-ledger SQL.
- 8/21 differ only in comments and/or insignificant whitespace; after normalization they compare equal.
- No executable SQL difference was observed in this defined set.

**Disposition:** preserve production ledger versions as the applied versions. Do not rename active files, edit historical timestamps, or replay these migrations merely to make timestamps match.

## 3. Production entries missing by name — 22 classified

### 15 exact SQL payloads recovered from the production ledger

The following entries were extracted from `supabase_migrations.schema_migrations.statements[1]`, archived under `recovery/production-ledger-sql/`, and re-read from production for exact comparison with the archive: **15/15 exact matches**.

```text
20261102190001_initial_haddir_ticketing_schema
20261102190017_harden_functions_and_foreign_key_indexes
20261102191712_owner_roles_and_google_auth_profile
20261102191722_fix_owner_profile_policy
20261102191743_secure_owner_profile_policy
20261102230757_allow_users_to_update_basic_profile_fields
20261102230828_revoke_anonymous_profile_updates
20261103095158_enable_platform_admin_supervisor_rls
20261103105550_add_event_trending_flag
20261103110219_event_cover_storage
20261103112135_add_event_location_url
20261103182323_add_atomic_booking_creation
20261103185150_event_payment_accounts
20261103185928_enable_live_admin_booking_updates
20261103201140_add_event_payment_account_beneficiary
```

This recovers the SQL text retained by the production ledger. It does **not** recreate the original Git blobs, original commits, or prove what the original workstation files contained beyond the ledger payload.

### 7 historical GitHub candidates

Seven files were recovered verbatim from identified GitHub commits and archived under `recovery/historical-sql/`. Their commit provenance is recorded in [historical-sql/README.md](historical-sql/README.md).

These are candidate correspondences by commit history, migration intent, and subsequent production-object review. They are **not all proven byte-for-byte copies** of the exact SQL applied in production. The role-assignment history is split across multiple production migrations and includes later hardening. The earlier per-attendee ticket migration is an intermediate revision; the later group-ticket semantics are the final recorded implementation.

## 4. Eight historical repository files without same-name ledger entries

The eight files were individually reviewed in [UNMATCHED_REPOSITORY_MIGRATIONS_REVIEW.md](baseline/UNMATCHED_REPOSITORY_MIGRATIONS_REVIEW.md):

| Classification | Count | Handling |
|---|---:|---|
| Exact SQL match under another production version/name | 2 | Keep current filenames; mapping documented |
| Normalized SQL match under another production version/name | 2 | Keep current filenames; mapping documented |
| Composed/superseded by multiple recorded migrations | 1 | Do not claim the candidate ran as one migration |
| Live effects present but exact migration provenance unresolved | 2 | Preserve as unresolved historical provenance |
| Later private routine supersedes candidate; public wrapper provenance unresolved | 1 | Do not label candidate as applied verbatim |

The two unresolved-effect cases are the legacy `payment_methods` DDL and `events.platform_fee_percent` column/check DDL: the live effects exist, but the inspected ledger does not establish which migration or manual action introduced them. The advertiser-statistics candidate is superseded by a later recorded private routine; the public wrapper's provenance remains unresolved.

## 5. Non-recoverable historical gaps

The inspected GitHub migration-path history did not contain original Git migration files for the 15 early entries dated 2026-11-02 and early 2026-11-03. Their SQL was recovered from the production ledger, but the original Git commit IDs/blobs and original file bytes are unavailable from the inspected sources.

The seven candidate files have identifiable GitHub source commits, but candidate mapping is not proof of exact production-applied SQL. No source located so far establishes the complete original chronological migration sequence for every DDL/data change.

These are the remaining provenance gaps. They must stay explicit; do not invent SQL, timestamps, commit history, or migration mappings.

## 6. Files and safety boundaries

- Exact ledger SQL archive: `recovery/production-ledger-sql/`
- GitHub historical candidate archive: `recovery/historical-sql/`
- Timestamp-pair review: `recovery/baseline/MIGRATION_VERSION_MISMATCH_REVIEW.md`
- Eight-file review: `recovery/baseline/UNMATCHED_REPOSITORY_MIGRATIONS_REVIEW.md`
- Missing-entry register: `recovery/baseline/MISSING_MIGRATIONS_REGISTER.md`

All recovered SQL is stored outside `supabase/migrations/`; Supabase tooling will not treat it as active migration history. None of the archived SQL was executed.

**Final disposition:** the production ledger and repository files are now reconciled by evidence and classification. The historical Git provenance gaps described above are not recoverable from the inspected sources. Keep production untouched until a separately reviewed forward-only rollout is approved. Do not run `supabase db push` or replay the archives as a way to reconcile history.
