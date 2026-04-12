import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllProducts } from '@/lib/data/products'
import { deleteProductAction } from '@/app/actions/admin/products'
import { getProductImageUrl } from '@/lib/supabase/storage'
import { VisibilityToggle } from '@/components/admin/visibility-toggle'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil } from 'lucide-react'

export const metadata: Metadata = { title: 'Products' }

export default async function AdminProductsPage() {
  const products = await getAllProducts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new">
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            Add Product
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Flavors</TableHead>
                <TableHead className="text-center">Visible</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.imagePath ? (
                      <img
                        src={getProductImageUrl(product.imagePath)}
                        alt={product.name}
                        className="size-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        N/A
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.subtitle && (
                        <p className="text-xs text-muted-foreground">{product.subtitle}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${product.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.flavors.length}
                  </TableCell>
                  <TableCell className="text-center">
                    <VisibilityToggle productId={product.id} isVisible={product.isVisible} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/products/${product.id}`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                      </Link>
                      <DeleteDialog
                        title="Delete product?"
                        description={`This will permanently delete "${product.name}". This action cannot be undone.`}
                        onConfirm={deleteProductAction.bind(null, product.id)}
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
