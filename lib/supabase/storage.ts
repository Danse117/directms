// lib/supabase/storage.ts

/**
 * Construct the public URL for a product image stored in Supabase Storage.
 * Uses NEXT_PUBLIC_ env vars so it works in both server and client contexts.
 */
export function getProductImageUrl(imagePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Strip leading slash to avoid double-slash in URL (seed data uses /products/..., uploads use products/...)
  const cleanPath = imagePath.replace(/^\/+/, '')
  return `${supabaseUrl}/storage/v1/object/public/product-images/${cleanPath}`
}
