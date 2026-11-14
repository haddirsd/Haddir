# Security hardening — line-by-line review

Review date: 2026-11-15  
Branch: \`chore/restore-supabase-migration-history\`  
Production access during this review: SELECT-only catalog/function/trigger inspection.  
Status: disposable PostgreSQL workflow tests passed; production approval remains deferred.

## 1. Payment decision validation

The replacement in \`SECURITY_HARDENING_DRAFT.sql.md\` was compared with the live production function definition.

The function retains its signature, return type, PL/pgSQL language, SECURITY DEFINER mode, empty search_path, role check, advisory transaction lock, row-locking order, payment/booking mutations, ticket issuance and in-app notification behavior.

The intended functional changes are narrow:
- Explicitly reject \`p_decision IS NULL\` as well as values outside \`approve\` and \`reject\`.
- Make the rejection branch explicit with \`ELSIF\`, retaining a final defensive exception.

The rejection-reason validation remains before row lookup/mutation. Invalid decisions fail before taking the advisory lock.

## 2. Gatekeeper core EXECUTE

Live production inspection confirmed:
- The internal core is SECURITY DEFINER and had a direct EXECUTE grant to authenticated.
- The private QR/manual wrapper functions are SECURITY DEFINER and perform role/event-assignment checks before calling the core.
- The public QR/manual RPC functions delegate to those private wrappers.

The draft revokes direct EXECUTE on the core from PUBLIC, anon and authenticated only. It does not remove wrapper grants, schema USAGE, or owner execution.

Disposable runtime tests passed:
- authenticated direct core invocation denied;
- QR/manual public wrappers work for an assigned gatekeeper;
- preview, confirmation and repeat-confirmation paths behave as expected;
- cross-event ticket access is rejected;
- scan-log outcomes/methods and notification counts match expected behavior.

## 3. Trigger helper ACL

Live production inspection confirmed \`public.set_updated_at()\` is attached to four triggers: profiles, events, bookings and ticket_types.

The draft removes direct EXECUTE grants from PUBLIC, anon, authenticated and service_role without dropping/recreating triggers. In PostgreSQL, a caller's direct EXECUTE privilege is not rechecked when an already-created trigger fires.

Disposable tests passed for all four trigger updates after the ACL revoke, and catalog assertions confirmed the expected grants were absent.

A source search for direct RPC use of \`set_updated_at\` remains a release gate; the limited GitHub code search is not proof that no dynamic RPC calls exist.

## 4. Push configuration

No change proposed. The production ACL remains service_role-only. Catalog assertions confirm it remains unchanged.

## 5. Actual CI execution and failures resolved

Latest run: [GitHub Actions #47](https://github.com/haddirsd/Haddir/actions/runs/43649283501)  
Commit: \`3f91df39d1d869bb3e88d4d3841a1d38f00d8fc0\`  
Result: **success** on PostgreSQL 17.12.

Successful stages included:
- baseline DDL and catalog assertions;
- security catalog assertions;
- NULL/invalid payment and trigger behavior;
- payment approve/reject workflows and invariants;
- QR/manual gatekeeper workflows;
- two-session concurrent check-in exactly-once assertions.

Two test defects were found and corrected before the passing run:
1. The first test expected an email_outbox row. Live production has \`private.enqueue_booking_notification_email()\` but no trigger attached to it. The payment function inserts in-app notifications; the current notification trigger dispatches web push only. The invalid email-outbox expectation was removed and this separate pre-existing integration gap documented.
2. The stock assertion read the quantity after both approval and rejection, then compared it to the pre-rejection quantity. The test now asserts stock remains at 5 immediately after approval and before rejection; after rejection it asserts stock falls to 2. This was an assertion-order bug, not a change to payment logic.

## 6. Side-effect review

Passing disposable tests establish:
- invalid decision/rejection inputs do not mutate payment, booking, inventory, ticket or notification state;
- approval confirms payment/booking, issues one group ticket for the booking item, leaves already-reserved stock unchanged, and creates one approval notification;
- rejection persists the reason, rejects payment/booking, releases reserved stock once, creates no ticket, and creates one rejection notification;
- repeated review attempts do not repeat terminal side effects;
- QR/manual successful check-in creates one accepted audit row and one notification; a repeat is audited as used without a second notification;
- concurrent check-in attempts produce one accepted scan, one losing used scan and one notification;
- all four updated_at triggers still work after helper EXECUTE revokes.

## 7. Remaining limitations / release gates

The passing harness uses reconstructed production DDL and lightweight PostgreSQL platform stubs. It does not prove real Supabase Auth JWT validation, PostgREST role switching, RLS behavior, Storage integration, Edge Function delivery or browser/device flows.

Before promotion:
- run the suite against a real disposable Supabase project/environment if available;
- re-fetch and compare live production function definitions, ACLs and trigger inventory immediately before preparing a migration;
- search frontend and Edge Function code for direct RPC calls to \`set_updated_at\`;
- review the email-outbox trigger gap separately if email notifications are expected;
- obtain explicit user approval.

## Decision

The narrow security draft has passed the expanded isolated PostgreSQL 17 regression suite and no unintended side effect was observed in the covered workflows. **This is sufficient to close the isolated-database test gate, not to approve production rollout.** Keep the SQL quarantined. No active migration, production write, \`main\` update or Vercel deployment was performed.
