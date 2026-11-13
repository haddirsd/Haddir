# Supabase project sources

Project: `haddir` (`puhmvcekxkcxfdvgygpk`).

## Edge Functions

The source files in `functions/` are snapshots of the active Edge Functions retrieved from Supabase. GitHub edits to these files do not deploy or change the live functions.

- `send-booking-email` — JWT verification enabled.
- `send-web-push` — gateway JWT verification disabled; the function validates its private hook secret.
- `delete-customer-account` — JWT verification enabled.

## Migrations

The active Supabase project has an applied migration history, but its corresponding SQL migration files are not currently present in this repository. Migration names alone are not sufficient to recreate safe files, particularly where RLS policies, triggers, RPC functions, and storage policies are involved. Recover the original SQL history or pull a verified schema baseline before adding or applying migrations.

No database schema or live Edge Function was changed as part of this source-organization work.
