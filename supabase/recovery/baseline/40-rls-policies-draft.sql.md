# Draft RLS policies

Reconstructs RLS enablement for the 16 public application tables and all 29 production policies.

- Depends on the application helper routines (especially `private.current_profile_role()`) being created first.
- Assumes the standard Supabase roles `anon` and `authenticated` already exist.
- Not executed or tested. Do not apply to production.

```sql
-- DRAFT ONLY: RLS enablement and policy definitions from production catalog evidence.
-- Requires referenced private helper routines to exist first. Not tested. Do not run on production.

ALTER TABLE public."admin_activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."booking_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."email_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_payment_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."gatekeeper_scan_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ticket_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tickets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform managers read activity log" ON public."admin_activity_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Platform managers manage booking items" ON public."booking_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Platform staff read booking items" ON public."booking_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_items.booking_id) AND (private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text]))))));
CREATE POLICY "Users can read items from their own bookings" ON public."booking_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_items.booking_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Platform managers manage bookings" ON public."bookings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Platform staff read all bookings" ON public."bookings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])));
CREATE POLICY "Users can read their own bookings" ON public."bookings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Platform managers read checkins" ON public."checkins" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Active event accounts are visible for published events" ON public."event_payment_accounts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((is_active AND (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_payment_accounts.event_id) AND (e.status = 'published'::text))))));
CREATE POLICY "Platform admins manage event payment accounts" ON public."event_payment_accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Users read own event role assignments" ON public."event_role_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR (private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))));
CREATE POLICY "Assigned staff can read assigned events" ON public."events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM event_role_assignments a
  WHERE ((a.user_id = ( SELECT auth.uid() AS uid)) AND (a.event_id = events.id) AND (a.assignment_role = ANY (ARRAY['gatekeeper'::text, 'advertiser'::text]))))));
CREATE POLICY "Platform managers manage events" ON public."events" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Published events are visible to everyone" ON public."events" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((status = 'published'::text));
CREATE POLICY "Assigned gatekeepers read event scan updates" ON public."gatekeeper_scan_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM event_role_assignments a
  WHERE ((a.user_id = ( SELECT auth.uid() AS uid)) AND (a.event_id = gatekeeper_scan_logs.event_id) AND (a.assignment_role = ANY (ARRAY['gatekeeper'::text, 'organizer'::text]))))));
CREATE POLICY "Users read own notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users update own notifications" ON public."notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Active payment methods are visible to customers" ON public."payment_methods" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active OR (private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text]))));
CREATE POLICY "Platform admins manage payment methods" ON public."payment_methods" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Platform staff read payment submissions" ON public."payment_submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'supervisor'::text])));
CREATE POLICY "Users can read payment submissions for their own bookings" ON public."payment_submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = payment_submissions.booking_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Platform staff can read profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Users can read own profile and owner can read all" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.current_user_is_owner() AS current_user_is_owner)));
CREATE POLICY "Users can update their own basic profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Users manage own push subscriptions" ON public."push_subscriptions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Active ticket types for published events are visible" ON public."ticket_types" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = ticket_types.event_id) AND (e.status = 'published'::text))))));
CREATE POLICY "Platform managers manage ticket types" ON public."ticket_types" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Platform managers read tickets" ON public."tickets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.current_profile_role() = ANY (ARRAY['owner'::text, 'admin'::text])));
CREATE POLICY "Users can read their own tickets" ON public."tickets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = tickets.booking_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));
```
