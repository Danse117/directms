// lib/data/inquiries.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildSupabaseMock } from '@/tests/helpers/supabase-mock'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createInquiry', () => {
  it('inserts a row with snake_case keys and returns the new inquiry mapped to camelCase', async () => {
    const { client, calls } = buildSupabaseMock({
      data: {
        id: 'inq-uuid',
        name: 'Jane',
        business_name: 'Acme',
        email: 'jane@example.com',
        phone: '+1-555-0100',
        requested_item: 'Geek Bar 25k puffs',
        details: 'Looking for case quantities',
        created_at: '2026-04-11T12:00:00Z',
      },
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { createInquiry } = await import('./inquiries')
    const result = await createInquiry({
      name: 'Jane',
      businessName: 'Acme',
      email: 'jane@example.com',
      phone: '+1-555-0100',
      requestedItem: 'Geek Bar 25k puffs',
      details: 'Looking for case quantities',
    })

    expect(client.from).toHaveBeenCalledWith('inquiries')
    expect(calls[0]).toEqual({
      method: 'insert',
      args: [
        {
          name: 'Jane',
          business_name: 'Acme',
          email: 'jane@example.com',
          phone: '+1-555-0100',
          requested_item: 'Geek Bar 25k puffs',
          details: 'Looking for case quantities',
        },
      ],
    })
    expect(result.id).toBe('inq-uuid')
    expect(result.businessName).toBe('Acme')
    expect(result.requestedItem).toBe('Geek Bar 25k puffs')
  })

  it('translates undefined optionals to null on the way in', async () => {
    const { client, calls } = buildSupabaseMock({
      data: {
        id: 'inq-uuid',
        name: 'Jane',
        business_name: null,
        email: 'jane@example.com',
        phone: null,
        requested_item: 'Anything',
        details: null,
        created_at: '2026-04-11T12:00:00Z',
      },
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { createInquiry } = await import('./inquiries')
    await createInquiry({
      name: 'Jane',
      businessName: undefined,
      email: 'jane@example.com',
      phone: undefined,
      requestedItem: 'Anything',
      details: undefined,
    })

    const insertArgs = calls[0].args[0] as Record<string, unknown>
    expect(insertArgs.business_name).toBeNull()
    expect(insertArgs.phone).toBeNull()
    expect(insertArgs.details).toBeNull()
  })
})

describe('getInquiries', () => {
  it('returns inquiries ordered by created_at desc', async () => {
    const { client, calls } = buildSupabaseMock({
      data: [
        {
          id: 'i1',
          name: 'A',
          business_name: null,
          email: 'a@x.com',
          phone: null,
          requested_item: 'X',
          details: null,
          created_at: '2026-04-11T12:00:00Z',
        },
      ],
      error: null,
    })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

    const { getInquiries } = await import('./inquiries')
    const result = await getInquiries()

    expect(calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
    ])
    expect(result[0].id).toBe('i1')
    expect(result[0].requestedItem).toBe('X')
  })
})
