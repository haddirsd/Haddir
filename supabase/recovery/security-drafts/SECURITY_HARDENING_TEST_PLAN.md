# Security hardening test plan

The PostgreSQL 17 disposable harness now includes fixture-backed payment and gatekeeper workflow assertions. These tests use reconstructed production DDL and lightweight platform stubs; they are not full Supabase integration tests.

## Payment
- NULL, unknown decisions and whitespace rejection reason are rejected.
- Negative cases preserve payment/booking state, inventory, tickets and notifications.
- Approval confirms payment and booking, issues one group ticket per booking item, preserves pre-reserved inventory, and emits one approval notification and email-outbox row.
- Rejection persists its reason, rejects the booking/payment, releases exactly the reserved stock, creates no tickets, and emits one rejection notification and email-outbox row.
- Repeated approve/reject calls cannot repeat side effects.

## Gatekeeper
- Authenticated direct invocation of the private core is denied; public QR/manual wrappers remain usable.
- QR and manual preview, confirmation and repeat-confirmation paths are asserted.
- Correct scan-log methods/outcomes and one check-in notification are asserted.
- Gatekeeper access to an unassigned event is denied.

## Concurrency
Two separate psql processes run concurrently against one ticket. Session A holds the row lock, confirms the ticket and delays commit; session B invokes the same QR wrapper while A is uncommitted. Assertions require one accepted scan, one losing used scan, final used state and one check-in notification.

## Still not covered
- Real Supabase Auth JWT validation, PostgREST, RLS request context, Storage and Edge Functions.
- Full browser/device payment and receipt flow, QR camera flow and network retry behavior.
- A production change remains blocked until a real disposable Supabase integration run, fresh live-definition reconciliation and explicit user approval.
