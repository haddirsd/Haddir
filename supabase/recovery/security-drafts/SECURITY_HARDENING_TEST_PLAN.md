# Security hardening test plan

## Latest disposable PostgreSQL run

<https://github.com/haddirsd/Haddir/actions/runs/43649283501>

- Run #47, commit \`3f91df39d1d869bb3e88d4d3841a1d38f00d8fc0\`
- PostgreSQL 17.12, fresh disposable database and platform stubs.
- Result: **success**. DDL stages, catalog assertions, behavior assertions and the two-session concurrency stage all completed.
- This is not a real Supabase platform integration test.

## Payment review

- NULL and unknown decisions rejected before payment lookup.
- Whitespace-only rejection reason rejected.
- Invalid requests leave payment/booking state, stock, tickets and notifications unchanged.
- Approval: payment becomes approved, booking confirmed, one group ticket created for the booking item (quantity two attendees), pre-reserved stock remains unchanged, and one \`ticket_approved\` in-app notification is created.
- Rejection: reason is persisted, payment and booking become rejected, reserved stock is released exactly once (fixture: 5 to 2), no tickets are issued, and one \`payment_rejected\` in-app notification is created.
- Repeated approve/reject attempts are rejected as already reviewed; they do not duplicate tickets, stock release or notifications.

## Gatekeeper QR/manual

- Authenticated direct invocation of the private core is denied.
- Public QR/manual wrappers remain callable by the assigned gatekeeper.
- QR and manual preview return \`valid\` and do not create scan-log rows.
- Confirmation returns \`checked_in\`, changes ticket status to used, records one accepted scan with the correct method and creates one check-in notification.
- Repeat confirmation returns \`used\`, records the losing attempt, and does not create another notification.
- Access to a ticket belonging to an unassigned event is denied.

## Concurrent check-in

Two independent PostgreSQL sessions contend on the same ticket row. Session A locks and confirms the ticket while keeping its transaction open; session B calls the same QR wrapper before A commits. Assertions passed: final ticket status used, exactly one accepted scan, exactly one losing used scan and exactly one check-in notification.

## Trigger helper and catalog

- Catalog assertions passed for the payment NULL guard, private core EXECUTE revocation, retained public wrapper grants, unchanged service_role-only push configuration, and removal of API-role EXECUTE on \`set_updated_at\`.
- All four existing \`updated_at\` triggers continued to fire on profile, event, booking and ticket-type updates.
- The baseline catalog assertions also passed.

## Known separate finding: email outbox

The production catalog contains \`private.enqueue_booking_notification_email()\`, but no live trigger is bound to it. The notification trigger currently dispatches web push; payment review inserts in-app notification rows but does not itself enqueue an \`email_outbox\` row. This was the reason the first version of the expanded test failed: it incorrectly expected email enqueue behavior that is not wired in the captured production trigger inventory. The assertion was corrected to test the requested in-app notifications. This pre-existing email delivery gap is documented separately and is not changed by the security draft.

## Remaining release gates

- Real disposable Supabase Auth JWT validation, PostgREST, RLS request context, Storage and Edge Function integration.
- Browser/device E2E for payment submission, receipt upload/retrieval, QR camera and manual entry.
- Fresh production function/ACL/trigger reconciliation immediately before any migration.
- Search frontend and Edge Function code for direct RPC calls to \`set_updated_at\`.
- Explicit user approval.

All changes remain quarantined under \`supabase/recovery/security-drafts/\`. No production SQL, active migration, \`main\` change or Vercel deployment was performed.
