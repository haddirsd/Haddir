revoke all on function private.save_admin_event(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function private.save_admin_event(uuid,jsonb,jsonb,jsonb) to authenticated;
