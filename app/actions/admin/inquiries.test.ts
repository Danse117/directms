import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/data/inquiries', () => ({
  deleteInquiry: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { deleteInquiry } = await import('@/lib/data/inquiries')
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

describe('deleteInquiryAction', () => {
  it('throws when unauthenticated', async () => {
    mockAuth(null)
    const { deleteInquiryAction } = await import('./inquiries')
    await expect(deleteInquiryAction('i1')).rejects.toThrow('Unauthorized')
  })

  it('deletes inquiry and revalidates', async () => {
    mockAuth({ id: 'u1', email: 'admin@test.com' })
    const { deleteInquiryAction } = await import('./inquiries')
    await deleteInquiryAction('i1')

    expect(deleteInquiry).toHaveBeenCalledWith('i1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/inquiries')
  })
})
