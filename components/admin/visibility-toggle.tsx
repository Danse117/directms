'use client'

import { useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { toggleProductVisibilityAction } from '@/app/actions/admin/products'

type VisibilityToggleProps = {
  productId: string
  isVisible: boolean
}

export function VisibilityToggle({ productId, isVisible }: VisibilityToggleProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <Switch
      checked={isVisible}
      disabled={isPending}
      onCheckedChange={(checked) =>
        startTransition(() => toggleProductVisibilityAction(productId, checked))
      }
    />
  )
}
