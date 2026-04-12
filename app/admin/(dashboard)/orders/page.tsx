import Link from 'next/link'
import { Eye, CheckCircle } from 'lucide-react'
import { getOrders } from '@/lib/data/orders'
import { markOrderFulfilledAction, deleteOrderAction } from '@/app/actions/admin/orders'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function AdminOrdersPage() {
  const orders = await getOrders()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage and fulfill customer orders.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">No orders yet.</p>
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    {order.firstName} {order.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {order.email || order.phone || '—'}
                  </TableCell>
                  <TableCell>
                    ${order.subtotal.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={order.status === 'fulfilled' ? 'default' : 'secondary'}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/orders/${order.id}`}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>

                      {order.status === 'pending' && (
                        <form action={markOrderFulfilledAction.bind(null, order.id)}>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="submit"
                            className="text-green-600 hover:text-green-600"
                          >
                            <CheckCircle className="size-4" />
                          </Button>
                        </form>
                      )}

                      <DeleteDialog
                        title="Delete order?"
                        description={`This will permanently delete order ${order.orderNumber}. This action cannot be undone.`}
                        onConfirm={deleteOrderAction.bind(null, order.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
