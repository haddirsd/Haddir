# Missing historical migration register

**Purpose:** preserve the exact boundary between recovered original SQL, candidate historical files, and catalog-derived reconstruction. This is an evidence register, not migration SQL.

## Production ledger and repository inventory

- Production ledger snapshot: 64 applied entries (supabase/recovery/production-catalog/applied-migrations.json).
- Current branch supabase/migrations/: 50 SQL files.
- Exact production version + name matches: 21.
- Production entries whose name exists in GitHub but timestamp differs: 21.
- Production entries with no same-name file in the active repository migration directory: 22.
- Seven of those 22 have candidate historical SQL archived separately; the remaining **15** have no source SQL found in the inspected GitHub migration-path history.
- Repository SQL files without an exact version + name match: 29. These are not necessarily all missing originals; the category includes timestamp drift and later files not represented in the current production ledger.

These comparison dimensions overlap and must not be summed.

## Fifteen production migrations whose original SQL was not recovered

The following entries are present in the production migration ledger but have no corresponding original SQL file in the inspected GitHub migration-path history:

1. 20261102190001_initial_haddir_ticketing_schema
2. 20261102190017_harden_functions_and_foreign_key_indexes
3. 20261102191712_owner_roles_and_google_auth_profile
4. 20261102191722_fix_owner_profile_policy
5. 20261102191743_secure_owner_profile_policy
6. 20261102230757_allow_users_to_update_basic_profile_fields
7. 20261102230828_revoke_anonymous_profile_updates
8. 20261103095158_enable_platform_admin_supervisor_rls
9. 20261103105550_add_event_trending_flag
10. 20261103110219_event_cover_storage
11. 20261103112135_add_event_location_url
12. 20261103182323_add_atomic_booking_creation
13. 20261103185150_event_payment_accounts
14. 20261103185928_enable_live_admin_booking_updates
15. 20261103201140_add_event_payment_account_beneficiary

The absence is established only relative to the GitHub history/path sources inspected. It does **not** prove that no external backup, local developer copy, archived deployment artifact, or other source exists.

## Seven archived candidate files — not original-history replacements

Seven SQL files were recovered verbatim from historical GitHub commits and placed under supabase/recovery/historical-sql/:

- 20261105120000_event_role_assignments.sql
- 20261105133000_limit_role_assignment_event_states.sql
- 20261105150000_drop_legacy_admin_update_profile_role.sql
- 20261108124500_issue_one_ticket_per_attendee_on_payment_approval.sql
- 20261108130000_restore_group_ticket_issue_semantics.sql
- 20261110143000_filter_admin_users_by_role.sql
- 20261114010000_sync_push_subscription_owner.sql

Their candidate mappings and source commit provenance are listed in supabase/recovery/historical-sql/README.md. The archived files are preserved as recovered GitHub artifacts, but their mapping to production ledger entries is not claimed as byte-for-byte proof of the SQL originally applied. Some are intermediate revisions, and the role-assignment archive does not represent all later production hardening.

## Timestamp/name mismatches

There are 21 production entries for which a same-name SQL file exists in GitHub but the timestamp differs. Keep these mismatches explicit; do not rename files or rewrite migration ledger history merely to make the names line up.

A concrete example: production records 20261105131539 / event_reminder_notifications, while the branch file is named 20261105190000_event_reminder_notifications.sql. The current live Cron definition and reminder routine were separately reconciled with production; that does not prove the original migration filename/timestamp.

## What is known versus not known

**Known:**
- The production ledger contains the 64 recorded entries in the evidence snapshot.
- The active repository migration directory contains 50 SQL files on this branch.
- Seven archived SQL files were retrieved from identified GitHub commits.
- The production catalog snapshot and ordered baseline drafts reproduce the currently observed database structure sufficiently to pass the documented isolated PostgreSQL 17 DDL smoke test.

**Not established:**
- The original SQL text for the 15 listed entries.
- Byte-for-byte equivalence of the seven candidate archives to the exact SQL originally applied in production.
- A complete historical sequence of every DDL/data transformation between the 64 ledger entries.
- Whether external backups or developer artifacts contain the missing originals.

## Handling rules

- Do not fabricate SQL or timestamps.
- Do not copy catalog-derived baseline drafts into supabase/migrations/ as if they were original historical migrations.
- Keep the seven recovered candidates in supabase/recovery/historical-sql/.
- Keep catalog snapshots and reconstructed drafts labelled as evidence/baseline, not history.
- Only revise this register when a new source artifact is found and its provenance can be verified.
- No production migration replay is authorized by this register.
