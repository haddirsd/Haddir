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


## 7. Fresh live-production reconciliation — 2026-11-14

A second read-only catalog extraction was run directly against the active production project on 2026-11-14. The current live catalog was compared again with the recovery-branch drafts and the preserved production snapshots.

| Object/check | Live production | Draft | Result |
|---|---:|---:|---|
| Public application tables | 16 | 16 | Exact identity set |
| Public columns | 158 | 158 | Exact identity set |
| Column type / type modifier | 158 | 158 | 0 differences |
| NULL / NOT NULL | 158 | 158 | 0 differences |
| Column defaults | 158 | 158 | 0 differences |
| Constraints | 81 | 81 | Exact name and table set |
| Standalone index definitions | 33 | 33 | 0 definition differences |
| All indexes, including constraint-backed | 57 | 57 | Exact name set |

The live column extraction independently confirmed the draft's numeric precision/scale and character(3) currency widths. No column was missing, extra, reordered within its table, or different in type, nullability, or default.

All 81 constraint names and owning tables match the live catalog. The 16 primary keys, 8 unique constraints, 32 foreign keys, and 25 CHECK constraints are all present. The CHECK expressions are emitted with different redundant grouping parentheses in parts of the draft compared with the current server's pg_get_constraintdef formatting; the expressions preserve the same tested columns, operators, constants, and allowed-value sets. This is SQL pretty-printing, not an observed rule change. All FK targets and ON DELETE actions are retained.

All 33 standalone index statements match the live pg_indexes.indexdef output exactly after whitespace normalization. The remaining 24 of 57 live indexes are created by PK/UNIQUE constraints and are correctly omitted from the standalone index section.

### Structural reconciliation conclusion

**PASS — no missing or extra tables, columns, constraints, or indexes were found.** No type, type modifier, nullability, default, or standalone index definition drift was found between the current production catalog and the recovery drafts.

This conclusion is limited to the public application table/column/constraint/index scope above. It does not certify routine bodies, grants, policies, triggers, Supabase-managed schemas, Storage, cron execution, application behavior, or historical migration completeness; those have separate audits and/or remain separate validation work.

The production queries used for this reconciliation were catalog-only SELECTs. No production DDL/DML, migration, grant, policy, or index change was made. The report update is documentation-only on chore/restore-supabase-migration-history; main remains untouched and no Vercel deployment was triggered.


## 8. Fresh live-production routine, privilege, and RLS reconciliation — 2026-11-14

A fresh read-only catalog extraction was compared with the preserved production catalog, routine draft, policy draft, and privilege draft.

### Routine definitions and execution properties

| Check | Live production | Draft | Result |
|---|---:|---:|---|
| Routine identities / definitions | 32 | 32 | Exact definition match |
| Owner = postgres | 32 | 32 | Exact |
| Explicit empty search_path | 32 | 32 | Exact |
| SECURITY DEFINER | 23 | 23 | Exact |
| SECURITY INVOKER | 9 | 9 | Exact |
| Private routines | 17 | 17 | Exact |
| Private SECURITY DEFINER | 17 | 17 | Exact |
| Public SECURITY DEFINER | 6 | 6 | Exact |

All 32 routine signatures and pg_get_functiondef bodies match exactly. The corrected schema inventory is 17 private routines (all SECURITY DEFINER) and 15 public routines (six SECURITY DEFINER, nine invoker-security). All routine languages match the captured definitions.

### Routine EXECUTE ACLs

- 32 per-signature REVOKE statements cover all 32 routines.
- 41 explicit EXECUTE grant entries match the live ACL exactly.
- The live ACL contains 32 owner EXECUTE entries plus those 41 explicit grantee entries.
- No unexpected non-owner EXECUTE ACL entries were found outside the draft.
- public.get_haddir_push_config() is executable by service_role and owner postgres only.
- public.set_updated_at() has the observed PUBLIC EXECUTE grant, plus explicit anon/authenticated/service_role grants.
- private.gatekeeper_ticket_action_core(text, boolean) has authenticated EXECUTE in production. This remains a high-priority security finding because direct execution can bypass wrapper scan logging. The recovery draft records the current grant faithfully; it does not remediate it.

### RLS policies and table/column grants

| Check | Live production | Draft / snapshot | Result |
|---|---:|---:|---|
| Public application tables with RLS | 16 | 16 | Exact |
| FORCE RLS | 0 | 0 | Exact |
| Policies | 29 | 29 | Exact |
| PERMISSIVE policies | 29 | 29 | Exact |
| Table-grant rows | 333 | 333 | Exact |
| Expanded column-privilege rows | 1,961 | 1,961 | Exact |

All 29 policies match by identity, target table, roles, command, USING expression, and WITH CHECK expression. email_outbox intentionally has RLS enabled and no policy. No missing or extra policy was found.

The 333 table-grant rows and 1,961 expanded column-privilege rows match the live catalog. The only explicit column-only UPDATE grants are profiles.full_name, profiles.phone, and notifications.is_read for authenticated.

### Schema ACL and hosted defaults clarification

The direct live schema ACL is:
- private: USAGE to authenticated; USAGE and CREATE to postgres.
- public: USAGE to PUBLIC, pg_database_owner, and postgres; CREATE to pg_database_owner only. anon, authenticated, and service_role inherit USAGE through PUBLIC rather than being separate direct schema ACL grantees.

The hosted default ACL inventory remains intentionally excluded from generic bootstrap SQL. Production has default privileges for both postgres and supabase_admin in public, including broad table privileges (PostgreSQL 17 reports MAINTAIN as well), sequence SELECT/UPDATE/USAGE, and function EXECUTE. These are platform/project defaults, not generic application grants.

### Reconciliation conclusion and security boundary

**PASS — routine definitions and security attributes, per-signature EXECUTE ACLs, RLS policy definitions, RLS table flags, and application table/column grants match the live production catalog.**

This does not constitute a runtime role-based penetration test or full Supabase integration test. The authenticated EXECUTE grant on the private gatekeeper core and the broad hosted default privileges remain explicit security review findings. No production routines, grants, policies, schema ACLs, or data were changed. All production queries were catalog-only SELECTs.
