-- 004_updated_at_trigger.sql
-- Shared trigger that bumps updated_at on every UPDATE. Phase 2
-- attaches it to products only; future tables can reuse the function.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();
