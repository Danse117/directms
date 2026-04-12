import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/data/orders', () => ({
  markOrderFulfilled: vi.fn(),
  deleteOrder: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { markOrderFulfilled, deleteOrder } = await import('@/lib/data/orders')
const { revalidatePath } = await import('next/cache')

function mockAuth(user: { id: string; email: string } | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('markOrderFulfilledAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { markOrderFulfilledAction } = await import('./orders')
    await expect(markOrderFulfilledAction('o1')).rejects.toThrow('Unauthorized')
  })

  it('marks order fulfilled and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { markOrderFulfilledAction } = await import('./orders')
    await markOrderFulfilledAction('o1')

    expect(markOrderFulfilled).toHaveBeenCalledWith('o1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders')
  })
})

describe('deleteOrderAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { deleteOrderAction } = await import('./orders')
    await expect(deleteOrderAction('o1')).rejects.toThrow('Unauthorized')
  })

  it('deletes order and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { deleteOrderAction } = await import('./orders')
    await deleteOrderAction('o1')

    expect(deleteOrder).toHaveBeenCalledWith('o1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders')
  })
})
