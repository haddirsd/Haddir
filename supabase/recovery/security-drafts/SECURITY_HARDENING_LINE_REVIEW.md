# Security hardening — line-by-line review

Review date: 2026-11-15
Branch: `chore/restore-supabase-migration-history`
Production access: read-only catalog/function inspection only.
Status: review draft; not approved for production.

## 1. Payment decision validation

Live production definition was re-fetched and compared with the replacement body in `SECURITY_HARDENING_DRAFT.sql.md`.

The replacement retains the live function signature, return type, PL/pgSQL language, SECURITY DEFINER mode, empty search_path, role check, advisory transaction lock, row-locking order, approval/rejection mutations, ticket issuance, and notifications.

Only two control-flow changes are intended:
- Add an explicit `p_decision IS NULL OR ... NOT IN ('approve','reject')` guard. This closes the SQL three-valued-logic hole where `NULL NOT IN (...)` evaluates to NULL rather than TRUE.
- Change the rejection `ELSE` into `ELSIF p_decision='reject'`, with a final defensive exception branch.

The rejection-reason nonblank validation remains before any row lookup or mutation. Invalid decisions therefore fail before taking the advisory lock or reading/mutating booking rows.

**Review caveat:** this is a high-impact SECURITY DEFINER function. Although the live body was fetched and the intended diff is narrow, the complete SQL has not yet been compiled or exercised against representative payment fixtures. Do not promote until that test is done.

## 2. Gatekeeper core EXECUTE

Live catalog confirms:
- `private.gatekeeper_ticket_action_core(text,boolean)` is SECURITY DEFINER.
- Its current explicit ACL grants EXECUTE to `authenticated` and owner `postgres`.
- The two private entry wrappers `private.gatekeeper_ticket_action` and `private.gatekeeper_manual_ticket_action` are also SECURITY DEFINER and currently executable by authenticated.
- Public QR/manual wrappers are SQL SECURITY INVOKER functions which delegate to the corresponding private SECURITY DEFINER wrappers.
- The private wrappers perform role and event-assignment checks, call the core, and write scan audit rows.

The proposed revoke targets only direct execution of the core from PUBLIC/anon/authenticated. It does not revoke EXECUTE from the private wrapper owner, change wrapper grants, change schema USAGE, or change public RPC wrappers.

**Review caveat:** runtime tests must verify both QR and manual paths after the revoke, including cross-event rejection and exactly-once check-in. The draft must not be widened to revoke the private wrapper functions.

## 3. Trigger helper ACL

Live production confirms `public.set_updated_at()` is a non-SECURITY-DEFINER trigger function attached to exactly four public tables:
- bookings
- events
- profiles
- ticket_types

The draft removes API-role EXECUTE grants from PUBLIC, anon, authenticated, and service_role. It does not drop or recreate any trigger. PostgreSQL trigger execution does not require the calling DML role to have direct EXECUTE on the trigger function.

**Review caveat:** disposable-database tests must update representative rows and verify all four triggers still advance `updated_at`. Also search all app and Edge Function source for direct RPC calls before promotion.

## 4. Push configuration function

No change proposed. Live ACL remains restricted to service_role and postgres. The function returns private VAPID/hook secrets and must not be exposed to anon/authenticated. Keep it unchanged.

## 5. Test harness review

The existing PostgreSQL 17 smoke runner was extended to:
- extract and execute the quarantined hardening SQL after baseline DDL setup;
- run catalog assertions for the private core, public QR/manual wrappers, push config, and trigger helper;
- run the security catalog assertion SQL file.

The GitHub Actions workflow path filter includes `supabase/recovery/security-drafts/**`, so changes to these files trigger the workflow on the recovery branch.

**Execution status:** the GitHub connector available in this session does not expose a general workflow-run listing/dispatch action. The commit's combined status currently shows only the Vercel rate-limit failure and no GitHub Actions result. The commit-to-workflow lookup returned no PR-associated runs. Therefore the latest PostgreSQL workflow result cannot be verified here; it is not accurate to call the new tests passed.

The runner requires a PostgreSQL client and server. Neither `psql` nor `postgres` nor Docker is installed in the current execution environment, so local execution is unavailable.

## 6. Remaining runtime tests

The catalog assertions are not substitutes for behavior tests. Still required in a disposable environment:
- payment NULL/invalid decision cases with no state changes;
- approval and rejection with representative fixtures and exact ticket/inventory/notification counts;
- repeat-review idempotency;
- QR/manual gatekeeper preview and confirmation, audit semantics, cross-event denial, and concurrent double-scan;
- updated_at trigger behavior on all four tables.

The test plan was corrected: valid-ticket preview currently returns `status=valid` and intentionally does not create a scan-log row; confirmation creates the accepted audit row.

## Decision

The proposed SQL diff is narrowly scoped and structurally consistent with the live definitions reviewed. It is **not yet test-verified**. Keep all changes quarantined under `supabase/recovery/security-drafts/`. No active migration, production SQL, main-branch change, or deployment is authorized by this review.
