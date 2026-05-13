'use client'

import { useEffect } from 'react'

/**
 * Fires window.print() once on mount, after web fonts have loaded.
 * Mounted by the print page so the print dialog appears automatically
 * when the tab opens.
 */
export function AutoPrint() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const trigger = () => window.print()
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(trigger)
    } else {
      trigger()
    }
  }, [])

  return null
}
