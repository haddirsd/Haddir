create table if not exists public.legal_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_key text not null check (document_key = 'organizer_terms_bundle'),
  version text not null check (version = '2026-11-15-v1'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_key, version)
);

alter table public.legal_acceptances enable row level security;
revoke all on table public.legal_acceptances from anon, authenticated;
grant select, insert on table public.legal_acceptances to authenticated;

drop policy if exists "Users can read their own legal acceptances" on public.legal_acceptances;
create policy "Users can read their own legal acceptances"
on public.legal_acceptances for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Organizers can accept current legal terms" on public.legal_acceptances;
create policy "Organizers can accept current legal terms"
on public.legal_acceptances for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and document_key = 'organizer_terms_bundle'
  and version = '2026-11-15-v1'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'advertiser'
  )
);

create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when p.role = 'advertiser'
      and not exists (
        select 1
        from public.legal_acceptances a
        where a.user_id = p.id
          and a.document_key = 'organizer_terms_bundle'
          and a.version = '2026-11-15-v1'
      )
    then 'customer'
    else p.role
  end
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1
$function$;

comment on table public.legal_acceptances is
'Versioned records of explicit acceptance of Haddir organizer terms, common terms and privacy policy bundle.';
