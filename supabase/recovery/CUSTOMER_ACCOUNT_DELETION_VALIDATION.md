# Customer account deletion hardening

## Change summary

- Moves PostgreSQL cleanup into one SECURITY DEFINER RPC transaction.
- Persists receipt object paths in a private retry queue before anonymizing booking/payment rows.
- Removes Storage objects only after the DB transaction succeeds.
- Keeps the queue if Storage removal fails so a retry can finish without losing the paths.
- Keeps the durable cleanup marker until the Auth Admin API confirms hard deletion.
- After Auth deletion, the cleanup row is converted into an empty-path tombstone. It blocks writes from stale access JWTs; it is intentionally retained.
- Uses the same transaction advisory lock as booking creation; booking/payment triggers enforce the pending-deletion write barrier.
- Restricts cleanup RPCs to service_role; anon and authenticated cannot execute them.
- Rechecks staff/event assignments and upcoming confirmed bookings inside the database transaction.

## Disposable PostgreSQL 17 validation

The migration was applied only to the free disposable Supabase project `adbpeojpscwnsombisif`. No production objects or data were changed.

Checks that passed:
- Migration and function definitions applied successfully.
- Customer booking identity and payment submitter/receipt path were anonymized.
- Receipt object path persisted in the cleanup queue.
- Repeated prepare calls preserve queued paths for retry.
- New booking writes were rejected while deletion was pending.
- New payment submission writes were rejected while deletion was pending.
- Cleanup queue remained present after the database cleanup.
- Final cleanup RPC cleared receipt paths but retained an empty-path tombstone to block stale access JWTs.
- Admin-role account was rejected.
- Customer with a confirmed upcoming event was rejected; its booking remained linked.
- Function ACL assertions: anon=false, authenticated=false, service_role=true for both cleanup RPCs.

## Disposable Edge Function deployment

- Updated `delete-customer-account` Edge Function deployed successfully to the disposable project.
- Function is ACTIVE and `verify_jwt=true`.
- This confirms deployment/packaging only; it is not an end-to-end HTTP/Auth/Storage test.

## Disposable HTTP/Auth/Storage end-to-end validation

GitHub Actions run [43715225161](https://github.com/haddirsd/Haddir/actions/runs/43715225161) completed successfully against the free disposable Supabase project. It created a disposable Auth user, seeded a customer profile and pending booking/payment, obtained a real password-login JWT, uploaded a real private Storage receipt, invoked the deployed Edge Function over HTTPS, and verified:

- Auth Admin API no longer finds the user.
- Booking remains but customer identity fields are anonymized.
- Payment submission remains but submitter and receipt path are cleared.
- The physical receipt object is absent from Storage.
- The empty-path deletion tombstone remains.
- The pre-deletion JWT cannot create a new booking.

All 14 assertions passed. This is an actual HTTP/Auth/Edge Function/Storage end-to-end test on the disposable project, not production.

## Migration-history audit status

The read-only comparison against production records 64 ledger entries and the branch has 51 active SQL migration files. The audit identifies 21 exact version/name matches, 21 same-name timestamp mismatches (13 byte-identical SQL payloads and 8 comment/formatting-only differences after normalization), and 22 production entries without same-name active migration files. Fifteen early SQL payloads were recovered verbatim from the production ledger and verified 15/15. Seven historical GitHub files remain candidate mappings, not proven production originals. Eight repository files without same-name ledger entries were individually classified; unresolved provenance remains for the payment-methods DDL, platform-fee DDL, and part of the advertiser-statistics wrapper history. The evidence reports are in `supabase/recovery/baseline/` on branch `chore/restore-supabase-migration-history`.

The forensic comparison is complete for the sources inspected, but it does not recreate missing original Git history or prove every historical mapping. Do not replay historical SQL or apply any production migration on the basis of this report.

## Remaining limitations

- A forced Storage-provider failure/retry was not simulated in the HTTP test.
- The browser account-deletion dialog was not exercised.
- Production Auth, Storage, database, and Edge Function state was not changed.

## Rollout restrictions

This remains a review branch. Do not apply the migration to production, deploy the Edge Function to production, or merge until the remaining HTTP/Auth/Storage tests and migration-history reconciliation are complete.
