// lib/email/send-order-receipt.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/email/resend', () => ({
  getResend: vi.fn(),
}))

process.env.RESEND_FROM_EMAIL = 'orders@directms.example'

const { getResend } = await import('@/lib/email/resend')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendOrderReceipt', () => {
  it('calls resend.emails.send with the order recipient and a React element', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null })
    vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

    const { sendOrderReceipt } = await import('./send-order-receipt')
    await sendOrderReceipt({
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

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0][0]
    expect(call.from).toBe('orders@directms.example')
    expect(call.to).toBe('jane@example.com')
    expect(call.subject).toContain('DM-ABC123')
    // The `react` prop should be a JSX element, not a string
    expect(call.react).toBeDefined()
    expect(typeof call.react).toBe('object')
  })

  it('throws when resend returns an error', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'rate limited' } })
    vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

    const { sendOrderReceipt } = await import('./send-order-receipt')
    await expect(
      sendOrderReceipt({
        orderNumber: 'DM-ABC123',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        notes: null,
        items: [],
        subtotal: 0,
      })
    ).rejects.toThrow(/rate limited/)
  })
})
