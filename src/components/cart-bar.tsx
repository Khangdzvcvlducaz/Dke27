'use client'

import { useCafeStore, cartTotal, cartCount } from '@/store/cafe-store'
import { fmtVND } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'

export function CartBar() {
  const cart = useCafeStore((s) => s.cart)
  const setCartSheetOpen = useCafeStore((s) => s.setCartSheetOpen)
  const currentView = useCafeStore((s) => s.currentView)

  if (currentView !== 'pos' || cart.length === 0) return null

  const total = cartTotal(cart)
  const n = cartCount(cart)

  return (
    <div
      className="fixed left-3 right-3 z-40 bg-primary text-primary-foreground rounded-2xl shadow-lg flex items-center justify-between px-4 py-3"
      style={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShoppingCart className="size-5 shrink-0" />
        <b className="truncate text-sm font-semibold">{n} món · {fmtVND(total)}</b>
      </div>
      <Button
        onClick={() => setCartSheetOpen(true)}
        className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 btn-push font-semibold"
        size="sm"
      >
        Xem đơn →
      </Button>
    </div>
  )
}
