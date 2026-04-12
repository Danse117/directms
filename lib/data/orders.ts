// lib/data/orders.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type OrderItemSnapshot = {
  product_id: string
  product_name: string
  flavor: string
  quantity: number
  unit_price: number
  line_total: number
}

export type Order = {
  id: string
  orderNumber: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  storeAddress: string | null
  notes: string | null
  items: OrderItemSnapshot[]
  subtotal: number
  status: 'pending' | 'fulfilled'
  createdAt: string
  fulfilledAt: string | null
}

type OrderRow = {
  id: string
  order_number: string
  first_name: string
  last_name: string
  email: string | null
  phone_number: string | null
  store_address: string | null
  notes: string | null
  items: OrderItemSnapshot[]
  subtotal: number | string
  status: 'pending' | 'fulfilled'
  created_at: string
  fulfilled_at: string | null
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone_number,
    storeAddress: row.store_address,
    notes: row.notes,
    items: row.items,
    subtotal:
      typeof row.subtotal === 'string' ? Number(row.subtotal) : row.subtotal,
    status: row.status,
    createdAt: row.created_at,
    fulfilledAt: row.fulfilled_at,
  }
}

export type CreateOrderInput = {
  orderNumber: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  storeAddress: string | null
  notes: string | null
  items: OrderItemSnapshot[]
  subtotal: number
}

/**
 * Public-facing insert. Anonymous role can INSERT but not SELECT, so we
 * rely on PostgREST's `RETURNING *` (the default `.select('*').single()`
 * after `.insert(...)` does this) to get the inserted row back without
 * a separate read.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .insert({
      order_number: input.orderNumber,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone_number: input.phone,
      store_address: input.storeAddress,
      notes: input.notes,
      items: input.items,
      subtotal: input.subtotal,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToOrder(data as OrderRow)
}

// ============================================================================
// Admin helpers — used in Phase 3.
// ============================================================================

export async function getOrders(): Promise<Order[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: OrderRow) => rowToOrder(row))
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToOrder(data as OrderRow)
}

export async function markOrderFulfilled(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('orders')
    .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteOrder(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
