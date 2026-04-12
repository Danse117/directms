// lib/supabase/storage.ts

/**
 * Construct the public URL for a product image stored in Supabase Storage.
 * Uses NEXT_PUBLIC_ env vars so it works in both server and client contexts.
 */
export function getProductImageUrl(imagePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`
}
