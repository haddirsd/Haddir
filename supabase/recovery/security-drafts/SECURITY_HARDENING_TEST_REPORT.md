# Security hardening validation report

## Scope

Focused disposable-project validation of:
1. Explicit rejection of a NULL payment-review decision.
2. Removal of direct EXECUTE privileges from the private gatekeeper core routine.
3. Removal of direct EXECUTE privileges from the trigger-only `public.set_updated_at()` function.
4. Two independent PostgreSQL sessions attempting opposing decisions for the same payment at the same time.

No production database object was changed.

## Disposable project

- Project ref: `adbpeojpscwnsombisif`
- PostgreSQL: 17.11
- Applied migration: `20261115131154_harden_payment_review_and_internal_function_grants`
- Test harness used temporary `pg_cron` jobs to start separate database sessions on the same minute. A temporary 4-second UPDATE trigger widened the overlap window and was removed after the run.

The disposable project was originally created for Auth/RLS tests and did not contain the Haddir application schema or audited routines. A focused fixture was therefore created for the affected function signatures and dependent table shapes. This is not a full production-schema clone; results are limited to the behavior explicitly exercised.

## Results

| Check | Result | Notes |
|---|---|---|
| NULL decision | PASS | `review_payment_submission(NULL, NULL, NULL)` raised the expected invalid-decision exception before touching payment rows. |
| Unknown decision | PASS | An unsupported decision string raised the same validation exception. |
| Approval workflow | PASS | Submitted payment became approved, booking became confirmed, one ticket was issued for the booking item, and notification was created. |
| Rejection workflow | PASS | Submitted payment and booking became rejected, rejection reason was stored, ticket quantity sold was decremented by the booking quantity, and notification was created. |
| Core helper ACL | PASS | `PUBLIC`, `anon`, `authenticated`, and `service_role` all lack EXECUTE. |
| Trigger function ACL | PASS | `PUBLIC`, `anon`, `authenticated`, and `service_role` all lack EXECUTE. |
| Existing review RPC ACL | PASS after fixture alignment | Fixture was aligned to the production pre-migration ACL (authenticated + service_role); the migration preserves it. |
| Gatekeeper wrapper | PASS | An authenticated role could invoke the SECURITY DEFINER wrapper, which in turn called the now-private core helper. |
| Direct core invocation | PASS | An authenticated role was denied direct invocation of the core helper. |
| Trigger execution | PASS | An authenticated UPDATE fired `set_updated_at()` successfully even though the caller had no direct EXECUTE privilege. |
| True concurrent review race | PASS | Two independent pg_cron sessions started 22 microseconds apart. Approval succeeded; rejection then failed with “تمت مراجعة إثبات الدفع مسبقاً”. |
| Final race state | PASS | Payment = approved; booking = confirmed; exactly one ticket and one notification existed. |
| Advisory lock | PASS | The existing transaction-scoped advisory lock `748231905441` serialized the opposing decisions; the row lock and already-reviewed guard provided the final state check. |

## Concurrent race evidence

- Approval session started: `2026-11-15 13:21:00.097050+00`
- Rejection session started: `2026-11-15 13:21:00.097072+00`
- Approval finished: `2026-11-15 13:21:04.124583+00`
- Rejection finished: `2026-11-15 13:21:04.127088+00`
- Both pg_cron job runs completed successfully at the scheduler level. The losing business operation was correctly rejected by the payment-review function.

## Cleanup

Temporary cron jobs, the pg_cron extension installed for this test, delay trigger/function, test audit table, and all test event/booking/payment/ticket records were removed. A follow-up query confirmed zero remaining test events, bookings, or payments.

## Important review notes

- The migration replaces the existing payment-review function while preserving its workflow, role gate, row locks, advisory transaction lock, ticket creation, stock adjustment, notifications, and return payload. The only behavioral change is explicit rejection of NULL decisions.
- The gatekeeper core remains callable by its SECURITY DEFINER wrapper because the wrapper owner is `postgres`; authenticated users retain the wrapper entry point but lose direct access to the internal helper.
- Trigger invocation is performed by PostgreSQL's trigger mechanism; application roles do not need EXECUTE on the trigger function.
- Production was not modified. The migration is validated on a focused disposable fixture and still requires normal PR review before any production rollout.
