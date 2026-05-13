import { notFound } from 'next/navigation'
import { getOrderById } from '@/lib/data/orders'
import { AutoPrint } from '@/components/admin/auto-print'

type Props = {
  params: Promise<{ id: string }>
}

export default async function OrderPrintPage({ params }: Props) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) notFound()

  const placedOn = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const fulfilledOn = order.fulfilledAt
    ? new Date(order.fulfilledAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <main className="invoice-page">
      <AutoPrint />

      <header className="invoice-header">
        <div className="invoice-brand">DirectMS</div>
        <div className="invoice-title-block">
          <h1 className="invoice-title">INVOICE</h1>
          <div className="invoice-meta">Order #{order.orderNumber}</div>
          <div className="invoice-meta">{placedOn}</div>
        </div>
      </header>

      <section className="invoice-section invoice-customer-row">
        <div className="invoice-customer">
          <h2 className="invoice-section-heading">Bill To</h2>
          <dl>
            <dt>Name</dt>
            <dd>
              {order.firstName} {order.lastName}
            </dd>
            {order.email && (
              <>
                <dt>Email</dt>
                <dd>{order.email}</dd>
              </>
            )}
            {order.phone && (
              <>
                <dt>Phone</dt>
                <dd>{order.phone}</dd>
              </>
            )}
            {order.storeAddress && (
              <>
                <dt>Address</dt>
                <dd>{order.storeAddress}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="invoice-status">
          <div>Status: {order.status.toUpperCase()}</div>
          {fulfilledOn && <div>Fulfilled: {fulfilledOn}</div>}
        </div>
      </section>

      <section className="invoice-section">
        <h2 className="invoice-section-heading">Items</h2>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Flavor</th>
              <th className="num">Unit Price</th>
              <th className="num">Qty</th>
              <th className="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td>{item.product_name}</td>
                <td>{item.flavor}</td>
                <td className="num">${item.unit_price.toFixed(2)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">${item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          Total:
          <span className="invoice-totals-amount">
            ${order.subtotal.toFixed(2)}
          </span>
        </div>
      </section>

      {order.notes && (
        <section className="invoice-section">
          <h2 className="invoice-section-heading">Notes</h2>
          <div className="invoice-notes">{order.notes}</div>
        </section>
      )}

      <footer className="invoice-footer">
        Thank you for your business — DirectMS
      </footer>
    </main>
  )
}
