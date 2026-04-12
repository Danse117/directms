// lib/data/products.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getVisibleProducts', () => {
  it('returns visible products ordered by sort_order, mapped to camelCase with public image URL', async () => {
    const { client, calls } = buildSupabaseMock({
      data: [
        {
          id: 'uuid-1',
          slug: 'mega-v2-10-packs',
          name: 'Mega V2',
          subtitle: '25 flavor options',
          price: 35,
          flavors: ['red bull', 'cool mint'],
          image_path: '/products/mega-v2-10-packs.jpg',
          is_visible: true,
          sort_order: 10,
        },
        {
          id: 'uuid-2',
          slug: 'stig',
          name: 'Stig',
          subtitle: '1 flavor option',
          price: 25,
          flavors: ['green apple'],
          image_path: null,
          is_visible: true,
          sort_order: 50,
        },
      ],
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { getVisibleProducts } = await import('./products')
    const result = await getVisibleProducts()

    expect(client.from).toHaveBeenCalledWith('products')
    expect(calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['is_visible', true] },
      { method: 'order', args: ['sort_order', { ascending: true }] },
    ])

    expect(result).toEqual([
      {
        id: 'uuid-1',
        slug: 'mega-v2-10-packs',
        name: 'Mega V2',
        subtitle: '25 flavor options',
        price: 35,
        flavors: ['red bull', 'cool mint'],
        imagePath: '/products/mega-v2-10-packs.jpg',
        isVisible: true,
        sortOrder: 10,
      },
      {
        id: 'uuid-2',
        slug: 'stig',
        name: 'Stig',
        subtitle: '1 flavor option',
        price: 25,
        flavors: ['green apple'],
        imagePath: null,
        isVisible: true,
        sortOrder: 50,
      },
    ])
  })

  it('throws when supabase returns an error', async () => {
    const { client } = buildSupabaseMock({
      data: null,
      error: { message: 'connection refused' },
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { getVisibleProducts } = await import('./products')
    await expect(getVisibleProducts()).rejects.toThrow(/connection refused/)
  })
})

describe('getProductsByIds', () => {
  it('fetches multiple products in a single query and returns them mapped to camelCase', async () => {
    const { client, calls } = buildSupabaseMock({
      data: [
        {
          id: 'uuid-1',
          slug: 'a',
          name: 'A',
          subtitle: null,
          price: 35,
          flavors: ['x'],
          image_path: '/products/a.jpg',
          is_visible: true,
          sort_order: 10,
        },
        {
          id: 'uuid-2',
          slug: 'b',
          name: 'B',
          subtitle: null,
          price: 25,
          flavors: ['y'],
          image_path: null,
          is_visible: true,
          sort_order: 20,
        },
      ],
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { getProductsByIds } = await import('./products')
    const result = await getProductsByIds(['uuid-1', 'uuid-2'])

    expect(calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'in', args: ['id', ['uuid-1', 'uuid-2']] },
    ])
    expect(result.map((p) => p.id)).toEqual(['uuid-1', 'uuid-2'])
    expect(result[0].imagePath).toBe('/products/a.jpg')
  })

  it('returns an empty array for an empty input without calling supabase', async () => {
    const { client } = buildSupabaseMock({ data: [], error: null })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { getProductsByIds } = await import('./products')
    const result = await getProductsByIds([])

    expect(result).toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })
})
