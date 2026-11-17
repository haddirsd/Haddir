# Haddir — final migration reconciliation

**Current inventory snapshot:** 2026-11-17  
**Status:** Every production migration version currently recorded in the production ledger has a corresponding active file by version. One active file has a migration-name label mismatch and differs from its production SQL payload only by one trailing newline. One additional local-only seed migration remains intentionally unapplied.

- Repository: `haddirsd/Haddir`
- Reconciliation branch: `chore/align-migrations`
- Production Supabase project: `puhmvcekxkcxfdvgygpk`
- Latest production ledger version at this snapshot: `20261117104547`

## 1. Current production and repository inventory

The production inventory was read using the Supabase migration-list read operation. The active-file inventory was read from `supabase/migrations/` on `chore/align-migrations`.

| Measure | Verified count |
|---|---:|
| Production migration-ledger rows | 77 |
| Active SQL files in `supabase/migrations/` | 78 |
| Production versions represented by an active file | 77 / 77 |
| Exact version + migration-name matches | 76 |
| Production versions without an active file | 0 |
| Local-only versions not recorded in production | 1 |

### One existing filename / SQL-payload discrepancy

Production records version `20261115134406` as:

`harden_payment_review_and_internal_function_execution_grants`

The active file is currently named:

`20261115134406_harden_payment_review_and_internal_function_grants.sql`

The version is present, so this is not a missing production version. The SQL text was compared directly with `statements[1]` from the production ledger. The only content difference is that the repository file has one additional final line-feed character (production: 4,669 characters; repository file: 4,670 characters). The production SHA-256 is:

`6dac1f7fe3b9c990ea5da7bf6c3ed62acc3dd809f6271fbc3d891612d7abe1f2`

This discrepancy is disclosed rather than silently described as an exact byte-for-byte match. No SQL edit was made to this existing file during reconciliation.

### One local-only migration

`20261116120000_seed_sahel_payment_method.sql`

This version is present in the repository but absent from the production ledger. Its insert uses `ON CONFLICT (id) DO NOTHING` and sets the seeded payment method to inactive. It remains in the repository and has not been applied to production.

## 2. Production SQL recovered into the active migration directory

Nineteen active migration files were restored from production-ledger SQL evidence:

### 15 early migrations recovered from the archive

These files were copied from `supabase/recovery/production-ledger-sql/` into `supabase/migrations/`. Their archived SQL was previously compared against the corresponding production `statements[1]` values: **15/15 exact matches**.

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

### Four additional migrations recovered directly from production

The following files were created using the exact SQL text stored in the production ledger. Their production SHA-256 values were checked against the extracted payloads, and the resulting GitHub files were re-read and compared character-for-character.

| Version | Migration | Production SHA-256 |
|---|---|---|
| 20261105070931 | `event_role_assignments_and_scoped_roles` | `6b1e5e9f731282a8313b700d6d93897b7e24d9ccb2dccfeb827804cf18a3c078` |
| 20261105073706 | `drop_legacy_admin_update_profile_role_overload` | `4dca32491de4efcdbaac016c2f0453d5442d95c7e9ca88d0bb4f5351d76c106b` |
| 20261108124015 | `issue_one_ticket_per_attendee_on_payment_approval` | `b1a9b524a94fd95fc175adfca8cec3a692b0caa1ccafb4b384e46caffc2821db` |
| 20261110123134 | `haddir_admin_user_role_filter` | `bed397b486b96367f7877d85b470e86f768b7cc6a749fe28662151d0d346cee6` |

The two historical candidates below are not substitutes for the production versions `20261105070931` and `20261105073706`.

## 3. Superseded historical candidates retained outside the active directory

These four files remain under `supabase/superseded/` and were not deleted or rewritten:

- `20261103170000_payment_methods_and_receipts.sql`
- `20261105120000_event_role_assignments.sql`
- `20261105150000_drop_legacy_admin_update_profile_role.sql`
- `20261105170000_advertiser_statistics_rpc.sql`

In particular, the two role-related candidates have different timestamps from the corresponding production ledger entries and are not treated as replacements for them.

## 4. Historical provenance and supporting evidence

The archive and review documents remain available:

- Exact production-ledger SQL archive: `supabase/recovery/production-ledger-sql/`
- GitHub historical candidate archive: `supabase/recovery/historical-sql/`
- Timestamp-pair review: `supabase/recovery/baseline/MIGRATION_VERSION_MISMATCH_REVIEW.md`
- Unmatched repository migrations review: `supabase/recovery/baseline/UNMATCHED_REPOSITORY_MIGRATIONS_REVIEW.md`
- Missing-migrations register: `supabase/recovery/baseline/MISSING_MIGRATIONS_REGISTER.md`

Ledger-recovered SQL establishes the SQL text retained by production. It does not recreate missing original Git blobs, original workstation files, or original commit history. Historical candidate mappings remain evidence classifications, not proof that each candidate file was applied verbatim.

## 5. Verification limits and safety boundaries

- Production-ledger reads used `SELECT` only.
- No production migration, DDL, data, or migration-ledger row was changed.
- No SQL body was edited as part of this reconciliation.
- No migration was executed.
- `supabase db push` was not run.
- The production migration-list inventory is not a substitute for running the local Supabase CLI `supabase migration list` against the checked-out repository. That local/remote comparison must be confirmed clean before any future `db push`.
- Do not replay archived SQL or use `db push` as a method of repairing migration history.

**Final disposition:** all 77 production migration versions have active files by version; one version/name and trailing-newline discrepancy is explicitly recorded above, and the only repository-only version is the inactive Sahel seed. Production remains untouched.
