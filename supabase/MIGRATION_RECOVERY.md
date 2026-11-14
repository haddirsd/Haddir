# Supabase migration history recovery

Status: forensic recovery completed for the accessible sources. Fifteen early migration SQL payloads have been recovered from the production ledger; the original Git file history remains unavailable. No production DDL or data was changed.

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

The remaining **15** missing-by-name entries are from 2026-11-02 and early 2026-11-03. Their original Git files were not found in the inspected GitHub migration-path history, but the production ledger contains exactly one SQL text value for each. Those texts were extracted from `supabase_migrations.schema_migrations.statements[1]`, archived under `supabase/recovery/production-ledger-sql/`, and verified 15/15 character-for-character against a fresh read of the live ledger. This does not recreate original Git blobs or commit history.

## Historical recovery finding

The earliest commit returned by GitHub's history for `supabase/migrations` is the payment-methods/receipts migration commit on 2026-11-03. At that commit, the directory contains only:

`20261103170000_payment_methods_and_receipts.sql`

The initial schema and the earlier 2026-11-02 migrations are not recoverable as committed Git files from the repository's path history; they appear to have been applied outside the tracked migration directory. Their SQL payloads are now recovered from the production ledger and preserved separately under `supabase/recovery/production-ledger-sql/`. Do not fabricate Git history or assign old timestamps to catalog-derived snapshots.

## Current live-schema evidence

Read-only catalog inspection confirmed the live project currently has the core ticketing tables, role-assignment and audit tables, payment-account/submission tables, notification/outbox tables, gatekeeper scan history, and push subscriptions. The project also has functions in `public` and `private` schemas supporting booking, payment review, event save, role management, gatekeeper validation, reminders, expiry, email enqueueing, and web push.

This inventory was the starting point for recovery. A structured read-only catalog snapshot has since been captured for columns, constraints, indexes, RLS policies, triggers, routines, grants, extensions, Storage, and scheduled jobs. The snapshot is evidence, not executable SQL.

## Production catalog snapshot captured

A read-only, structured catalog snapshot is now preserved under `supabase/recovery/production-catalog/`:

- `applied-migrations.json`: all 64 production ledger entries.
- `columns.json`: public/private table columns, types, nullability, and defaults.
- `structure.json`: constraints, indexes, RLS policies, and non-internal triggers.
- `functions-and-grants.json`: public/private function definitions, extensions, table grants, and column grants.
- `storage-rls-cron.json`: RLS enablement flags, Storage buckets and policies, and scheduled cron jobs.
- `baseline/ACCESS_CONTROL_STORAGE_CRON.md`: expanded human-readable review of bucket limits/MIME types, all six Storage policies, two active cron jobs, schema/object ACLs, column-level grants, and default-privilege caveats.
- `baseline/RLS_EFFECTIVE_ACCESS_REVIEW.md`: effective policy matrix across all 16 public tables, public payment-account disclosure boundary, broad grant/RLS analysis, and static inspection of key SECURITY DEFINER routines.

This is a read-only catalog evidence snapshot, **not yet a runnable bootstrap SQL baseline**. Managed Supabase internals are not being recreated. The snapshot has been count-checked against production: 16 tables, 158 columns, 81 constraints, 57 indexes, 29 policies, 32 routines, and 12 distinct trigger objects (26 event-expanded trigger rows). Ownership and privilege review has also been performed. The remaining work is detailed definition/dependency review, exact grant reconciliation, Storage/cron dependency ordering, and conversion into ordered DDL. Effective RLS/grant behavior and selected SECURITY DEFINER routines are now documented in `supabase/recovery/baseline/RLS_EFFECTIVE_ACCESS_REVIEW.md`; this was static catalog/source review, not a penetration test. The current expanded access-control findings are documented in `supabase/recovery/baseline/ACCESS_CONTROL_STORAGE_CRON.md`.

## Safety and next steps

1. Keep production untouched. Never replay reconstructed migrations against production.
2. Compare the seven archived candidate scripts with the live production object definitions and confirm their ledger mappings; do not replay them.
3. Preserve the 21 timestamp mismatches as an explicit reconciliation list; do not rename files blindly.
4. Follow `supabase/recovery/BASELINE_BUILD_PLAN.md` to review the snapshot and build a separately labelled baseline; the JSON evidence files themselves are not migrations.
5. Keep the 15 ledger-extracted SQL payloads quarantined under `supabase/recovery/production-ledger-sql/`. Continue looking for original Git blobs/commits or external backups only if original Git-history provenance is required; never replay the archive.
6. Obtain a real free PostgreSQL-compatible validation runtime and test the generated baseline before proposing any changes to `main`. The current environment has no local PostgreSQL runtime, so no SQL execution test has been claimed.

Local tooling check in the current work environment found Git and Node.js, but no `psql`, `postgres`, Docker, or Supabase CLI. No local database test has been claimed or run.

## Latest status — 2026-11-14

The recovery workspace has advanced beyond the initial inventory described above:

- Seven candidate historical SQL files remain archived under supabase/recovery/historical-sql/; they are not runnable migrations and their production mapping is not claimed as byte-for-byte provenance.
- Fifteen early migrations remain missing as original Git path files, but their SQL payloads are recovered from the production ledger and archived; all 15 were verified character-for-character against a fresh ledger read.
- A complete catalog-derived baseline draft set is now indexed in supabase/recovery/baseline/README.md: tables, routines, constraints/indexes, RLS policies, triggers, privileges, Storage/cron configuration, and reconciliation/dependency/security audits.
- Structural reconciliation found 16 tables/158 columns, 81 constraints, 33 standalone indexes, 29 policies, and 12 trigger objects matching the preserved catalog. Constraint and standalone-index definitions matched exactly.
- Routine dependency, ACL, workflow, Storage, and cron findings are documented. Known payment-review NULL-decision and gatekeeper-core EXECUTE findings remain unpatched in production.
- The baseline remains **not approved for production use**. It passed an isolated PostgreSQL 17.12 DDL smoke test with minimal platform stubs; it has not passed a full Supabase integration test. The current local environment still has no PostgreSQL server, psql, Docker, or Supabase CLI.

Safety boundaries remain unchanged: production was read-only, main was not modified, no paid Supabase branch/resource was created, and no Vercel deployment was triggered.


## Application integration review — 2026-11-14

The application source was statically compared with the production-derived routine contracts. Booking creation, receipt upload, event-specific payment submission, admin payment review, admin event save, gatekeeper wrappers, and push-subscription RPC parameters align. The frontend VAPID public key was confirmed to match Vault through a boolean-only read-only query; no secret value was retrieved.

The review found a concrete legacy ticket display issue: the customer UI and gatekeeper result display booking_item.quantity on every ticket row, but three historical booking items have multiple individual ticket rows. Those rows therefore repeat the full group count instead of showing one attendee per legacy ticket. The downloaded ticket PNG also omits the attendee count. Details and a compatibility rule are in baseline/APPLICATION_INTEGRATION_AUDIT.md. No app or production change was made.

## PostgreSQL 17 DDL smoke test — 2026-11-14

The staged baseline draft passed a disposable PostgreSQL 17.12 DDL smoke test in GitHub Actions. All stages created successfully and catalog assertions matched: 16 tables, 158 columns, 81 constraints, 57 indexes, 29 public policies, 12 triggers, 32 routines, six Storage policies, and two cron jobs. Two test-discovered issues (32 missing function terminators and foreign-key ordering) were corrected before the passing run. Minimal Supabase platform stubs were used; this is not a full Supabase integration test. Full scope is documented in `supabase/recovery/baseline/POSTGRESQL_17_SMOKE_TEST.md`.
