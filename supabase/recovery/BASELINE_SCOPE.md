# Bootstrap baseline readiness — production catalog review

Status: **evidence collection advanced; executable baseline not yet approved**.

This note describes the live application schema only. It is not a migration and must not be applied to production.

## Read-only scope summary

Captured directly from project `puhmvcekxkcxfdvgygpk`:

| Object | Count |
|---|---:|
| Public application tables | 16 |
| Public table columns | 158 |
| Public constraints | 81 |
| Public indexes | 57 |
| Public RLS policies | 29 |
| Public/private application routines | 32 |
| Application trigger objects in the preserved structure snapshot | 12 |
| Trigger event bindings (INSERT/UPDATE/DELETE rows in information_schema) | 26 |
| Storage buckets used by Haddir | 2 |
| Storage object policies | 6 |
| Active cron jobs | 2 |
| Public/private enum and domain types | 0 |
| Public/private views and materialized views | 0 |
| Public sequences | 0 |
| Identity columns | 0 |
| Generated columns | 0 |

The production catalog snapshot already stored alongside this note contains detailed columns, constraints, indexes, policies, triggers, routine definitions, table/column grants, bucket configuration, storage policies, and cron definitions.

## Important scope boundary

The extended catalog sweep also sees Supabase-managed schemas such as `auth`, `storage`, `vault`, `realtime`, `cron`, and `net`. Those schemas are owned and maintained by Supabase services. They must **not** be reconstructed wholesale as part of Haddir's application baseline. Haddir application objects in `public` and `private` reference managed APIs including `auth.uid()`, `auth.users`, `storage.objects`, `vault.decrypted_secrets`, and `net.http_post`; a clean target therefore needs a compatible Supabase environment and those managed services.

No user-defined enum/domain/view/sequence/identity/generated-column objects were found in the app schemas during this pass. This reduces the app DDL dependency graph, but does not make the baseline self-contained.

## Remaining checks before writing a runnable baseline

1. Capture function EXECUTE ACLs, schema privileges, default privileges, and relevant role memberships. Existing grant evidence includes table and column grants, but is not by itself a complete privilege reconstruction.
2. Confirm table ownership and exact CREATE TABLE ordering against foreign-key dependencies. Constraints must be added after their referenced tables exist.
3. Review all 32 function bodies for dependencies on Supabase-managed services and external secrets. Vault secret values must never be exported into source control.
4. Reconcile Storage bucket/policy DDL and cron jobs separately; cron jobs may require deployment-specific URLs/secrets and must not blindly replay.
5. Generate the bootstrap in a separate recovery path, never in `supabase/migrations` until validated and deliberately adopted.
6. Validate on a free disposable local PostgreSQL/Supabase-compatible environment. No local database runtime is currently available in the execution environment, so no SQL parser or database execution test has been claimed.

## Safety

- Production database was queried read-only; no DDL or data changes were made.
- No Supabase paid branch was created.
- No Vercel deployment was triggered.
- No changes were made to `main`.
- Historical SQL archives remain quarantined under `supabase/recovery/historical-sql/` and are not runnable migrations.

## Next implementation step

Complete the missing privilege/ownership evidence, then generate a clearly labelled **draft** bootstrap for Haddir-owned `public`/`private` objects with explicit Supabase prerequisites. Keep it separate from the migration ledger and do not execute it until reviewed and tested.

## Privilege and ownership review (read-only)

- All 16 Haddir public tables are owned by `postgres`; RLS is enabled and FORCE RLS is not enabled on these tables.
- The `private` schema is owned by `postgres`; its ACL grants USAGE to `authenticated` and USAGE/CREATE to `postgres`.
- The `public` schema is owned by `pg_database_owner`; the current ACL includes USAGE for `anon`, `authenticated`, and `service_role`.
- Function ACLs were inspected for all 32 application routines. Several private worker/trigger functions are postgres-only, while selected RPC/helper functions grant EXECUTE to `authenticated`; selected public RPCs also grant EXECUTE to `service_role`. `set_updated_at()` currently grants EXECUTE to PUBLIC, so preserve that deliberately rather than applying a blanket function grant.
- Default privileges exist for both `postgres` and `supabase_admin` in `public` for tables, sequences, and functions. This is deployment-managed privilege state and must be reconciled, not blindly copied into a generic PostgreSQL instance.
- Role memberships include Supabase-managed roles and service principals. Do not create or alter these memberships in an app bootstrap; the target Supabase environment owns them.

Trigger-count clarification: the production catalog has **12 distinct trigger objects**. The `information_schema.triggers` view returns **26 rows** because multi-event triggers (INSERT/UPDATE/DELETE) appear once per event. The snapshot's trigger-object count of 12 is therefore correct.

These results close the earlier ACL discovery gap at the evidence level. A structured, exact ACL export and the baseline DDL ordering review are still required before calling the SQL baseline runnable.
