create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','organizer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  category text,
  venue text,
  city text,
  address text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_dates check (ends_at is null or ends_at > starts_at)
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency char(3) not null default 'SDG',
  quantity_total integer not null check (quantity_total >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0 and quantity_sold <= quantity_total),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  event_id uuid not null references public.events(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  currency char(3) not null default 'SDG',
  status text not null default 'pending_payment'
    check (status in ('pending_payment','under_review','confirmed','rejected','cancelled','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  transfer_reference text,
  receipt_path text,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'SDG',
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  booking_item_id uuid not null references public.booking_items(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  ticket_code text not null unique,
  qr_token uuid not null unique default gen_random_uuid(),
  attendee_name text,
  status text not null default 'valid' check (status in ('valid','used','cancelled')),
  issued_at timestamptz not null default now(),
  used_at timestamptz
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  checked_in_by uuid references auth.users(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  gate_name text
);

create index events_public_listing_idx on public.events (starts_at) where status = 'published';
create index ticket_types_event_idx on public.ticket_types (event_id, is_active);
create index bookings_user_idx on public.bookings (user_id, created_at desc);
create index bookings_event_idx on public.bookings (event_id, status);
create index payment_submissions_booking_idx on public.payment_submissions (booking_id, created_at desc);
create index tickets_event_status_idx on public.tickets (event_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger ticket_types_set_updated_at before update on public.ticket_types
for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.tickets enable row level security;
alter table public.checkins enable row level security;

create policy "Published events are visible to everyone"
on public.events for select to anon, authenticated
using (status = 'published');

create policy "Active ticket types for published events are visible"
on public.ticket_types for select to anon, authenticated
using (is_active = true and exists (
  select 1 from public.events e where e.id = event_id and e.status = 'published'
));

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own basic profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'customer');

create policy "Users can read their own bookings"
on public.bookings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read items from their own bookings"
on public.booking_items for select to authenticated
using (exists (
  select 1 from public.bookings b
  where b.id = booking_id and b.user_id = (select auth.uid())
));

create policy "Users can read payment submissions for their own bookings"
on public.payment_submissions for select to authenticated
using (exists (
  select 1 from public.bookings b
  where b.id = booking_id and b.user_id = (select auth.uid())
));

create policy "Users can read their own tickets"
on public.tickets for select to authenticated
using (exists (
  select 1 from public.bookings b
  where b.id = booking_id and b.user_id = (select auth.uid())
));

grant select on public.events, public.ticket_types to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.bookings, public.booking_items, public.payment_submissions, public.tickets to authenticated;
grant all on public.profiles, public.events, public.ticket_types, public.bookings, public.booking_items, public.payment_submissions, public.tickets, public.checkins to service_role;