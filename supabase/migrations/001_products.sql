-- 001_products.sql
-- Wholesale catalog table. Public (anon) read is gated to is_visible = true
-- via RLS. Admin (authenticated) is unrestricted.

create extension if not exists pgcrypto;

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  subtitle    text,
  price       numeric(10, 2) not null check (price >= 0),
  flavors     jsonb not null default '[]'::jsonb,
  image_path  text,
  is_visible  boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index products_visible_sort_idx
  on public.products (is_visible, sort_order);

alter table public.products enable row level security;

-- Anonymous: SELECT visible rows only
create policy products_anon_select
  on public.products
  for select
  to anon
  using (is_visible = true);

-- Authenticated (admin): full access
create policy products_authenticated_all
  on public.products
  for all
  to authenticated
  using (true)
  with check (true);
