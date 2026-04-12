-- 006_storage.sql
-- Public storage bucket for product images. Authenticated users can
-- upload/update/delete; everyone can read (public bucket).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Authenticated users can upload files
create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Authenticated users can update files
create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

-- Authenticated users can delete files
create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- Everyone can read (public bucket)
create policy "Public read access for product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');
