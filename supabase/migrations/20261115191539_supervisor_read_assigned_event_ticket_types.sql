-- Supervisors need ticket type labels when reviewing bookings for assigned events.
drop policy if exists "Assigned supervisors read ticket types" on public.ticket_types;
create policy "Assigned supervisors read ticket types"
on public.ticket_types for select to authenticated
using (
  exists (
    select 1
    from public.event_role_assignments a
    where a.user_id=(select auth.uid())
      and a.event_id=ticket_types.event_id
      and a.assignment_role='supervisor'
  )
);
