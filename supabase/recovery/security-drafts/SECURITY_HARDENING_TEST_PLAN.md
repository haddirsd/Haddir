# Security hardening test plan

Status: test cases specified; **not yet executed**. These require a disposable Supabase/PostgreSQL environment with the Haddir schema and representative fixtures. No production writes or live role simulations were performed.

## A. Payment review — negative cases

Run as an authenticated user whose profile role is owner/admin/supervisor, against a valid submitted payment fixture. Snapshot the payment row, booking row, relevant ticket-type inventory, tickets, and notifications before each call.

| Input | Expected result | Required invariant |
|---|---|---|
| `p_decision = NULL` | exception: invalid decision | All snapshots unchanged |
| empty string | exception: invalid decision | All snapshots unchanged |
| arbitrary value (e.g. `approve_now`) | exception: invalid decision | All snapshots unchanged |
| reject + NULL reason | exception: reason required | All snapshots unchanged |
| reject + whitespace reason | exception: reason required | All snapshots unchanged |
| approve | success | payment approved, booking confirmed, tickets issued once, one approval notification |
| reject + non-empty reason | success | payment rejected, reason persisted, reserved inventory released once, one rejection notification |
| repeat review | exception: already reviewed | No second ticket issuance, stock release, or notification |

Also run NULL/invalid decision against a nonexistent submission ID and verify the invalid-decision validation happens before the lookup error. This confirms validation order but does not replace the fixture-backed no-mutation tests.

## B. Gatekeeper access and scan audit

Using an assigned gatekeeper and a valid ticket fixture:

1. Direct invocation of `private.gatekeeper_ticket_action_core(text,boolean)` as `authenticated` must fail with permission denied.
2. QR preview through the public QR wrapper succeeds and creates the expected scan-log outcome.
3. QR confirmation through the public QR wrapper marks a valid ticket used exactly once and writes the scan log.
4. Manual preview/confirmation through the public manual wrapper preserves its entry_method and audit outcome.
5. A gatekeeper assigned to Event A cannot inspect or confirm Event B's ticket.
6. A customer, supervisor without gate assignment, and anon cannot use gatekeeper wrappers.
7. Concurrent confirmation attempts result in exactly one valid-to-used transition and no duplicate check-in notification.

Do not revoke schema `private` USAGE as part of this fix; test wrapper behavior after the function-level revoke.

## C. Trigger helper ACL

After applying the draft in the disposable database:

- `has_function_privilege('authenticated','public.set_updated_at()','EXECUTE')` is false.
- The same check for `anon` and `service_role` is false.
- Updating representative rows in bookings, events, profiles, and ticket_types still advances `updated_at` through their existing triggers.
- No application source invokes `set_updated_at` as an RPC.

## D. Catalog assertions

After applying the draft in the disposable database:

- authenticated cannot execute the private gatekeeper core.
- public QR/manual wrappers remain executable by authenticated and retain their existing definitions and security mode.
- service_role remains the only non-owner role able to execute `get_haddir_push_config()`.
- `set_updated_at()` remains attached to the same four triggers.
- `review_payment_submission` retains SECURITY DEFINER and an empty search_path.

## E. Release gate

Do not promote unless all tests pass, SQL diff is reviewed against fresh production definitions, the Supabase API exposed-schema setting is checked, and the user explicitly approves the production change. Do not use a paid Supabase branch; use an existing free disposable PostgreSQL/GitHub Actions test harness if available.
