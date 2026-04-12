import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/data/products', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  toggleProductVisibility: vi.fn(),
  getProductById: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { createProduct, updateProduct, deleteProduct, toggleProductVisibility, getProductById } =
  await import('@/lib/data/products')
const { revalidatePath } = await import('next/cache')

function mockAuth(user: { id: string; email: string } | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'products/test.jpg' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

function buildProductFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  fd.set('name', (overrides.name as string) ?? 'Test Product')
  fd.set('slug', (overrides.slug as string) ?? 'test-product')
  fd.set('subtitle', (overrides.subtitle as string) ?? '')
  fd.set('price', (overrides.price as string) ?? '25.00')
  fd.set('flavors', (overrides.flavors as string) ?? '["mint","grape"]')
  fd.set('sortOrder', (overrides.sortOrder as string) ?? '0')
  if (overrides.isVisible) fd.set('isVisible', overrides.isVisible as string)
  if (overrides.image) fd.set('image', overrides.image)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createProductAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { createProductAction } = await import('./products')
    await expect(createProductAction({ ok: false }, new FormData())).rejects.toThrow('Unauthorized')
  })

  it('validates input and creates product', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    vi.mocked(createProduct).mockResolvedValue({
      id: 'p1', slug: 'test-product', name: 'Test Product', subtitle: null,
      price: 25, flavors: ['mint', 'grape'], imagePath: null,
      isVisible: true, sortOrder: 0,
    })

    const { createProductAction } = await import('./products')
    const fd = buildProductFormData({ isVisible: 'on' })
    const result = await createProductAction({ ok: false }, fd)

    expect(result.ok).toBe(true)
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Product',
        slug: 'test-product',
        price: 25,
        flavors: ['mint', 'grape'],
        isVisible: true,
      })
    )
    expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns field errors for invalid input', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { createProductAction } = await import('./products')
    const fd = buildProductFormData({ name: '', slug: 'INVALID!', price: '-5' })
    const result = await createProductAction({ ok: false }, fd)

    expect(result.ok).toBe(false)
    expect(result.fieldErrors).toBeDefined()
  })
})

describe('updateProductAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { updateProductAction } = await import('./products')
    await expect(updateProductAction('p1', { ok: false }, new FormData())).rejects.toThrow('Unauthorized')
  })

  it('validates and updates product', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    vi.mocked(updateProduct).mockResolvedValue({
      id: 'p1', slug: 'test-product', name: 'Updated', subtitle: null,
      price: 30, flavors: ['mint'], imagePath: null,
      isVisible: false, sortOrder: 0,
    })

    const { updateProductAction } = await import('./products')
    const fd = buildProductFormData({ name: 'Updated', price: '30', flavors: '["mint"]' })
    const result = await updateProductAction('p1', { ok: false }, fd)

    expect(result.ok).toBe(true)
    expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Updated', price: 30 }))
  })
})

describe('deleteProductAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { deleteProductAction } = await import('./products')
    await expect(deleteProductAction('p1')).rejects.toThrow('Unauthorized')
  })

  it('deletes the product and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    vi.mocked(getProductById).mockResolvedValue({
      id: 'p1', slug: 'test', name: 'Test', subtitle: null,
      price: 10, flavors: [], imagePath: 'products/old.jpg',
      isVisible: true, sortOrder: 0,
    })
    const { deleteProductAction } = await import('./products')
    await deleteProductAction('p1')

    expect(deleteProduct).toHaveBeenCalledWith('p1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})

describe('toggleProductVisibilityAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { toggleProductVisibilityAction } = await import('./products')
    await expect(toggleProductVisibilityAction('p1', true)).rejects.toThrow('Unauthorized')
  })

  it('toggles visibility and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { toggleProductVisibilityAction } = await import('./products')
    await toggleProductVisibilityAction('p1', false)

    expect(toggleProductVisibility).toHaveBeenCalledWith('p1', false)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
