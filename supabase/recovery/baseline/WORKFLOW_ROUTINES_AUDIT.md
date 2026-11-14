# Operational workflow and routine-to-table audit

**Status: static source review + read-only production data checks. No production changes. No runtime test was performed.**

Project: `puhmvcekxkcxfdvgygpk` (`haddir`)  
Date: 2026-11-14  
Scope: booking creation, inventory reservation/release, receipt upload and payment submission, payment review, ticket issuance, QR/manual gate validation, and related grants.

## Executive summary

The live data is currently internally consistent across the reviewed workflow:
- 55 confirmed bookings, 4 expired bookings, and 2 rejected bookings.
- 55 approved payment submissions and 2 rejected submissions.
- Every reviewed ticket type has `quantity_sold` equal to the sum of booking-item quantities in `pending_payment`, `under_review`, and `confirmed` bookings.
- No duplicate or malformed ticket codes, duplicate QR tokens, or inconsistent `used_at` / ticket status pairs were found.
- No cross-link mismatch was found in the prior table/column audit.

Two implementation-level issues require remediation review before treating the workflow as fully hardened:
1. `public.review_payment_submission` does not reject a NULL decision explicitly. PL/pgSQL treats a NULL IF condition as not true; a NULL `p_decision` bypasses the allow-list check and the reject-reason guard, then falls into the function's `ELSE` rejection branch. This can reject a submission without a required reason.
2. `private.gatekeeper_ticket_action_core(text,boolean)` is SECURITY DEFINER and currently has EXECUTE for `authenticated`. The intended public gatekeeper wrappers call it and write scan logs, but a direct invocation of the core routine can update a ticket to `used` without going through the wrapper's scan-log insertion. The private schema is not assumed to be exposed through PostgREST, but the direct grant is unnecessary for this call graph and violates least privilege.

These are static findings from production routine definitions and ACL metadata. They have not been exercised as live exploit tests.

## Workflow map

### 1. Booking creation and stock reservation

Routine: `public.create_booking(uuid, uuid, integer)`  
Tables: `profiles`, `events`, `ticket_types`, `bookings`, `booking_items`, `auth.users`.

Observed behavior:
- Requires `auth.uid()`; rejects unauthenticated calls.
- Requires quantity from 1 through 5.
- Takes transaction advisory lock `748231905441`.
- Locks the selected ticket type row `FOR UPDATE`, and confirms it belongs to the requested event and is active.
- Requires published event; non-continuous events must have a future non-null start time.
- Enforces ticket sales start/end timestamps.
- Expires overdue pending-payment bookings containing the selected ticket type, subtracts their quantities from `quantity_sold`, then rechecks inventory.
- Requires profile full name and phone.
- Calculates subtotal from ticket price × quantity, creates a 20-minute pending-payment booking, inserts one booking-item row, and increments `quantity_sold`.

Assessment:
- Row lock + transaction-scoped advisory lock protect against concurrent overselling in the observed routine.
- The global advisory lock also serializes unrelated booking/review/expiry operations that use the same key. This is safe but can become a throughput bottleneck as usage grows.
- The current routine inserts one booking-item row with a quantity, which is consistent with the live group-ticket model.
- Current inventory reconciliation found zero deltas across all 20 ticket types.

### 2. Expiry and inventory release

Routine: `private.expire_pending_bookings()`; invoked by the existing cron job.  
Tables: `bookings`, `booking_items`, `ticket_types`, `notifications`.

Observed behavior:
- Uses the same advisory lock.
- Selects overdue `pending_payment` bookings with `FOR UPDATE SKIP LOCKED`.
- Changes the booking to `expired` and subtracts each booking-item quantity from ticket-type `quantity_sold`, clamped at zero.
- Notifies the customer when the booking has a user ID.

Assessment:
- The cron routine and inline expiry cleanup in `create_booking` both release inventory. The booking status guard prevents the same booking from being released twice by these paths.
- Expiry routine is postgres-only EXECUTE; it should remain a server/cron operation.
- Existing cron cadence is every minute. No cron configuration was changed or invoked as part of this audit.

