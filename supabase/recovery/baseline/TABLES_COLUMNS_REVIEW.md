# Table and column integrity review

**Status: read-only production review / documentation only. No schema or data changes.**

Project: `puhmvcekxkcxfdvgygpk` (`haddir`)  
Review date: 2026-11-14  
Scope: all 16 public application tables, 158 columns, constraints, defaults, nullability, and cross-table consistency relevant to events, bookings, payments, inventory, and tickets.

## Evidence and method

The review used read-only PostgreSQL catalog queries against `information_schema.columns`, `pg_constraint`, and live row-level aggregate checks. The existing `20-tables-draft.sql.md` was inspected as a reconstruction artifact. No DDL/DML, migrations, storage changes, or deployment actions were performed.

## Inventory

- 16 public application tables / 158 columns.
- Column types, nullability, defaults, numeric precision, and fixed-width currency fields were read from production.
- 81 constraints were enumerated from `pg_constraint`.
- Current production row counts at review time: 11 events, 20 ticket types, 61 bookings, 61 booking items, 57 payment submissions, 64 tickets, and 21 profiles. These are a point-in-time snapshot, not expected seed data.

## Positive integrity checks

The following read-only checks returned zero violations in the current data:

- Orphan booking items, tickets, payment submissions, ticket types, or bookings against their referenced parent rows.
- Ticket-to-booking, ticket-to-booking-item, ticket-to-ticket-type, and ticket-to-event mismatches across the corresponding rows.
- Booking-item ticket type belonging to a different event than its booking.
- Payment submission amount differing from its booking subtotal.
- Valid tickets attached to bookings not in the confirmed state.
- Negative booking totals, payment amounts, ticket prices, inventory counts, or platform fee percentages.
- Booking item line totals differing from quantity multiplied by unit price.

These are current-data checks only. They do not prove that every invalid state is prevented by database constraints in all future writes.

## Booking, payment, and ticket semantics

### Booking creation

The production `public.create_booking(uuid, uuid, integer)` routine:
- requires an authenticated user;
- limits requested quantity to 1–5;
- locks the ticket type and checks event publication, sales window, profile completeness, and available inventory;
- creates a booking and one booking-item row containing the requested quantity;
- increments `ticket_types.quantity_sold` by that quantity.

The table design supports a nullable `bookings.user_id` and `customer_email`, while this current booking routine requires authentication. The nullable fields therefore remain part of the observed production schema and may support historical/deletion cases; do not tighten them without a separate compatibility review.

### Payment submission

The production `public.submit_payment(...)` routine links a submission to the booking and an event-specific active payment account. It snapshots account name, number, and beneficiary into `payment_submissions`, along with amount and currency. The table intentionally has no observed FK from the text `payment_account_id` to `event_payment_accounts.id`; the snapshot columns preserve the details used at submission time. Do not add an FK or remove snapshot fields without a retention and deletion-semantics decision.

Current data checks found 57 payment submissions, no missing receipt paths, no missing event-account IDs, and no amount/subtotal mismatches.

### Ticket issuance: group-ticket semantics

The current production `public.review_payment_submission(...)` definition inserts one ticket per `booking_items` row, not one ticket per unit in `booking_items.quantity`. It separately calculates the attendee count by summing the item quantities.

Current data is consistent with this group-ticket model:
- 64 confirmed booking-item rows;
- 175 total attendee units across those rows;
- 64 issued tickets;
- 27 confirmed booking items have quantity greater than their ticket-row count (one ticket for a multi-attendee booking item).

This is **not classified as a data-integrity defect by itself**: it matches the current routine's one-ticket-per-booking-item behavior and the restored group-ticket semantics. It is a product/entry-flow contract that must remain explicit. The ticket UI and gatekeeper flow must clearly represent the attendee count covered by a group ticket. If the intended product rule changes to one QR ticket per attendee, that requires a separately designed migration and issuance/reconciliation plan; do not silently change the baseline to imply attendee-level ticket rows.

## Schema design observations requiring explicit decisions

1. **Global event-role uniqueness:** `event_role_assignments` has a composite primary key `(user_id, event_id, assignment_role)` and also a separate `UNIQUE(user_id)`. The latter limits each user to one event-role assignment across the entire platform, despite the table's event-scoped shape. Preserve it in the reconstruction for fidelity, but confirm whether it is intended before any future schema redesign.
2. **Optional inventory ceiling:** `ticket_types.quantity_total` is nullable. The check constraints allow NULL, and `create_booking` treats NULL as no finite inventory ceiling. This is a deliberate unlimited-inventory mode in the current routine/schema pairing.
3. **Event start time:** `events.starts_at` is nullable; two current event rows have no start time. The current booking routine allows a missing start only for continuous events. Keep the nullable column and validate the continuous-event rule in the event save path.
4. **Line-total arithmetic:** the current rows all satisfy `line_total = quantity * unit_price`, but no observed CHECK constraint enforces that arithmetic. The current creation routine writes consistent values. Future write paths must preserve this invariant, or a separately reviewed constraint can be considered after checking rounding and legacy data.
5. **Cross-column/cross-table ticket identity:** individual FKs ensure that ticket references exist, but they do not by themselves enforce that `tickets.booking_id`, `booking_item_id`, `ticket_type_id`, and `event_id` all describe the same booking/event relationship. Current cross-table checks found no mismatches. The application routines currently carry this responsibility; any future stronger composite constraints require a deliberate design.
6. **Payment account identifiers:** `event_payment_accounts.id` is stored as text with a UUID-string default, and `payment_submissions.payment_account_id` is text. Preserve exact types in a faithful baseline; do not normalize to UUID during recovery.
7. **Legacy/global payment methods:** `payment_methods` coexists with `event_payment_accounts`. Current payment submission logic uses event-specific accounts. Do not remove the legacy table as part of historical recovery without confirming all frontend/admin references and data-retention needs.
8. **Role values and event assignments:** profile roles and event assignment roles are text constrained by CHECK lists, not PostgreSQL enums. Preserve the exact allowed values and their distinctions.

## Nullability/default interpretation

Nullable columns are not automatically defects. Examples include optional event descriptions/locations/times, optional review metadata, optional receipt-related notes, and nullable user references preserved by `ON DELETE SET NULL`. Likewise, defaults such as `gen_random_uuid()`, `now()`, status defaults, and SDG currency defaults are part of the observed production contract and must be copied exactly into a future candidate baseline.

No columns use identity/generated definitions in the previously recorded production inventory. Numeric money fields use `numeric(12,2)`; platform fee percentage uses `numeric(5,2)`; currency columns use fixed `character(3)`.

## Baseline implications

- Keep `20-tables-draft.sql.md` aligned with the exact production types, defaults, and nullability.
- Preserve all 81 constraints exactly for a fidelity baseline, including constraints that may later be reviewed as business-rule decisions.
- Do not “fix” the global role uniqueness, group-ticket behavior, nullable inventory, text UUID account identifiers, or legacy payment-method table inside the recovery baseline.
- Record possible hardening/redesign separately from historical reconstruction.
- Before any executable candidate exists, review all application write paths and test the candidate on a real PostgreSQL-compatible environment. No such test environment is currently available in this workflow.

## Safety status

- Production queries were read-only.
- No production schema/data was modified.
- No migration was applied or executed.
- Draft SQL remains under `supabase/recovery/baseline/` as Markdown and is not runnable.
- No Vercel deployment or paid Supabase resource was created.
