# Draft trigger bindings

Contains the **12 distinct application trigger objects** captured from production. The 26 trigger-event rows are not separate trigger objects.

- Trigger functions must be restored and reviewed before these statements.
- Definitions target public application tables and reference functions in `public` / `private`.
- Not tested on PostgreSQL; do not apply to production.

```sql
-- DRAFT ONLY: exact CREATE TRIGGER definitions captured from production catalog.
-- All referenced trigger functions must exist before this file is applied.
-- Not tested. Do not run against production.

CREATE TRIGGER audit_bookings AFTER INSERT OR DELETE OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_event_payment_accounts AFTER INSERT OR DELETE OR UPDATE ON public.event_payment_accounts FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
CREATE TRIGGER audit_events AFTER INSERT OR DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dispatch_haddir_web_push_after_insert AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.dispatch_haddir_web_push();
CREATE TRIGGER audit_payment_submissions AFTER INSERT OR DELETE OR UPDATE ON public.payment_submissions FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
CREATE TRIGGER audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_ticket_types AFTER INSERT OR DELETE OR UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
CREATE TRIGGER ticket_types_set_updated_at BEFORE UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_tickets AFTER INSERT OR DELETE OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity();
```