### 3. Receipt upload and payment submission

Storage:
- `payment-receipts` is private, max 5 MiB, restricted to JPEG/PNG/WebP.
- INSERT policy binds the first object path segment to `auth.uid()`, the second to a booking ID owned by that user, and requires the booking to be `pending_payment` and not expired.
- No UPDATE/UPSERT policy is present; receipt upload is insert-only.

Routine: `public.submit_payment(uuid,text,text,text)`.  
Tables: `bookings`, `event_payment_accounts`, `payment_submissions`; reads `storage.objects`.

Observed behavior:
- Requires authenticated caller and a non-empty event payment-account ID.
- Requires receipt path matching caller UUID / booking UUID / safe filename.
- Locks only a booking owned by the caller.
- Confirms the selected active payment account belongs to the same event as the booking.
- Requires the booking to remain `pending_payment` and unexpired.
- Confirms the receipt object exists in the private bucket.
- Snapshots amount, currency, payment-account ID/name/number/beneficiary into `payment_submissions`.
- Changes booking state to `under_review`.

Assessment:
- Event-specific account validation and payment detail snapshotting are correctly coupled to the booking's event.
- Booking row lock plus state transition prevent a second successful submission for the same booking through this routine.
- Receipt path ownership is checked both by Storage policy and the SQL routine.
- A failed submission after successful object upload can leave an unused receipt object in Storage. This is a cleanup/lifecycle concern, not a current data-integrity failure; any cleanup must avoid deleting receipts attached to submitted/reviewed payments.
- Current data: 57 submissions, none missing receipt path or event-account ID; submitted amounts match booking subtotals.

### 4. Payment review and decision validation

Routine: `public.review_payment_submission(uuid,text,text)`.  
Tables: `payment_submissions`, `bookings`, `booking_items`, `ticket_types`, `tickets`, `notifications`.

Observed behavior:
- Requires profile role owner/admin/supervisor.
- Takes the shared advisory lock.
- Locks the payment submission and booking rows.
- Prevents repeat review by requiring payment status `submitted`.
- On approval: creates one ticket per booking-item row, marks payment approved and booking confirmed, clears expiry, and notifies the customer with both ticket count and attendee count.
- On rejection: marks payment rejected, releases each booking-item quantity from inventory, marks booking rejected, and notifies customer with reason.

**Finding OPS-01 — NULL decision can bypass validation (high priority).**

Current source checks:
`if p_decision not in ('approve','reject') then ...`  
then separately checks a reason only when `p_decision='reject'`, and later uses `IF p_decision='approve' THEN ... ELSE ...`.

When `p_decision` is NULL, the first IF condition evaluates NULL and does not raise; the reject-reason condition also does not raise; the final IF is not true and execution enters ELSE, rejecting without a reason. A future fix should explicitly reject NULL (e.g. `p_decision IS NULL OR p_decision NOT IN (...)`) and use explicit `ELSIF p_decision='reject'` / defensive ELSE raise. Do not patch production during recovery.

**Finding OPS-02 — booking state is not explicitly checked during review (medium priority).**

The routine verifies payment status `submitted` but does not explicitly require booking status `under_review`. The normal `submit_payment` path sets this state, and current data is consistent, but a defensive state-machine check would prevent approving/rejecting a submission attached to a booking in an unexpected state. Add this only after confirming legacy/admin recovery workflows.

### 5. Ticket issuance semantics

Observed rule: one ticket row per booking-item row, while attendee count is the sum of `booking_items.quantity`.

Current production data:
- 64 tickets issued for 64 confirmed booking-item rows.
- 175 attendee units represented by those rows.
- 27 confirmed booking items represent multiple attendees.
- No duplicate ticket codes or QR tokens.
- All ticket codes match the ten-digit numeric format.
- No `used` ticket lacks `used_at`; no `valid` ticket has `used_at`.

