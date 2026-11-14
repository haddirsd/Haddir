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

## Historical recovery finding

The earliest commit returned by GitHub's history for `supabase/migrations` is the payment-methods/receipts migration commit on 2026-11-03. At that commit, the directory contains only:

`20261103170000_payment_methods_and_receipts.sql`

The initial schema and the earlier 2026-11-02 migrations are therefore not recoverable as committed migration files from the repository's path history. They appear to have been applied outside the tracked migration directory. Do not fabricate historical SQL or assign old timestamps to reconstructed snapshots.

## Current live-schema evidence

Read-only catalog inspection confirmed the live project currently has the core ticketing tables, role-assignment and audit tables, payment-account/submission tables, notification/outbox tables, gatekeeper scan history, and push subscriptions. The project also has functions in `public` and `private` schemas supporting booking, payment review, event save, role management, gatekeeper validation, reminders, expiry, email enqueueing, and web push.

This inventory is not a complete schema dump. Before writing a bootstrap baseline, capture exact table DDL, indexes, constraints, policies, triggers, functions, grants, storage bucket/policies, extensions, and scheduled jobs.

## Safety and next steps

1. Keep production untouched. Never replay reconstructed migrations against production.
2. Recover each migration with a reliable source: historical commit diff, archived SQL, or exact catalog definition.
3. Preserve the 21 timestamp mismatches as an explicit reconciliation list; do not rename files blindly.
4. Create a clearly labelled **bootstrap baseline** from a verified schema snapshot only if historical SQL cannot be recovered. Keep it distinct from the historical migration ledger.
5. Validate on a free local PostgreSQL environment before proposing any changes to `main`.

Local tooling check in the current work environment found Git and Node.js, but no `psql`, `postgres`, Docker, or Supabase CLI. No local database test has been claimed or run.
