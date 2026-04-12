// app/actions/place-order.ts
'use server'

import { randomBytes } from 'node:crypto'
import { orderSchema, type OrderInput } from '@/lib/schemas/order'
import { getProductsByIds } from '@/lib/data/products'
import { createOrder } from '@/lib/data/orders'

export type PlaceOrderState = {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof OrderInput, string[]>>
  orderNumber?: string
}

function generateOrderNumber(): string {
  return `DM-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function placeOrderAction(
  _prevState: PlaceOrderState,
  formData: FormData
): Promise<PlaceOrderState> {
  // 1. Honeypot bail-out — silent success so bots can't tell they were caught
  const honeypot = formData.get('website')
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return { ok: true, orderNumber: generateOrderNumber() }
  }

  // 2. Parse JSON payload
  const raw = formData.get('payload')
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Missing payload' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Invalid JSON payload' }
  }

  // 3. Zod validate
  const result = orderSchema.safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as PlaceOrderState['fieldErrors'],
    }
  }
  const input = result.data

  // 4. Re-fetch products from the DB — never trust client prices
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)))
  const products = await getProductsByIds(productIds)
  const productById = new Map(products.map((p) => [p.id, p]))

  // 5. Verify every claimed product exists
  for (const item of input.items) {
    if (!productById.has(item.productId)) {
      return {
        ok: false,
        error: 'One or more items are no longer available. Please refresh and try again.',
      }
    }
  }

  // 6. Build server-computed items snapshot
  const itemsSnapshot = input.items.map((item) => {
    const product = productById.get(item.productId)!
    const lineTotal = product.price * item.quantity
    return {
      product_id: product.id,
      product_name: product.name,
      flavor: item.flavor,
      quantity: item.quantity,
      unit_price: product.price,
      line_total: lineTotal,
    }
  })
  const subtotal = itemsSnapshot.reduce((sum, line) => sum + line.line_total, 0)

  // 7. Insert into DB
  const orderNumber = generateOrderNumber()
  try {
    await createOrder({
      orderNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      storeAddress: input.storeAddress ?? null,
      notes: input.notes ?? null,
      items: itemsSnapshot,
      subtotal,
    })
  } catch (err) {
    console.error('[placeOrder] createOrder failed:', err)
    return {
      ok: false,
      error: 'Could not save your order. Please try again in a moment.',
    }
  }

  return { ok: true, orderNumber }
}
