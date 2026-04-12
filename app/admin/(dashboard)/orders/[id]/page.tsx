import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getOrderById } from '@/lib/data/orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) notFound()

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/admin/orders">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Orders
          </Link>
        </Button>
      </div>

      {/* Order header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Order {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Badge
          variant={order.status === 'fulfilled' ? 'default' : 'secondary'}
          className="text-sm"
        >
          {order.status}
        </Badge>
      </div>

      {/* Customer info */}
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Customer</h2>
        <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">
              {order.firstName} {order.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{order.email}</dd>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="font-medium">{order.notes}</dd>
            </div>
          )}
          {order.fulfilledAt && (
            <div>
              <dt className="text-muted-foreground">Fulfilled at</dt>
              <dd className="font-medium">
                {new Date(order.fulfilledAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Order items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Items</h2>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Flavor</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.flavor}</TableCell>
                  <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-right">${item.line_total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Subtotal */}
        <div className="flex justify-end">
          <div className="text-sm font-semibold">
            Subtotal:{' '}
            <span className="text-base">${order.subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
