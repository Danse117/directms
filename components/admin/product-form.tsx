'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from '@/app/actions/admin/products'
import type { Product } from '@/lib/data/products'
import { getProductImageUrl } from '@/lib/supabase/storage'
import { ImageUpload } from '@/components/admin/image-upload'
import { TagInput } from '@/components/admin/tag-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type ProductFormProps = {
  product?: Product | null
}

const initialState: ProductActionState = { ok: false }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!product

  const boundAction = isEdit
    ? updateProductAction.bind(null, product.id)
    : createProductAction

  const [state, action, isPending] = useActionState(boundAction, initialState)

  useEffect(() => {
    if (state.ok) {
      router.push('/admin/products')
    }
  }, [state.ok, router])

  return (
    <form action={action} className="max-w-xl space-y-6">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={product?.name ?? ''}
          required
          onChange={(e) => {
            if (!isEdit) {
              const slugInput = document.getElementById('slug') as HTMLInputElement
              if (slugInput) slugInput.value = slugify(e.target.value)
            }
          }}
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={product?.slug ?? ''}
          required
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
        />
        {state.fieldErrors?.slug && (
          <p className="text-sm text-destructive">{state.fieldErrors.slug[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input
          id="subtitle"
          name="subtitle"
          defaultValue={product?.subtitle ?? ''}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="price">Price</Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={product?.price?.toString() ?? ''}
          required
        />
        {state.fieldErrors?.price && (
          <p className="text-sm text-destructive">{state.fieldErrors.price[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Flavors</Label>
        <TagInput initialTags={product?.flavors ?? []} />
        {state.fieldErrors?.flavors && (
          <p className="text-sm text-destructive">{state.fieldErrors.flavors[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Image</Label>
        <ImageUpload
          existingUrl={product?.imagePath ? getProductImageUrl(product.imagePath) : null}
          existingPath={product?.imagePath ?? null}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="isVisible"
          name="isVisible"
          value="on"
          defaultChecked={product?.isVisible ?? true}
        />
        <Label htmlFor="isVisible">Visible in catalog</Label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sortOrder">Sort Order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          defaultValue={String(product?.sortOrder ?? 0)}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEdit ? 'Saving...' : 'Creating...'
            : isEdit ? 'Save Changes' : 'Create Product'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/products')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
