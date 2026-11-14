# Recovered historical migration SQL (archive only)

These files are preserved verbatim from historical GitHub commits. They are **not an active Supabase migration directory** and must not be moved into `supabase/migrations` or replayed on production without a separate review.

## Candidate mappings to the production ledger

The mapping below is based on migration intent/name and commit history. It does **not** prove byte-for-byte equivalence with the SQL that was applied to production. The live schema and exact historical SQL still need comparison.

| Production ledger entry | Historical repository file preserved here | Source commit |
|---|---|---|
| `20261105070931_event_role_assignments_and_scoped_roles` | `20261105120000_event_role_assignments.sql` | [d5bd6944](https://github.com/haddirsd/Haddir/commit/d5bd6944e744e1a2bacd3f827732a8a1457fa8e6) |
| `20261105071103_limit_role_assignment_to_active_event_states` | `20261105133000_limit_role_assignment_event_states.sql` | [d5bd6944](https://github.com/haddirsd/Haddir/commit/d5bd6944e744e1a2bacd3f827732a8a1457fa8e6) |
| `20261105073706_drop_legacy_admin_update_profile_role_overload` | `20261105150000_drop_legacy_admin_update_profile_role.sql` | [d5bd6944](https://github.com/haddirsd/Haddir/commit/d5bd6944e744e1a2bacd3f827732a8a1457fa8e6) |
| `20261108124015_issue_one_ticket_per_attendee_on_payment_approval` | `20261108124500_issue_one_ticket_per_attendee_on_payment_approval.sql` | [c6bc5b8f](https://github.com/haddirsd/Haddir/commit/c6bc5b8fc288d56778423f797acf725c63a685b4) |
| `20261108124142_restore_booking_item_ticket_issue_semantics` | `20261108130000_restore_group_ticket_issue_semantics.sql` | [9f0932b5](https://github.com/haddirsd/Haddir/commit/9f0932b5c3e37338670fa44341463c62fa664d69) |
| `20261110123134_haddir_admin_user_role_filter` | `20261110143000_filter_admin_users_by_role.sql` | [b7ab0f52](https://github.com/haddirsd/Haddir/commit/b7ab0f526a9553ec93da560b71f93d99fad3d0ab) |
| `20261114101634_sync_haddir_push_subscription` | `20261114010000_sync_push_subscription_owner.sql` | [5d36681b](https://github.com/haddirsd/Haddir/commit/5d36681bde1d9bb5aa27258311fe747b2547313d) |

## Provenance

Each archived file was fetched from the named historical commit, then committed unchanged into this archive. The source blob SHA is recorded in the recovery work log / commit history. No SQL in this directory has been executed.

## Remaining gap

The other 15 entries from 2026-11-02 and early 2026-11-03 have no SQL source in the GitHub `supabase/migrations` path history inspected so far. Do not fabricate their contents. Recover them only from an external backup, archived deployment artifact, or a verified schema/DDL reconstruction clearly labelled as a baseline rather than historical migration SQL.

## Next verification required

1. Compare each archived candidate against the corresponding production object definitions and constraints.
2. Confirm the migration ledger version/name mapping from the read-only production ledger.
3. Reconcile duplicate/renamed migrations and timestamp drift.
4. Build a separate, verified bootstrap baseline only after complete catalog extraction.
5. Validate in a free local PostgreSQL environment before considering a merge.

Production has not been modified. These archived files are for forensic recovery only.

## Read-only comparison with production (2026-11-14)

The following final-state checks were made against the live catalog; no DDL was run:

- `private.admin_search_profiles(text, integer, integer, text)` has a body matching the archived role-filter migration.
- `public.sync_haddir_push_subscription(text, jsonb, text)` has a body matching the archived push-subscription migration.
- The live `public.review_payment_submission(uuid, text, text)` body matches the later restored group-ticket semantics, not the earlier per-attendee version. The earlier script is therefore historical/intermediate and must not be treated as the final implementation.
- The legacy two-argument public `admin_update_profile_role(uuid,text)` overload is absent. The public three-argument function is a wrapper around a hardened private implementation.
- The live `event_role_assignments` table has an additional `UNIQUE(user_id)` constraint, and its current policy set differs from the archived initial migration. The live private role-update function also contains later hardening (owner-only admin promotion and active-event-state checks).

These comparisons confirm useful provenance and final-state relationships, but they also prove that at least the role-assignment archive is not a complete representation of the final production DDL. Keep all archived files non-runnable until a full object-by-object reconciliation is complete.
