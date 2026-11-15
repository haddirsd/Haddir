# Review of eight repository migrations without same-name production ledger entries

**Target:** `haddirsd/Haddir`  
**Branch:** `chore/restore-supabase-migration-history`  
**Production project:** `puhmvcekxkcxfdvgygpk`  
**Method:** read-only comparison of the eight repository SQL files, their GitHub path history, all 64 production migration-ledger entries, and relevant live catalog objects.

## Safety boundary

- No production SQL, DDL, or data was changed.
- No migration was replayed.
- No migration filename was renamed or moved.
- `main` was not changed.
- No Vercel deployment was triggered.
- This report is documentation/evidence only. Do not treat any candidate file as safe to replay.

## Executive result

The eight files do not all mean the same thing. Five have strong production-ledger counterparts under a different name or as separately recorded migrations; three contain effects that are present in production but whose exact migration provenance is not established by the ledger.

| Repository file | Evidence found | Classification |
|---|---|---|
| `20261103170000_payment_methods_and_receipts.sql` | The live `public.payment_methods` table has the candidate's nine-column shape; it contains four rows, one active. The two candidate policy names and predicates are present. The live `submit_payment` routine is a later event-aware version and accepts either a legacy global method or an event-scoped account. No ledger entry records the candidate's `CREATE TABLE payment_methods` DDL. | **Effects present; exact provenance unresolved.** Candidate is a historical precursor/possible unledgered execution, not a proven ledger-applied migration. |
| `20261105120000_event_role_assignments.sql` | The production ledger separately records `event_role_assignments_and_scoped_roles` (20261105070931), `normalize_legacy_organizer_roles` (20261105071031), and later role-function hardening/changes. The candidate combines the legacy organizer conversion with table/policy/function work; its function is not the final live implementation. | **Superseded/composed by separate recorded migrations.** The repository file itself is not proven to have run as one migration. |
| `20261105133000_limit_role_assignment_event_states.sql` | SQL payload is byte-for-byte identical to production ledger entry `limit_role_assignment_to_active_event_states` (20261105071103). | **Applied under a different version/name.** Exact SQL match. |
| `20261105150000_drop_legacy_admin_update_profile_role.sql` | SQL payload matches production ledger entry `drop_legacy_admin_update_profile_role_overload` (20261105073706) after insignificant formatting/case normalization. | **Applied under a different version/name.** Normalized SQL match. |
| `20261105160000_add_event_platform_fee_percent.sql` | Live `events.platform_fee_percent` column exists as numeric and the `events_platform_fee_percent_check` constraint enforces 0–100. Later ledger-recorded event-save and advertiser-statistics routines use the column. However, no production ledger statement records adding the column or this check constraint. | **Effect present; migration provenance unresolved.** The candidate's DDL is consistent with the live catalog, but the ledger does not prove this file ran. |
| `20261105170000_advertiser_statistics_rpc.sql` | The live private statistics routine is represented by the later production ledger entry `correct_advertiser_inventory_metrics` (20261108121617), whose implementation differs materially from this candidate (including reserved inventory and remaining-stock calculation). The public wrapper exists live, but its creation is not represented in the inspected production ledger payloads. | **Private implementation superseded by a recorded later version; public wrapper provenance unresolved.** Do not label the candidate file itself as applied verbatim. |
| `20261108130000_restore_group_ticket_issue_semantics.sql` | SQL payload is byte-for-byte identical to production ledger entry `restore_booking_item_ticket_issue_semantics` (20261108124142). | **Applied under a different version/name.** Exact SQL match. |
| `20261114010000_sync_push_subscription_owner.sql` | SQL payload matches production ledger entry `sync_haddir_push_subscription` (20261114101634) after insignificant formatting/comment normalization. The live routine definition matches the ledger implementation. | **Applied under a different version/name.** Normalized SQL match. |

## Per-file notes

### 1. Payment methods and receipts

The candidate creates a global `payment_methods` table, seeds four disabled defaults, configures the private receipt bucket/policies, and defines a first version of `submit_payment`.

Live production evidence:
- `public.payment_methods` exists with columns `id`, `name`, `account_details`, `beneficiary`, `instructions`, `is_active`, `sort_order`, `created_at`, and `updated_at`.
- Four rows exist; one is currently active.
- Policies `Active payment methods are visible to customers` and `Platform admins manage payment methods` exist with the expected role boundaries.
- The production `event_payment_accounts` ledger migration's `submit_payment` implementation checks both global `payment_methods` and event-scoped `event_payment_accounts`; this is newer than the candidate's global-only validation.

The migration ledger has no entry whose stored SQL creates `public.payment_methods`. The current table/policies prove that the effects exist, not whether this exact file was applied, applied manually, or incorporated into an untracked baseline. The one active global method is also a live legacy path worth preserving as a finding; this forensic review did not disable it.

### 2. Event role assignments

Production history is split across several ledger entries:
- `20261105070931_event_role_assignments_and_scoped_roles`
- `20261105071031_normalize_legacy_organizer_roles`
- `20261105071047_allow_admin_role_assignment`
- `20261105071103_limit_role_assignment_to_active_event_states`
- `20261105073706_drop_legacy_admin_update_profile_role_overload`

The repository candidate combines parts of that sequence in one file. The live role-update implementation is more hardened than the candidate, including owner/admin protection and event-state validation. Therefore the candidate is not a reliable single-file representation of production history.

### 3. Platform fee column

The live column and range constraint are present, and recorded later routines depend on the field. But the ledger search found no stored DDL adding the column or constraint. The live effect is established; the historical migration identity is not.

### 4. Advertiser statistics

The candidate's original private function does not match the later production implementation. The recorded `correct_advertiser_inventory_metrics` migration adds reserved-quantity reporting and uses `quantity_sold` for remaining stock, reflecting the later inventory model. The public wrapper currently exists, but the inspected ledger does not contain its creation. This is a mixed-provenance object and must not be simplified into a claim that the candidate migration was applied exactly.

## Final classification counts

- **Exact SQL matches under another production ledger name/version:** 2 files.
- **Normalized SQL matches under another production ledger name/version:** 2 files.
- **Composed/superseded by separate recorded production migrations:** 1 file.
- **Effects present but exact migration provenance unresolved:** 2 files.
- **Recorded later implementation supersedes candidate private routine; wrapper provenance unresolved:** 1 file.

These categories are mutually exclusive at the file level for this report. They describe evidence, not permission to replay.

## Required handling

1. Keep all eight files in the active repository migration directory unchanged for now; this review does not authorize renaming or deletion.
2. Do not copy any candidate into `supabase/recovery/production-ledger-sql/` and do not label it as an original production payload.
3. Do not replay any of these files.
4. Treat the global `payment_methods` path and the unledgered `platform_fee_percent` DDL provenance as unresolved historical findings for any future migration-history reconstruction.
5. If a future cleanup is approved, first design a separate forward-only migration after a complete app/RPC dependency review. This report itself makes no production changes.

## Reproducibility

The comparison used the branch's 50 SQL filenames, the production ledger's 64 rows, GitHub commit history for each of the eight paths, targeted production catalog reads, and function-definition reads. The exact and normalized matches are stated per file above. Normalization removed SQL comments and insignificant whitespace only; it did not rewrite or execute SQL.
