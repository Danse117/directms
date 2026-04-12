// lib/data/products.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type Product = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  flavors: string[]
  imagePath: string | null
}

type ProductRow = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number | string
  flavors: string[]
  image_path: string | null
  is_visible: boolean
  sort_order: number
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    // Postgres NUMERIC comes back as a string under @supabase/supabase-js;
    // coerce defensively.
    price: typeof row.price === 'string' ? Number(row.price) : row.price,
    flavors: row.flavors,
    imagePath: row.image_path,
  }
}

/**
 * Public catalog read. Returns visible products in display order.
 */
export async function getVisibleProducts(): Promise<Product[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: ProductRow) => rowToProduct(row))
}

/**
 * Bulk fetch by ID. Used by `placeOrder` to re-fetch every product the
 * client claims to have added — this is the load-bearing read that
 * prevents client-side price tampering.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: ProductRow) => rowToProduct(row))
}

// ============================================================================
// Admin helpers — used in Phase 3, scaffolded here per spec §6.5.
// ============================================================================

/**
 * Single product by ID. Used by admin edit pages.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToProduct(data as ProductRow)
}

/**
 * All products including hidden ones. Used by the admin product list.
 */
export async function getAllProducts(): Promise<Product[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: ProductRow) => rowToProduct(row))
}

export type ProductInput = {
  slug: string
  name: string
  subtitle: string | null
  price: number
  flavors: string[]
  imagePath: string | null
  isVisible: boolean
  sortOrder: number
}

/**
 * Insert a new product. Phase 3 admin form caller.
 */
export async function createProduct(input: ProductInput): Promise<Product> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .insert({
      slug: input.slug,
      name: input.name,
      subtitle: input.subtitle,
      price: input.price,
      flavors: input.flavors,
      image_path: input.imagePath,
      is_visible: input.isVisible,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToProduct(data as ProductRow)
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<Product> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .update({
      slug: input.slug,
      name: input.name,
      subtitle: input.subtitle,
      price: input.price,
      flavors: input.flavors,
      image_path: input.imagePath,
      is_visible: input.isVisible,
      sort_order: input.sortOrder,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToProduct(data as ProductRow)
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function toggleProductVisibility(
  id: string,
  isVisible: boolean
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('products')
    .update({ is_visible: isVisible })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
