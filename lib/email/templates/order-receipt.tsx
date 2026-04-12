// lib/email/templates/order-receipt.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { OrderItemSnapshot } from '@/lib/data/orders'

export type OrderReceiptProps = {
  orderNumber: string
  firstName: string
  lastName: string
  items: OrderItemSnapshot[]
  subtotal: number
  notes: string | null
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function OrderReceipt({
  orderNumber,
  firstName,
  lastName,
  items,
  subtotal,
  notes,
}: OrderReceiptProps) {
  return (
    <Html>
      <Head />
      <Preview>Your DirectMS order {orderNumber} has been received</Preview>
      <Body
        style={{
          backgroundColor: '#fdf8f3',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: '#1c1c1c',
          padding: '24px 0',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '560px',
            margin: '0 auto',
            border: '1px solid #efe6d8',
          }}
        >
          <Heading
            as="h1"
            style={{ fontSize: '22px', margin: '0 0 4px 0', color: '#1c1c1c' }}
          >
            Order received
          </Heading>
          <Text style={{ color: '#7c7163', margin: '0 0 24px 0' }}>
            Order number{' '}
            <strong style={{ color: '#1c1c1c', fontFamily: 'ui-monospace, monospace' }}>
              {orderNumber}
            </strong>
          </Text>

          <Text style={{ margin: '0 0 16px 0' }}>
            Hi {firstName} {lastName}, thanks for your order. Here&apos;s a copy
            for your records — we&apos;ll be in touch shortly to confirm
            fulfillment.
          </Text>

          <Hr style={{ border: 'none', borderTop: '1px solid #efe6d8', margin: '20px 0' }} />

          <Section>
            {items.map((item, idx) => (
              <Row key={`${item.product_id}-${item.flavor}-${idx}`} style={{ marginBottom: '12px' }}>
                <Column>
                  <Text style={{ margin: 0, fontWeight: 600 }}>{item.product_name}</Text>
                  <Text style={{ margin: '2px 0 0 0', color: '#7c7163', fontSize: '13px' }}>
                    {item.flavor} · qty {item.quantity} · {formatCurrency(item.unit_price)} each
                  </Text>
                </Column>
                <Column align="right" style={{ verticalAlign: 'top' }}>
                  <Text style={{ margin: 0, fontWeight: 600 }}>
                    {formatCurrency(item.line_total)}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Hr style={{ border: 'none', borderTop: '1px solid #efe6d8', margin: '20px 0' }} />

          <Row>
            <Column>
              <Text style={{ margin: 0, fontWeight: 600 }}>Subtotal</Text>
            </Column>
            <Column align="right">
              <Text style={{ margin: 0, fontWeight: 600 }}>{formatCurrency(subtotal)}</Text>
            </Column>
          </Row>

          {notes ? (
            <>
              <Hr style={{ border: 'none', borderTop: '1px solid #efe6d8', margin: '20px 0' }} />
              <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Order notes</Text>
              <Text style={{ margin: 0, color: '#7c7163' }}>{notes}</Text>
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  )
}
