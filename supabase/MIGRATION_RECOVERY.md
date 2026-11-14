# Supabase migration history recovery

Status: forensic inventory only. No production DDL or data was changed.

## Sources checked

- Supabase project: `haddir` (`puhmvcekxkcxfdvgygpk`), read-only migration inventory and catalog inspection.
- GitHub repository: `haddirsd/Haddir`, branch `main` at inventory time.
- A dedicated GitHub work branch was created: `chore/restore-supabase-migration-history`.

## Inventory

- Production migration history: **64** applied entries.
- Repository migration directory: **50** SQL files.
- Exact version + name matches: **21**.
- Production entries whose migration name exists in GitHub but whose timestamp differs: **21**.
- Production entries with no same-name SQL file in the repository: **22**.
- Repository SQL files with no exact version + name match in production: **29** (21 timestamp/name matches plus 8 files whose names are not in the production ledger).

The counts above describe different comparison dimensions and should not be added together.

## Production entries missing by name from the repository

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
20261105070931_event_role_assignments_and_scoped_roles
20261105071103_limit_role_assignment_to_active_event_states
20261105073706_drop_legacy_admin_update_profile_role_overload
20261108124015_issue_one_ticket_per_attendee_on_payment_approval
20261108124142_restore_booking_item_ticket_issue_semantics
20261110123134_haddir_admin_user_role_filter
20261114101634_sync_haddir_push_subscription
```

## Historical recovery progress

GitHub commit history was traced for the migrations path. Seven historical SQL files corresponding by intent to seven production entries missing by name were recovered verbatim into:

`supabase/recovery/historical-sql/`

The archive includes provenance links and a candidate mapping table. These are **candidate correspondences only**: timestamp/name drift exists, and the SQL has not yet been proven byte-for-byte identical to what production applied. The archive is intentionally outside `supabase/migrations` so Supabase tooling will not treat it as runnable migration history.

Read-only comparison against production confirms the archived admin role-filter and push-subscription function bodies match the live definitions, and the live payment-review function matches the later restored group-ticket semantics. The earlier per-attendee script is intermediate. The role-assignment scripts are not a complete final-state representation: production has an additional unique constraint, a different current policy set, and a more hardened private role-update function. The legacy two-argument public role-update overload is absent; the current public three-argument function delegates to the private implementation.

The remaining **15** missing-by-name entries are from 2026-11-02 and early 2026-11-03; no source SQL for them was found in the inspected GitHub migration-path history.

## Historical recovery finding

The earliest commit returned by GitHub's history for `supabase/migrations` is the payment-methods/receipts migration commit on 2026-11-03. At that commit, the directory contains only:

`20261103170000_payment_methods_and_receipts.sql`

The initial schema and the earlier 2026-11-02 migrations are therefore not recoverable as committed migration files from the repository's path history. They appear to have been applied outside the tracked migration directory. Do not fabricate historical SQL or assign old timestamps to reconstructed snapshots.

## Current live-schema evidence

Read-only catalog inspection confirmed the live project currently has the core ticketing tables, role-assignment and audit tables, payment-account/submission tables, notification/outbox tables, gatekeeper scan history, and push subscriptions. The project also has functions in `public` and `private` schemas supporting booking, payment review, event save, role management, gatekeeper validation, reminders, expiry, email enqueueing, and web push.

This inventory is not a complete schema dump. Before writing a bootstrap baseline, capture exact table DDL, indexes, constraints, policies, triggers, functions, grants, storage bucket/policies, extensions, and scheduled jobs.

## Safety and next steps

1. Keep production untouched. Never replay reconstructed migrations against production.
2. Compare the seven archived candidate scripts with the live production object definitions and confirm their ledger mappings; do not replay them.
3. Preserve the 21 timestamp mismatches as an explicit reconciliation list; do not rename files blindly.
4. Recover the remaining 15 early SQL migrations only from an external backup/artifact or a verified reconstruction clearly labelled as a baseline, never as original historical SQL.
5. Create a separate bootstrap baseline from a complete verified schema snapshot, then validate it on a free local PostgreSQL environment before proposing any changes to `main`.

Local tooling check in the current work environment found Git and Node.js, but no `psql`, `postgres`, Docker, or Supabase CLI. No local database test has been claimed or run.
