-- Make email nullable (optional)
ALTER TABLE public.orders ALTER COLUMN email DROP NOT NULL;

-- Add phone_number and store_address columns (both optional)
ALTER TABLE public.orders ADD COLUMN phone_number text;
ALTER TABLE public.orders ADD COLUMN store_address text;