Assessment:
- This is group-ticket issuance, not one ticket per attendee.
- Ticket display and gatekeeper UI must clearly show that one ticket covers the booking item's attendee quantity.
- Do not change issuance to one QR per attendee as part of baseline recovery; that is a separate product/schema migration requiring reconciliation and UX design.

### 6. QR and manual gate validation

Routines:
- `public.gatekeeper_ticket_action(text,boolean)` — SQL wrapper over private QR wrapper.
- `public.gatekeeper_manual_ticket_action(text,boolean)` — SQL wrapper over private manual wrapper.
- Private wrappers call `private.gatekeeper_ticket_action_core(text,boolean)`.
- History/stat routines validate the gatekeeper role and event assignment.

Observed behavior:
- Gatekeeper identity is checked against `profiles.role` (gatekeeper/organizer).
- Core routine checks that the caller has a gatekeeper/organizer assignment for the ticket's actual event.
- Preview mode returns validity details without consuming the ticket.
- Confirm mode updates only rows still in `valid` state, setting `used` and `used_at`; a concurrent second confirmation cannot also update the same row.
- The wrapper records accepted/used/forged/invalid attempts in `gatekeeper_scan_logs`.
- Manual wrapper enforces ten numeric digits and checks the assigned event before delegating.
- Current scan logs include QR and manual attempts; no ticket-code integrity problems were found.

**Finding OPS-03 — core gatekeeper function has unnecessary authenticated EXECUTE (high priority).**

ACL inspection confirms `authenticated` can execute `private.gatekeeper_ticket_action_core(text,boolean)`. The wrappers are SECURITY DEFINER and invoke the core as their owner, so the authenticated grant is not required for the intended call chain. Direct invocation of the core can change ticket status without the wrapper inserting a corresponding `gatekeeper_scan_logs` row. Revoke direct authenticated EXECUTE after checking all legitimate call sites; retain wrapper execution only. The audit did not change grants.

Additional note:
- The core returns buyer name and group attendee count to the authorized gatekeeper. This is operationally relevant for group entry but should remain restricted to assigned gatekeepers and not be exposed in customer ticket views.

## ACL summary for key workflow routines

Observed effective EXECUTE:
- `public.create_booking`: authenticated, service_role; not anon.
- `public.submit_payment`: authenticated, service_role; not anon.
- `public.review_payment_submission`: authenticated, service_role; not anon. Body enforces owner/admin/supervisor.
- Public gatekeeper QR/manual wrappers: authenticated and service_role; not anon.
- Private gatekeeper wrappers/core: authenticated and postgres; not anon.
- Expiry and reminder cron routines: postgres only.
- Gatekeeper history/stats functions: authenticated on the private implementation; public wrappers also available to authenticated callers where present.

All reviewed SECURITY DEFINER routines have empty `search_path`. This is positive hardening, but it does not replace explicit authorization checks and minimal EXECUTE grants.

## Recommended remediation queue (not applied)

1. Fix NULL decision handling in payment review and add an explicit booking-state precondition.
2. Remove authenticated EXECUTE from `private.gatekeeper_ticket_action_core` after confirming no direct application dependency; verify wrappers still function.
3. Add regression tests for duplicate payment submission, NULL/invalid decision, repeated review, approval/rejection inventory transitions, QR double-scan concurrency, manual-code event scoping, and direct core invocation denial.
4. Design safe cleanup for orphan receipt uploads, preserving every receipt referenced by a payment submission.
5. Monitor contention on the shared advisory lock before changing its scope; any redesign must preserve oversell prevention and expiry/review correctness.

## Test boundary

This report is based on catalog inspection, routine source review, ACL inspection, Storage policy inspection, and read-only aggregate checks against current production data. It is **not** a runtime integration test, penetration test, concurrency stress test, or PostgreSQL baseline creation test. No function, grant, table, policy, cron job, storage object, or production record was changed.
