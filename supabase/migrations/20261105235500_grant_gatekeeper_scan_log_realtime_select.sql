-- Realtime postgres_changes requires SELECT privilege in addition to RLS.
-- The existing policy restricts visible rows to events assigned to the signed-in gatekeeper.
grant select on table public.gatekeeper_scan_logs to authenticated;
