# Constraints and indexes review

Status: **read-only production catalog audit; documentation only; no DDL changes**.

Reviewed against the live production catalog on 2026-11-14. The SQL reconstruction remains a Markdown draft and has not been executed.

## 1. Inventory reconciliation

| Object | Production catalog | Draft file | Result |
|---|---:|---:|---|
| Constraints | 81 | 81 | Count matches |
| Primary keys | 16 | 16 | Count matches |
| Unique constraints | 8 | 8 | Count matches |
| Foreign keys | 32 | 32 | Count matches |
| Check constraints | 25 | 25 | Count matches |
| Total indexes | 57 | — | Catalog count |
| Constraint-backed indexes | 24 | Excluded from standalone section | Correct separation |
| Standalone indexes | 33 | 33 | Count matches |

Constraint type totals were read directly from `pg_constraint`: 16 primary-key constraints, 8 unique constraints, 32 foreign keys, and 25 check constraints. All 81 are currently validated. None is deferrable or initially deferred.

The 57 indexes comprise 16 primary-key indexes, 12 additional unique indexes, and 29 non-unique indexes. The 33 standalone index definitions in the draft include 29 non-unique and four unique indexes. The remaining 24 indexes are created by the primary-key/unique constraints. This avoids duplicating constraint-backed index creation, except for the explicitly noted duplicate below.

The draft's statement counts were independently checked: 81 `ADD CONSTRAINT` statements, split 16/8/32/25, plus 33 standalone `CREATE INDEX` statements.

## 2. Duplicate unique index

Production contains two valid, ready, full (non-partial) unique B-tree indexes on the same `public.tickets(ticket_code)` key:

- `tickets_ticket_code_key` — backing index for the `tickets_ticket_code_key` UNIQUE constraint.
- `tickets_ticket_code_unique` — standalone unique index with the same key and no predicate.

The two indexes enforce the same uniqueness rule. The standalone index appears redundant and adds write/storage overhead. It is retained in the recovery draft because the goal is to reproduce the observed production catalog, not silently alter it. Any decision to remove it must be a separate, reviewed production change after checking dependencies and workload.

## 3. Foreign-key index coverage

32 foreign keys were checked for a valid, ready index whose leading key columns match the FK columns. 30 have leading-index coverage; two do not:

| Foreign key | Child column | Delete action | Current coverage |
|---|---|---|---|
| `email_outbox_booking_id_fkey` | `email_outbox.booking_id` | SET NULL | No leading index |
| `email_outbox_recipient_user_id_fkey` | `email_outbox.recipient_user_id` | CASCADE | No leading index |

The absence of these indexes is not a correctness failure and does not invalidate the constraints. It can, however, make joins and referenced-row deletes/updates scan `email_outbox` as the table grows. Consider the actual outbox volume and query/delete workload before proposing indexes. Do not add them to the reproduction baseline unless the explicit goal changes from exact reconstruction to performance hardening.

## 4. Business-rule constraint requiring confirmation

`event_role_assignments_one_event_per_user` is a UNIQUE constraint on `user_id` alone. The table also has a composite primary key on `(user_id, event_id, assignment_role)`.

The separate UNIQUE constraint means one user can have at most one event-role assignment row in total, even though the primary key itself would permit multiple events or roles for the same user. Its name suggests this may be intentional, but it is a materially stronger rule than the composite key. Confirm whether staff should be assignable to multiple events before any future schema redesign. Preserve it in an exact baseline unless a separate approved product/schema decision changes it.

## 5. Other integrity observations

- Every current FK is validated; no NOT VALID foreign key was observed.
- Every current index is valid and ready; no unhealthy index was observed.
- Foreign-key delete actions must be preserved exactly. The current catalog includes CASCADE, RESTRICT, and SET NULL behaviors; do not normalize them.
- Check constraints encode business-critical bounds and state sets, including ticket inventory (`0 <= quantity_sold <= quantity_total`), non-negative prices/totals/fees, fee percent bounds, event date ordering, booking/payment/ticket states, push subscription shape, and role values.
- The ticket inventory check protects the stored range, while the atomic booking routine is still responsible for concurrency-safe stock allocation. A CHECK constraint alone does not replace row locking/atomic booking logic.

## 6. Reconstruction decision

Keep all 81 constraints and all 33 standalone indexes in the evidence-backed draft, including the observed redundant unique index, so the baseline represents production rather than a silently optimized variant.

Record the two missing FK-supporting indexes, duplicate unique index, and global one-assignment-per-user rule as separate review items. Do not change production or execute SQL as part of this recovery.

## Safety statement

All queries were catalog reads only. No table, constraint, index, row, policy, or production setting was changed. No migration was executed, no paid Supabase resource was created, no Vercel deployment was triggered, and `main` was not modified. No PostgreSQL execution test has occurred.
