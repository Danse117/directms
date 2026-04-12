-- 002_orders.sql
-- Customer orders. Anonymous role can INSERT only — never SELECT,
-- so the public site cannot read other people's orders. The Server
-- Action returns the new order_number from the INSERT ... RETURNING
-- clause, which works under INSERT-only RLS because RETURNING is part
-- of the same statement.

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text not null unique,
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  notes         text,
  items         jsonb not null,
  subtotal      numeric(10, 2) not null check (subtotal >= 0),
  status        text not null default 'pending'
                 check (status in ('pending', 'fulfilled')),
  created_at    timestamptz not null default now(),
  fulfilled_at  timestamptz
);

create index orders_created_at_idx
  on public.orders (created_at desc);

create index orders_status_idx
  on public.orders (status);

alter table public.orders enable row level security;

-- Anonymous: INSERT only, no SELECT
create policy orders_anon_insert
  on public.orders
  for insert
  to anon
  with check (true);

-- Authenticated (admin): full access
create policy orders_authenticated_all
  on public.orders
  for all
  to authenticated
  using (true)
  with check (true);
