-- 003_inquiries.sql
-- Product inquiries from the public site. Same INSERT-only RLS pattern
-- as orders.

create table public.inquiries (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  business_name   text,
  email           text not null,
  phone           text,
  requested_item  text not null,
  details         text,
  created_at      timestamptz not null default now()
);

create index inquiries_created_at_idx
  on public.inquiries (created_at desc);

alter table public.inquiries enable row level security;

create policy inquiries_anon_insert
  on public.inquiries
  for insert
  to anon
  with check (true);

create policy inquiries_authenticated_all
  on public.inquiries
  for all
  to authenticated
  using (true)
  with check (true);
