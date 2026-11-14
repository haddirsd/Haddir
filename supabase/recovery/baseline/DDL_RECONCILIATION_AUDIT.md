# Baseline DDL-to-catalog reconciliation audit

**Status: source-level reconciliation completed; no SQL was executed.**

This audit compares the Markdown SQL drafts with the preserved production catalog evidence and one additional read-only production query for type modifiers. It verifies structural correspondence, not successful creation in PostgreSQL.

## 1. Table and column draft

| Check | Result |
|---|---:|
| Production public tables | 16 |
| Draft CREATE TABLE statements | 16 |
| Production public columns | 158 |
| Draft column declarations | 158 |
| Missing or extra table/column identities | 0 |
| Differences in base type, nullability, or default vs `columns.json` | 0 |

The column parser compared every draft column's base type, NULL/NOT NULL state, and default expression with the preserved catalog export. Numeric precision/scale and character width are not represented in that JSON export, so a fresh read-only production query checked all constrained types:

- `booking_items.unit_price`: numeric(12,2)
- `booking_items.line_total`: numeric(12,2)
- `bookings.subtotal`: numeric(12,2)
- `events.platform_fee_percent`: numeric(5,2)
- `payment_submissions.amount`: numeric(12,2)
- `ticket_types.price`: numeric(12,2)
- `bookings.currency`, `payment_submissions.currency`, `ticket_types.currency`: character(3)

These match the precision and width written in the table draft. No application column has an identity or generated expression in the catalog review.

## 2. Constraints and indexes

| Check | Draft | Production | Difference |
|---|---:|---:|---:|
| Constraints | 81 | 81 | 0 |
| Primary keys | 16 | 16 | 0 |
| Unique constraints | 8 | 8 | 0 |
| Foreign keys | 32 | 32 | 0 |
| Check constraints | 25 | 25 | 0 |
| Standalone indexes | 33 | 33 | 0 |
| Total indexes including constraint-backed indexes | — | 57 | 0 |

Every one of the 81 draft constraint names and definitions was compared with `structure.json`; all matched exactly. Every one of the 33 standalone index statements was compared with the corresponding production index definition; all matched exactly. No missing or extra constraint/index names were found.

The 24 constraint-backed indexes are created by primary-key/unique constraints and are intentionally not duplicated in the standalone index section. The separate constraint/index review retains the two missing leading FK indexes, duplicate unique-index finding, and global event-role uniqueness business-rule note.

## 3. RLS policies and trigger bindings

| Check | Draft | Production | Difference |
|---|---:|---:|---:|
| RLS-enabled public tables | 16 | 16 | 0 |
| Policies | 29 | 29 | 0 |
| Trigger objects | 12 | 12 | 0 |

- All 29 policy names and target-table pairs match the production catalog snapshot.
- Policy expressions reference only `private.current_profile_role()` and `private.current_user_is_owner()` as application helper routines; both definitions are present in the routine draft.
- Policies target 15 tables. `public.email_outbox` has RLS enabled but no policy in the production snapshot; do not invent one.
- All 12 trigger names and target-table pairs match the production snapshot. They span eight target tables.
- The trigger draft references `private.capture_admin_activity()`, `private.dispatch_haddir_web_push()`, and unqualified `set_updated_at()`; the corresponding captured definitions exist, with the latter defined as `public.set_updated_at()`.

## 4. Privilege draft structure

The newly added `60-privileges-draft.sql.md` contains:
- 38 grouped table-grant statements for anon/authenticated/service_role.
- Two explicit column-only UPDATE statements covering three columns.
- 32 per-signature routine revocations followed by observed EXECUTE grants.
- No role creation, role memberships, hosted default privileges, or managed-schema recreation.

This is generated from catalog evidence and ACL inventory. It has not been executed; effective privileges and PUBLIC inheritance still require a real target-environment verification.

## 5. Reconciliation boundary

The source-level checks above establish that the drafts contain the expected object identities and that the constraints/index definitions match the catalog text. They do **not** establish that the complete baseline will execute successfully. PostgreSQL creation order, SQL/PLpgSQL body compilation, platform integration availability, Storage policies, cron behavior, ACL inheritance, and runtime application workflows remain untested until a compatible disposable PostgreSQL/Supabase environment is available.

No production DDL, data, grants, policies, triggers, Storage objects, or cron jobs were changed. No migration was run and no deployment was triggered.


## 6. Storage and cron draft

The new `70-storage-cron-draft.md` was cross-checked against `storage-rls-cron.json`:

- 2 bucket configuration blocks match the production IDs and settings.
- 6 Storage policy statements match all six production policy names.
- 2 cron schedule statements preserve both job names, cron expressions, and command strings.
- No secret values, Vault payloads, or credentials were included.
- The Storage schema is treated as Supabase-managed; bucket configuration is represented as TOML and policy DDL targets only `storage.objects`.
- Cron job IDs are not copied; stable names are used because IDs are environment-specific.

This is a source-level cross-check only. It does not validate bucket synchronization, policy execution, scheduled worker behavior, or external push delivery.
