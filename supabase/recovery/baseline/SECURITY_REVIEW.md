# Routine security and execution review

Read-only review of all 32 Haddir routines in `public` and `private`.

## Verified production properties

- All 32 routines are owned by `postgres`.
- All 32 have an explicit empty `search_path` setting (`search_path=""`).
- All 17 routines in `private` are `SECURITY DEFINER` (17 of 17).
- Public routines include both invoker and definer execution; the following public routines were observed as `SECURITY DEFINER`: `create_booking`, `get_gatekeeper_manual_history`, `get_haddir_push_config`, `review_payment_submission`, `submit_payment`, and `sync_haddir_push_subscription`.
- EXECUTE ACLs are intentionally not uniform. Some private worker/trigger routines are postgres-only; selected private RPC/helper routines grant authenticated execution; selected public RPCs grant authenticated and service_role execution. `set_updated_at()` currently grants EXECUTE to PUBLIC (plus explicit Supabase roles).

## Implications for a reconstructed baseline

1. Preserve `SECURITY DEFINER` vs `SECURITY INVOKER` exactly; never blanket-enable definer execution.
2. Preserve the empty search path and verify that routine bodies schema-qualify referenced objects and functions.
3. Reapply per-routine EXECUTE grants only after roles exist. Do not issue a blanket `GRANT EXECUTE ON ALL FUNCTIONS`.
4. Keep private worker/trigger functions inaccessible to application roles unless the production ACL explicitly grants access.
5. Review every definer routine body for safe authorization checks and fully qualified object references before approving execution.

The live function definitions and ACL evidence are in `../production-catalog/functions-and-grants.json`; this note contains no secret values. This is a security review, not executable SQL. Production was queried read-only.


## Fresh live-production reconciliation — 2026-11-14

A direct read-only comparison against the active production catalog confirmed:

- All 32 captured routine signatures and definitions match exactly.
- All 32 are owned by postgres and use the language recorded in the draft.
- All 32 have the explicit empty search_path setting.
- 23 are SECURITY DEFINER: all 17 private routines and six public routines. The remaining nine public routines are invoker-security.
- All 32 routine revocation statements and all 41 explicit EXECUTE grant entries in the privilege draft match the live per-signature ACLs; the live ACL contains 32 owner entries plus those 41 grantee entries.
- public.get_haddir_push_config() is executable by service_role (and owner postgres) only; no PUBLIC, anon, or authenticated EXECUTE grant exists.
- public.set_updated_at() is the exception: EXECUTE is granted to PUBLIC and explicitly to anon, authenticated, and service_role, as well as the owner.
- private.gatekeeper_ticket_action_core(text, boolean) has EXECUTE granted to authenticated in production. This remains a high-priority security finding because direct invocation can bypass wrapper scan logging. It was recorded faithfully, not remediated.

This is catalog/source reconciliation, not a runtime penetration test or a recommendation to preserve risky grants in a hardened future system.

