# Migration timestamp mismatch review

**Scope:** all 21 cases previously counted as same-name migrations with different timestamps between the active GitHub `supabase/migrations/` directory and the production `supabase_migrations.schema_migrations` ledger.

**Method (read-only):**
1. Read all 64 production ledger rows, including the stored `statements[1]` SQL text.
2. Enumerated all 50 active GitHub migration SQL files on the recovery branch.
3. Matched the 21 files to production rows by normalized migration name.
4. Compared the complete file text to the production ledger SQL text. Where exact byte-for-byte comparison differed, repeated comparison after removing SQL comments and insignificant whitespace.

## Results

| GitHub filename version/name | Production ledger version/name | SQL comparison |
|---|---|---|
| `20261103220000` `event_scoped_payment_accounts_only` | `20261103204518` `event_scoped_payment_accounts_only` | Equivalent after removing comments/whitespace |
| `20261103230000` `admin_manage_profile_roles` | `20261103210704` `admin_manage_profile_roles` | Equivalent after removing comments/whitespace |
| `20261105123000` `normalize_legacy_organizer_roles` | `20261105071031` `normalize_legacy_organizer_roles` | Exact SQL text |
| `20261105130000` `allow_admin_role_assignment` | `20261105071047` `allow_admin_role_assignment` | Exact SQL text |
| `20261105160000` `admin_user_search_by_email_or_phone` | `20261105121640` `admin_user_search_by_email_or_phone` | Equivalent after removing comments/whitespace |
| `20261105161500` `fix_admin_search_profiles_return_types` | `20261105122245` `fix_admin_search_profiles_return_types` | Exact SQL text |
| `20261105173000` `booking_email_outbox` | `20261105130414` `booking_email_outbox` | Exact SQL text |
| `20261105190000` `event_reminder_notifications` | `20261105131539` `event_reminder_notifications` | Equivalent after removing comments/whitespace |
| `20261105200000` `deduplicate_booking_item_tickets` | `20261105134355` `deduplicate_booking_item_tickets` | Exact SQL text |
| `20261105203000` `persist_gatekeeper_scan_history_and_page_state` | `20261105142405` `persist_gatekeeper_scan_history_and_page_state` | Exact SQL text |
| `20261105221500` `gatekeeper_manual_numeric_entry_history` | `20261105161023` `gatekeeper_manual_numeric_entry_history` | Equivalent after removing comments/whitespace |
| `20261105233500` `enable_scoped_realtime_for_events_and_gatekeepers` | `20261105183650` `enable_scoped_realtime_for_events_and_gatekeepers` | Exact SQL text |
| `20261105235000` `gatekeeper_event_wide_scan_history` | `20261105211436` `gatekeeper_event_wide_scan_history` | Equivalent after removing comments/whitespace |
| `20261105235500` `grant_gatekeeper_scan_log_realtime_select` | `20261105211503` `grant_gatekeeper_scan_log_realtime_select` | Exact SQL text |
| `20261105235600` `harden_gatekeeper_scan_history_and_indexes` | `20261105211629` `harden_gatekeeper_scan_history_and_indexes` | Equivalent after removing comments/whitespace |
| `20261108164000` `harden_customer_notifications_and_deduplicate_terminal_events` | `20261108143655` `harden_customer_notifications_and_deduplicate_terminal_events` | Exact SQL text |
| `20261108190000` `limit_supervisor_workspace_and_pause_email_queue` | `20261108144509` `limit_supervisor_workspace_and_pause_email_queue` | Exact SQL text |
| `20261108193000` `restrict_direct_ticket_table_access` | `20261108145718` `restrict_direct_ticket_table_access` | Exact SQL text |
| `20261109143000` `notify_customer_on_ticket_checkin` | `20261109110623` `notify_customer_on_ticket_checkin` | Exact SQL text |
| `20261109152000` `allow_ticket_checked_in_notifications` | `20261109132608` `allow_ticket_checked_in_notifications` | Equivalent after removing comments/whitespace |
| `20261109170000` `support_continuous_events_and_unlimited_ticket_inventory` | `20261109145434` `support_continuous_events_and_unlimited_ticket_inventory` | Exact SQL text |

## Findings

- **21/21** same-name cases map to a production ledger row with a different timestamp.
- **13/21** SQL payloads are byte-for-byte identical.
- **8/21** are not byte-for-byte identical because of comments and/or formatting; after removing SQL comments and insignificant whitespace, all 8 compare equal.
- Therefore, within this defined 21-case set, there is **no observed executable SQL difference** between the GitHub file and the production ledger payload. The mismatch is timestamp-only, with source-text presentation differences in eight cases.
- The GitHub filename timestamps are not the production ledger versions. Do not rename active files, edit historical timestamps, or replay migrations solely to make these numbers line up.

## Important scope boundaries

- This report does not resolve files whose migration names differ between GitHub and production, nor additional SQL files in the repository that do not have a same-name production ledger entry.
- It does not establish the original commit date or prove why the filename timestamps drifted.
- The comparison is based on SQL text retained in the production migration ledger and the current recovery-branch file contents.
- No production writes, DDL, migration replay, or changes to `main` were performed.

## Recommended handling

Keep the production ledger version as the authoritative applied version for each production migration. Preserve the GitHub filename as historical repository metadata. Any future cleanup should be a separately reviewed migration-history reconciliation, not an in-place rename or replay.
