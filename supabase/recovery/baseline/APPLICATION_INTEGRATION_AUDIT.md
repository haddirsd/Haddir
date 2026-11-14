# Application-to-database integration audit

**Status: static source review completed for the booking, payment, admin-event, gatekeeper, ticket, and push paths. No application code was changed and no end-to-end runtime test was performed.**

Application source reviewed from main at `baef1038731ed2156b3e57baffe3c091e002e4e8`. The database contract was compared with the production-derived routine drafts and catalog evidence on this recovery branch.

## 1. Booking creation

Frontend:
- `features/booking/services/booking-records.service.ts`
- `features/booking/hooks/useBookingSubmission.ts`

Database:
- `public.create_booking(uuid, uuid, integer)`

**Contract match:** frontend sends `p_event_id`, `p_ticket_type_id`, and `p_quantity`; the RPC returns a row array and the frontend correctly unwraps its first row. The returned booking ID/number fields match the frontend type.

The hook prevents duplicate submits with a ref lock, reuses a recent booking for the same event/ticket/quantity selection, checks for an already committed payment before re-uploading, and retains the receipt path after ambiguous payment-RPC errors. Its 19-minute reuse window is shorter than the database's 20-minute booking expiry.

## 2. Receipt upload and payment submission

Frontend:
- `features/booking/services/booking-receipts.service.ts`
- `features/booking/services/booking-payments.service.ts`
- `app/api/booking/receipt/route.ts`

Database:
- `public.submit_payment(uuid, text, text, text)`
- `storage.objects` receipt INSERT policy

**Contract match:**
- Browser sends booking ID and file to the same-origin receipt route with the current user access token.
- Server validates the user with Supabase Auth, validates UUID/MIME/size, uses the publishable key plus the user's bearer token, and uploads with `upsert: false`.
- Storage path is `<auth-user-id>/<booking-id>/<random-file-name>`, matching the receipt policy and database path validation.
- Frontend sends `p_booking_id`, `p_payment_method_id`, `p_receipt_path`, and `p_transfer_reference`; these names match the live routine definition. The payment-method parameter is in fact the event-specific `event_payment_accounts.id` (text), not the legacy global payment_methods table.
- The database validates account/event linkage and snapshots the account details into payment_submissions.

**Known lifecycle gap:** if Storage commits an upload but the HTTP response is lost before the path reaches the browser, the client cannot reuse that object and a retry can create another object. The existing hook handles ambiguous payment-RPC responses carefully once it has the path, but there is no orphan-object cleanup lifecycle. This is consistent with the separate workflow audit finding.

## 3. Payment review

Frontend:
- `features/booking/admin/admin-payments.service.ts`
- `features/booking/admin/AdminPaymentsWorkspace.tsx`
- `features/booking/admin/useAdminPayments.ts`

Database:
- `public.review_payment_submission(uuid, text, text)`

**Contract match:** frontend sends `p_submission_id`, `p_decision`, and `p_rejection_reason`. The JSON response fields `booking_id` and `tickets_created` match the mapping to the admin result type. The UI requires a non-empty rejection reason and blocks approval when it cannot obtain a signed receipt URL. Its nested event, booking, item, ticket-type, and payment-account fields match the current relationships and snapshot columns.

**Database finding remains:** the routine's NULL decision validation bypass is not prevented by the TypeScript union or UI because the RPC is a database boundary. See `WORKFLOW_ROUTINES_AUDIT.md`; no production change was made.

## 4. Admin event save and event-specific accounts

Frontend:
- `features/events/admin/admin-events.service.ts`

Database:
- `public.save_admin_event(uuid, jsonb, jsonb, jsonb)`
- `private.save_admin_event(uuid, jsonb, jsonb, jsonb)`

**Contract match:** frontend sends the exact four public RPC parameters: `p_event_id`, `p_event`, `p_tickets`, and `p_accounts`. The returned UUID is treated as the saved event ID. Event-payment-account fields (`id`, `account_name`, `account_number`, `beneficiary`, `is_active`, `sort_order`) and ticket-type fields align with the table/routine contract. Cover uploads use the public event-covers bucket, caller UUID as first path segment, and `upsert: false`, matching the Storage policy.

## 5. Gatekeeper

Frontend:
- `features/gatekeeper/services/gatekeeper.service.ts`
- `features/gatekeeper/hooks/useGatekeeper.ts`
- `features/gatekeeper/components/GatekeeperWorkspace.tsx`

Database:
- `public.gatekeeper_ticket_action(text, boolean)`
- `public.gatekeeper_manual_ticket_action(text, boolean)`
- `private.gatekeeper_ticket_action_core(text, boolean)`

