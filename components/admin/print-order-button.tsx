'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PrintOrderButtonProps = {
  orderId: string
  /**
   * 'icon' for compact use in table rows.
   * 'default' for the order detail header (icon + label).
   */
  variant?: 'icon' | 'default'
}

export function PrintOrderButton({
  orderId,
  variant = 'icon',
}: PrintOrderButtonProps) {
  function handleClick() {
    window.open(
      `/admin/orders/${orderId}/print`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={handleClick}
        aria-label="Print order"
        title="Print order"
      >
        <Printer className="size-4" />
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" type="button" onClick={handleClick}>
      <Printer className="size-4" />
      Print invoice
    </Button>
  )
}
