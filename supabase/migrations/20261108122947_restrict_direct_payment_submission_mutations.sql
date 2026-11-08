drop policy if exists "Platform staff review payment submissions" on public.payment_submissions;

revoke all privileges on table public.payment_submissions from public, anon, authenticated;
grant select on table public.payment_submissions to authenticated;