**Contract match:** QR/manual frontend calls the two public wrappers with `p_ticket_code` and `p_confirm`. The workspace understands the returned statuses `checked_in`, `used`, `not_found`, and `invalid`; it displays buyer, event, ticket type, attendee count, and ticket code when returned. The wrappers persist scan history; the browser does not call the private core directly.

**Database finding remains:** authenticated currently has EXECUTE on the private core routine even though wrapper calls can invoke it as owner and record scan logs. Direct invocation can bypass wrapper scan logging. See `WORKFLOW_ROUTINES_AUDIT.md`; no ACL was changed.

## 6. Customer ticket display — confirmed legacy/group mismatch

Frontend:
- `features/customer-account/services/customer-account.service.ts`
- `features/customer-account/types.ts`
- `features/customer-account/components/TicketWorkspace.tsx`
- `features/customer-account/utils/ticket-image.ts`

The customer query correctly loads tickets through the caller's booking and joins each ticket to its booking_item quantity. The UI displays that quantity on each ticket card and in the expanded ticket.

**Finding APP-01 — high priority data-display mismatch:** production contains mixed issuance semantics:
- 52 booking items have one group ticket each.
- Three older booking items have 3, 4, and 5 individual ticket rows respectively.
- For each of those older individual ticket rows, `booking_items.quantity` is the total group quantity. The current customer UI therefore displays 3, 4, or 5 people on every individual ticket in that legacy group, overstating the count. The gatekeeper core likewise returns `bi.quantity` for each legacy ticket, so the gatekeeper modal repeats the whole group count for each individual code.

A safe compatibility rule can distinguish the two observed patterns by counting ticket rows per booking_item: if multiple ticket rows exist, each is an individual attendee ticket; if one row exists, it is the group ticket and should display the booking_item quantity. This rule must be implemented and tested without changing or reissuing historical ticket rows.

**Finding APP-02 — downloaded ticket omits attendee count:** the expanded on-screen ticket shows attendee count, but `downloadTicketAsImage()` does not draw it into the saved PNG. The QR image contains only `ticket_code`; the gatekeeper looks up the remaining details from the database. The database's `qr_token` column is not used by the current customer QR component.

The current UI does preserve one QR/manual code per ticket row, which is necessary for the mixed legacy/current dataset. Do not collapse multiple legacy rows into one ticket.

## 7. Push notifications

Frontend:
- `features/customer-account/components/PushNotificationSettings.tsx`

Database:
- `public.sync_haddir_push_subscription(text, jsonb, text)`
- `public.get_haddir_push_config()`

**Contract match:** frontend sends `p_endpoint`, `p_subscription`, and `p_device_label`, matching the sync routine. A read-only boolean comparison confirmed that the VAPID public key hardcoded in the frontend matches the value named `haddir_vapid_public_key` in Vault. No secret value was retrieved or copied. The frontend does not call `get_haddir_push_config()`; that routine returns private key/hook secret material and its EXECUTE ACL remains restricted to postgres/service_role.

## 8. Runtime validation boundary

This review establishes static parameter, return-shape, relationship, path, and UI/data-contract alignment only. It does not test:
- a real browser upload and payment submission,
- a real owner/supervisor review,
- concurrent gatekeeper scans,
- legacy and group ticket scans in the running UI,
- Realtime delivery, push delivery, or background workers.

No app source, production data, production routine, grant, policy, or deployment was changed during this review.


## 9. Additional role/statistics RPCs and Edge Function

Additional frontend/edge sources:
- `features/users/admin/admin-users.service.ts`
- `features/advertiser/services/advertiser.service.ts`
- `features/gatekeeper/services/gatekeeper.service.ts`
- `supabase/functions/send-web-push/index.ts`

**Contract match:**
- `admin_search_profiles`: frontend sends `p_query`, `p_limit`, `p_offset`, and `p_role`; the public wrapper signature and parameter order match.
- `admin_update_profile_role`: frontend sends `p_user_id`, `p_role`, and `p_event_id`; wrapper signature matches.
- `get_advertiser_event_statistics()`: no-argument call matches the public wrapper; frontend expects the JSON event payload.
- `get_gatekeeper_scan_stats(p_event_id)` and `get_gatekeeper_scan_history(p_event_id)`: event parameter names match; the UI types align with the returned JSON object/array.
- The `send-web-push` Edge Function calls `get_haddir_push_config()` using the service-role client, then uses the returned Vault-backed keys server-side. This matches the restricted service_role EXECUTE grant; no browser call to the secret-returning routine was found.

The admin user service builds its event-assignment map by user ID. This is compatible with the observed global UNIQUE(user_id) constraint on event_role_assignments; that global one-assignment rule must remain preserved in a faithful baseline.
