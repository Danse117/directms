// app/actions/place-order.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getProductsByIds: vi.fn(),
}))
vi.mock('@/lib/data/orders', () => ({
  createOrder: vi.fn(),
}))
const { getProductsByIds } = await import('@/lib/data/products')
const { createOrder } = await import('@/lib/data/orders')

function buildFormData(payload: unknown, honeypot = '') {
  const fd = new FormData()
  fd.set('payload', JSON.stringify(payload))
  fd.set('website', honeypot) // honeypot field
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('placeOrderAction', () => {
  it('re-fetches products from the DB, recomputes the subtotal server-side, inserts, and emails the customer', async () => {
    vi.mocked(getProductsByIds).mockResolvedValue([
      {
        id: 'p1',
        slug: 'mega-v2',
        name: 'Mega V2',
        subtitle: null,
        price: 35, // canonical price from DB
        flavors: ['red bull'],
        imagePath: null,
        isVisible: true,
        sortOrder: 0,
      },
      {
        id: 'p2',
        slug: 'stig',
        name: 'Stig',
        subtitle: null,
        price: 25,
        flavors: ['green apple'],
        imagePath: null,
        isVisible: true,
        sortOrder: 1,
      },
    ])
    vi.mocked(createOrder).mockResolvedValue({
      id: 'order-uuid',
      orderNumber: 'DM-IGNORED',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: null,
      storeAddress: null,
      notes: null,
      items: [],
      subtotal: 0,
      status: 'pending',
      createdAt: '2026-04-11T12:00:00Z',
      fulfilledAt: null,
    })
    const { placeOrderAction } = await import('./place-order')
    const result = await placeOrderAction(
      { ok: false },
      buildFormData({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: '',
        items: [
          // Client claims absurdly low prices — should be ignored.
          { productId: 'p1', flavor: 'red bull', quantity: 2 },
          { productId: 'p2', flavor: 'green apple', quantity: 1 },
        ],
      })
    )

    expect(result.ok).toBe(true)
    expect(result.orderNumber).toMatch(/^DM-[A-F0-9]{6}$/)

    expect(getProductsByIds).toHaveBeenCalledWith(['p1', 'p2'])

    // createOrder must have received DB-truth prices and computed subtotal
    const createCall = vi.mocked(createOrder).mock.calls[0][0]
    expect(createCall.subtotal).toBe(2 * 35 + 1 * 25)
    expect(createCall.items).toEqual([
      {
        product_id: 'p1',
        product_name: 'Mega V2',
        flavor: 'red bull',
        quantity: 2,
        unit_price: 35,
        line_total: 70,
      },
      {
        product_id: 'p2',
        product_name: 'Stig',
        flavor: 'green apple',
        quantity: 1,
        unit_price: 25,
        line_total: 25,
      },
    ])

  })

  it('saves order without email when email is omitted', async () => {
    vi.mocked(getProductsByIds).mockResolvedValue([
      {
        id: 'p1',
        slug: 'mega-v2',
        name: 'Mega V2',
        subtitle: null,
        price: 35,
        flavors: ['red bull'],
        imagePath: null,
        isVisible: true,
        sortOrder: 0,
      },
    ])
    vi.mocked(createOrder).mockResolvedValue({
      id: 'order-uuid',
      orderNumber: 'DM-IGNORED',
      firstName: 'Jane',
      lastName: 'Doe',
      email: null,
      phone: '555-1234',
      storeAddress: '123 Main St',
      notes: null,
      items: [],
      subtotal: 0,
      status: 'pending',
      createdAt: '2026-04-11T12:00:00Z',
      fulfilledAt: null,
    })
    const { placeOrderAction } = await import('./place-order')
    const result = await placeOrderAction(
      { ok: false },
      buildFormData({
        firstName: 'Jane',
        lastName: 'Doe',
        email: '',
        phone: '555-1234',
        storeAddress: '123 Main St',
        notes: '',
        items: [
          { productId: 'p1', flavor: 'red bull', quantity: 1 },
        ],
      })
    )

    expect(result.ok).toBe(true)
    const createCall = vi.mocked(createOrder).mock.calls[0][0]
    expect(createCall.email).toBeNull()
    expect(createCall.phone).toBe('555-1234')
    expect(createCall.storeAddress).toBe('123 Main St')
  })

  it('returns ok without writing when the honeypot field is filled', async () => {
    const { placeOrderAction } = await import('./place-order')
    const result = await placeOrderAction(
      { ok: false },
      buildFormData(
        {
          firstName: 'Spam',
          lastName: 'Bot',
          email: 'spam@bot.com',
          notes: '',
          items: [{ productId: 'p1', flavor: 'red bull', quantity: 1 }],
        },
        'http://spam.example' // honeypot triggered
      )
    )

    expect(result.ok).toBe(true)
    expect(getProductsByIds).not.toHaveBeenCalled()
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('returns field errors for invalid input', async () => {
    const { placeOrderAction } = await import('./place-order')
    const result = await placeOrderAction(
      { ok: false },
      buildFormData({
        firstName: '',
        lastName: '',
        email: 'not-an-email',
        notes: '',
        items: [],
      })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors).toBeDefined()
    expect(result.fieldErrors?.firstName).toBeDefined()
    expect(result.fieldErrors?.email).toBeDefined()
    expect(result.fieldErrors?.items).toBeDefined()
    expect(getProductsByIds).not.toHaveBeenCalled()
  })

  it('rejects when the client sends a productId that no longer exists in the DB', async () => {
    vi.mocked(getProductsByIds).mockResolvedValue([
      {
        id: 'p1',
        slug: 'mega-v2',
        name: 'Mega V2',
        subtitle: null,
        price: 35,
        flavors: ['red bull'],
        imagePath: null,
        isVisible: true,
        sortOrder: 0,
      },
      // p2 deliberately missing
    ])

    const { placeOrderAction } = await import('./place-order')
    const result = await placeOrderAction(
      { ok: false },
      buildFormData({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: '',
        items: [
          { productId: 'p1', flavor: 'red bull', quantity: 1 },
          { productId: 'p2', flavor: 'green apple', quantity: 1 },
        ],
      })
    )

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no longer available/i)
    expect(createOrder).not.toHaveBeenCalled()
  })

})
