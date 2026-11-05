alter table public.events
  add column if not exists platform_fee_percent numeric(5,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_platform_fee_percent_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_platform_fee_percent_check
      check (platform_fee_percent >= 0 and platform_fee_percent <= 100);
  end if;
end $$;
