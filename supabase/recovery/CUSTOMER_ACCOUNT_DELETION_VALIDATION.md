# Customer account deletion hardening

## Change summary

- Moves all PostgreSQL cleanup into one SECURITY DEFINER RPC transaction.
- Persists receipt object paths in a private retry queue before anonymizing booking/payment rows.
- Removes Storage objects only after the DB transaction succeeds.
- Keeps the queue if Storage removal fails so a retry can finish without losing the paths.
- Deletes the Auth user only after the database cleanup and Storage removal succeed.
- Restricts both RPCs to `service_role`; `anon` and `authenticated` cannot execute them.
- Rechecks staff/event assignments and upcoming confirmed bookings inside the database transaction.

## Disposable PostgreSQL validation

Applied `20261115120000_atomic_customer_account_deletion.sql` only to the free disposable Supabase project `haddir-auth-postgrest-http` after creating minimal fixture tables. No production objects or data were changed.

Observed checks:

- Migration applied successfully on PostgreSQL 17.
- A customer with an expired booking returned the receipt path and had booking identity anonymized.
- A second call returned the same persisted receipt path, proving retry retains the cleanup work item after the first DB transaction.
- Personal notifications, Push subscriptions, and email outbox rows were removed by the transaction.
- Payment submitter and receipt path were cleared; booking customer name/email/phone were anonymized while the booking remained.
- Completing cleanup removed the durable retry row.
- Admin-role account was rejected.
- Customer with a confirmed upcoming event was rejected; its booking remained linked.
- Function ACL assertions: anon=false, authenticated=false, service_role=true for both RPCs.

## Not yet validated

- Full Edge Function execution against a disposable Auth user and Storage bucket.
- Actual Storage object deletion failure/retry through the Edge Function.
- Auth hard-delete and session behavior through the live Auth Admin API.
- End-to-end browser UI behavior after successful deletion.

## Rollout restrictions

This is a review branch only. Do not apply the migration to production, deploy the Edge Function, or merge until the remaining disposable Edge Function/Auth/Storage tests pass and the migration history reconciliation is complete.
