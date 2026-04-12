// lib/data/orders.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createOrder', () => {
  it('inserts an order with the items snapshot and returns the new order with snake_case items preserved', async () => {
    const { client, calls } = buildSupabaseMock({
      data: {
        id: 'order-uuid',
        order_number: 'DM-ABC123',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [
          {
            product_id: 'p1',
            product_name: 'Mega V2',
            flavor: 'red bull',
            quantity: 2,
            unit_price: 35,
            line_total: 70,
          },
        ],
        subtotal: 70,
        status: 'pending',
        created_at: '2026-04-11T12:00:00Z',
        fulfilled_at: null,
      },
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { createOrder } = await import('./orders')
    const result = await createOrder({
      orderNumber: 'DM-ABC123',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      notes: null,
      items: [
        {
          product_id: 'p1',
          product_name: 'Mega V2',
          flavor: 'red bull',
          quantity: 2,
          unit_price: 35,
          line_total: 70,
        },
      ],
      subtotal: 70,
    })

    expect(client.from).toHaveBeenCalledWith('orders')
    // The first chained call should be insert(...) with snake_case payload
    expect(calls[0]).toEqual({
      method: 'insert',
      args: [
        {
          order_number: 'DM-ABC123',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          notes: null,
          items: [
            {
              product_id: 'p1',
              product_name: 'Mega V2',
              flavor: 'red bull',
              quantity: 2,
              unit_price: 35,
              line_total: 70,
            },
          ],
          subtotal: 70,
        },
      ],
    })
    expect(calls[1]).toEqual({ method: 'select', args: ['*'] })

    expect(result.orderNumber).toBe('DM-ABC123')
    expect(result.items[0].product_id).toBe('p1')
    expect(result.subtotal).toBe(70)
    expect(result.status).toBe('pending')
  })

  it('throws when supabase returns an error', async () => {
    const { client } = buildSupabaseMock({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { createOrder } = await import('./orders')
    await expect(
      createOrder({
        orderNumber: 'DM-ABC123',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [],
        subtotal: 0,
      })
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('getOrders', () => {
  it('returns orders ordered by created_at desc with camelCase keys', async () => {
    const { client, calls } = buildSupabaseMock({
      data: [
        {
          id: 'order-1',
          order_number: 'DM-AAA111',
          first_name: 'A',
          last_name: 'A',
          email: 'a@x.com',
          notes: null,
          items: [],
          subtotal: 0,
          status: 'pending',
          created_at: '2026-04-11T12:00:00Z',
          fulfilled_at: null,
        },
      ],
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { getOrders } = await import('./orders')
    const result = await getOrders()

    expect(client.from).toHaveBeenCalledWith('orders')
    expect(calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
    ])
    expect(result[0].orderNumber).toBe('DM-AAA111')
    expect(result[0].createdAt).toBe('2026-04-11T12:00:00Z')
  })
})

describe('markOrderFulfilled', () => {
  it('updates status and fulfilled_at', async () => {
    const { client, calls } = buildSupabaseMock({
      data: null,
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { markOrderFulfilled } = await import('./orders')
    await markOrderFulfilled('order-uuid')

    expect(client.from).toHaveBeenCalledWith('orders')
    expect(calls[0].method).toBe('update')
    const updatePayload = calls[0].args[0] as Record<string, unknown>
    expect(updatePayload.status).toBe('fulfilled')
    expect(typeof updatePayload.fulfilled_at).toBe('string')
    expect(calls[1]).toEqual({ method: 'eq', args: ['id', 'order-uuid'] })
  })
})
