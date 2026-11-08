-- Remove unused direct profile table capabilities. New profiles are created by
-- the SECURITY DEFINER auth.users trigger; profile edits remain row-scoped and
-- the role column remains separately protected.
revoke all privileges on table public.profiles from anon;
revoke insert, delete, truncate, references, trigger
on table public.profiles from authenticated;
