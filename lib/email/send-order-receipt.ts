// lib/email/send-order-receipt.ts
import { getResend } from '@/lib/email/resend'
import type { OrderItemSnapshot } from '@/lib/data/orders'
import { OrderReceipt } from './templates/order-receipt'

export type SendOrderReceiptInput = {
  orderNumber: string
  firstName: string
  lastName: string
  email: string
  notes: string | null
  items: OrderItemSnapshot[]
  subtotal: number
}

export async function sendOrderReceipt(input: SendOrderReceiptInput): Promise<void> {
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? '',
    to: input.email,
    subject: `Order received — ${input.orderNumber}`,
    react: OrderReceipt({
      orderNumber: input.orderNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      items: input.items,
      subtotal: input.subtotal,
      notes: input.notes,
    }),
  })
  if (error) throw new Error(error.message)
}
