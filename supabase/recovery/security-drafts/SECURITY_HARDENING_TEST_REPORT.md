# Security hardening validation report

## Scope

This is a focused disposable-project validation of:
1. Explicit rejection of a NULL payment-review decision.
2. Removal of direct EXECUTE privileges from the private gatekeeper core routine.
3. Removal of direct EXECUTE privileges from the trigger-only `public.set_updated_at()` function.

No production database object was changed.

## Disposable project

- Project ref: `adbpeojpscwnsombisif`
- PostgreSQL: 17.11
- Applied migration: `20261115131154_harden_payment_review_and_internal_function_grants`

The disposable project was originally created for Auth/RLS tests and did not contain the Haddir application schema or the audited routines. A focused fixture was therefore created for the affected function signatures and dependent table shapes. This is not a full production-schema clone; the test results below are limited to the security behavior explicitly exercised.

## Results

| Check | Result | Notes |
|---|---|---|
| NULL decision | PASS | `review_payment_submission(NULL, NULL, NULL)` raised the expected invalid-decision exception before touching payment rows. |
| Unknown decision | PASS | An unsupported decision string raised the same validation exception. |
| Core helper ACL | PASS | `PUBLIC`, `anon`, `authenticated`, and `service_role` all lack EXECUTE. |
| Trigger function ACL | PASS | `PUBLIC`, `anon`, `authenticated`, and `service_role` all lack EXECUTE. |
| Existing review RPC ACL | PASS after fixture alignment | Fixture was aligned to the production pre-migration ACL (authenticated + service_role); the migration preserves it. |
| Gatekeeper wrapper | PASS | An authenticated role could invoke the SECURITY DEFINER wrapper, which in turn called the now-private core helper. |
| Direct core invocation | PASS | An authenticated role was denied direct invocation of the core helper. |
| Trigger execution | PASS | An authenticated UPDATE fired `set_updated_at()` successfully even though the caller had no direct EXECUTE privilege. |
| Advisory lock retained | PASS (static) | The payment-review function still contains the existing transaction-scoped advisory lock `748231905441`. |
| True concurrent review race | NOT YET VERIFIED | The SQL connector serialized the probe requests; the disposable project does not have `dblink`. The lock remains in the function, but this run cannot honestly be reported as a concurrent race test. |

## Important review notes

- The migration replaces the existing payment-review function while preserving its workflow, role gate, row locks, advisory transaction lock, ticket creation, stock adjustment, notifications, and return payload. The only behavioral change is explicit rejection of NULL decisions.
- The gatekeeper core remains callable by its SECURITY DEFINER wrapper because the wrapper owner is `postgres`; authenticated users retain the wrapper entry point but lose direct access to the internal helper.
- Trigger invocation is performed by PostgreSQL's trigger mechanism; application roles do not need EXECUTE on the trigger function.
- Production was not modified. Do not apply this migration to production until the remaining concurrency race test has been completed and reviewed.
