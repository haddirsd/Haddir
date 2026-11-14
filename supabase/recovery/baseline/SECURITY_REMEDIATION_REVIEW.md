# Haddir security remediation review — first pass

**Status: review only. No code, ACL, schema, data, or production configuration was changed.**
**Target:** `haddirsd/Haddir`, branch `chore/restore-supabase-migration-history`.
**Production project:** `puhmvcekxkcxfdvgygpk`. All database observations below came from read-only catalog queries.

## Executive summary

The four previously noted ACL/logic items do not have equal severity:

| Finding | Current evidence | Assessment | Action |
|---|---|---|---|
| SEC-01 Payment decision NULL bypass | Live `public.review_payment_submission(uuid,text,text)` checks `p_decision NOT IN (...)` without an explicit NULL guard; the final ELSE path rejects | Confirmed logic flaw; high priority | Fix function body with explicit NULL/allow-list guard and defensive branch; add regression tests |
| SEC-02 Direct gatekeeper core EXECUTE | `authenticated` has schema USAGE on `private` and EXECUTE on SECURITY DEFINER core; core changes ticket status without scan-log insert | Excess privilege confirmed. Direct PostgREST reachability depends on whether `private` is exposed in API schemas; not established by catalog query | Revoke authenticated EXECUTE; wrappers already call core under their SECURITY DEFINER owner context. Verify API schema exposure and wrapper behavior |
| SEC-03 Push config function | `get_haddir_push_config()` is executable only by postgres/service_role. Static app review found only the server-side send-web-push Edge Function calls it | Not a vulnerability on current evidence; least-privilege control is correct | No change |
| SEC-04 Trigger helper PUBLIC EXECUTE | `public.set_updated_at()` is invoker-security, returns trigger, and is attached to four BEFORE UPDATE triggers | Overbroad ACL hygiene issue, not evidence of an app-callable data mutation endpoint | Revoke PUBLIC/anon/authenticated/service_role EXECUTE, retain postgres owner; existing triggers should continue because trigger-function EXECUTE is checked when trigger is created, not on each row firing. Verify with a safe test before applying |

## SEC-01 — NULL payment decision

Live function body currently contains:
```sql
if p_decision not in ('approve','reject') then
  raise exception 'قرار المراجعة غير صحيح';
end if;
if p_decision='reject' and nullif(trim(coalesce(p_rejection_reason,'')),'') is null then
  raise exception 'اكتب سبب رفض إثبات الدفع';
end if;
...
if p_decision='approve' then
  -- approve
else
  -- reject
end if;
```

In PL/pgSQL, a NULL condition is not TRUE. Therefore a NULL decision bypasses both checks and falls into ELSE, rejecting the payment without a reason. TypeScript's union/UI validation is not a database security boundary.

**Recommended correction (draft only):**
- First reject `p_decision IS NULL OR p_decision NOT IN ('approve','reject')`.
- Keep mandatory non-empty reason for reject.
- Use explicit `ELSIF p_decision='reject'` and a defensive final ELSE exception.
- Consider requiring booking status `under_review` as a separate state-machine hardening after checking any legitimate recovery/admin flows.
- Preserve the current authorization check, row locks, advisory lock, stock release, ticket creation, notification behavior and transaction semantics.

Regression cases: NULL, empty string, arbitrary string, approve, reject with NULL/blank reason, reject with reason, repeat review, booking state mismatch. NULL/invalid requests must raise before any payment, booking, inventory, ticket, or notification mutation.

## SEC-02 — gatekeeper private core

Live ACL evidence:
- `authenticated` has USAGE on schema `private`.
- `authenticated` has EXECUTE on `private.gatekeeper_ticket_action_core(text,boolean)`.
- Function is SECURITY DEFINER, postgres-owned, and has explicit empty search_path.
- Function checks signed-in identity, profile role, and event assignment, then can mark a valid ticket used and notify its owner.
- It does not insert `gatekeeper_scan_logs`.
- Both public QR/manual wrappers are SECURITY INVOKER and delegate to private SECURITY DEFINER wrappers; those private wrappers call the core and insert scan logs.
- The app source calls the public wrappers; no direct app call to the core was found.

The historical migration explicitly revokes and then re-grants authenticated EXECUTE on the core, and separately grants private schema USAGE for wrapper access. Thus the grant is deliberate in repository history, but not required by the wrapper call chain: the private SECURITY DEFINER wrapper executes the core as its owner.

**Recommended correction (draft only):**
- Revoke EXECUTE from PUBLIC, anon, authenticated on the core; retain postgres ownership/execute.
- Do not revoke authenticated USAGE on private as a broad fix: the intended invoker public wrappers call private SECURITY DEFINER wrappers and currently rely on private schema access.
- Confirm whether `private` is included in PostgREST exposed schemas. The database catalog query cannot establish the active API schema allow-list. If it is not exposed, direct REST/RPC reachability is blocked there, but the SQL privilege is still unnecessary and should be removed.
- Regression: assigned gatekeeper can preview and confirm through QR/manual public wrappers and each attempt is logged; authenticated direct core invocation is denied; unrelated roles remain denied.

## SEC-03 — push configuration

Live ACL is postgres + service_role only. The routine returns private VAPID and hook secrets from Vault. Static source review found the only caller in `supabase/functions/send-web-push/index.ts`, using the service-role client server-side. The function validates the hook secret before processing push requests. No browser caller was found.

**Decision:** preserve current restricted ACL. Do not grant authenticated or anon access. Do not retrieve or copy secret values into this report.

## SEC-04 — set_updated_at trigger function

Live routine is invoker-security, postgres-owned, with empty search_path. EXECUTE is currently granted to PUBLIC (therefore inherited by anon/authenticated) and explicitly to anon/authenticated/service_role. It is attached to four triggers:
- `public.bookings`
- `public.events`
- `public.profiles`
- `public.ticket_types`

It only sets `NEW.updated_at = pg_catalog.now()` and returns NEW. Its trigger return type means it is not a normal RPC callable by the browser. Broad EXECUTE is unnecessary for the app; trigger execution privileges are checked at CREATE TRIGGER time.

**Recommended correction (draft only):**
- Revoke EXECUTE from PUBLIC, anon, authenticated, service_role; leave owner/postgres access.
- Verify existing trigger behavior in an isolated PostgreSQL test after revocation and ensure no app code attempts to call it as RPC.
- Future trigger creation should be performed by the owning migration role.

## Scope and caveats

- Read-only production catalog review only; no exploit/pentest attempt was performed.
- No production SQL, grants, policies, data, Vault values, Edge Function secrets, or project settings were changed.
- `private` PostgREST exposure setting was not available from the inspected PostgreSQL catalog; verify it in the Supabase API settings before claiming direct HTTP/RPC exploitability.
- No full browser/device integration test was performed.
- This report does not authorize applying any remediation to production.
