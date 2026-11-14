# Production migration-ledger SQL archive

Extracted read-only from the production Supabase project's `supabase_migrations.schema_migrations` table on 2026-11-14.

For each entry below, the production row had the matching version and name, a recorded creator, and exactly one non-null element in its `statements` array. Each SQL file is the UTF-8 text of that row's `statements[1]` value copied verbatim. This is ledger-recovered SQL text, not SQL regenerated from the current schema or inferred from application code.

| Version | Migration | Characters |
|---|---|---:|
| 20261102190001 | initial_haddir_ticketing_schema | 8616 |
| 20261102190017 | harden_functions_and_foreign_key_indexes | 1707 |
| 20261102191712 | owner_roles_and_google_auth_profile | 1273 |
| 20261102191722 | fix_owner_profile_policy | 676 |
| 20261102191743 | secure_owner_profile_policy | 674 |
| 20261102230757 | allow_users_to_update_basic_profile_fields | 559 |
| 20261102230828 | revoke_anonymous_profile_updates | 49 |
| 20261103095158 | enable_platform_admin_supervisor_rls | 5352 |
| 20261103105550 | add_event_trending_flag | 94 |
| 20261103110219 | event_cover_storage | 1778 |
| 20261103112135 | add_event_location_url | 69 |
| 20261103182323 | add_atomic_booking_creation | 4145 |
| 20261103185150 | event_payment_accounts | 3390 |
| 20261103185928 | enable_live_admin_booking_updates | 112 |
| 20261103201140 | add_event_payment_account_beneficiary | 84 |

## Safety and scope

- Archived under `supabase/recovery/production-ledger-sql/`, not `supabase/migrations/`.
- Do not replay these files against production or treat this directory as an active migration directory.
- No production SQL was executed during extraction; only SELECT queries read the migration ledger.
- The original Git migration-path files remain absent from inspected Git history. This archive recovers their SQL payloads from the production ledger; it does not recreate Git commit history or independently prove byte-for-byte equivalence to any lost workstation file beyond the SQL text retained by the ledger.
