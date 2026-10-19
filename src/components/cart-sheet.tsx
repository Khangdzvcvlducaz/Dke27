'use client'

import { useEffect, useState } from 'react'
import { useCafeStore, cartTotal } from '@/store/cafe-store'
import { fmtVND, NOTES_OPTIONS, getDeviceId } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Trash2, Plus, Minus, Home, ShoppingBag, Table2 } from 'lucide-react'
import { toast } from 'sonner'

export function CartSheet() {
  const cart = useCafeStore((s) => s.cart)
  const open = useCafeStore((s) => s.cartSheetOpen)
  const setOpen = useCafeStore((s) => s.setCartSheetOpen)
  const updateQty = useCafeStore((s) => s.updateQty)
  const toggleNote = useCafeStore((s) => s.toggleNote)
  const clearCart = useCafeStore((s) => s.clearCart)
  const cartType = useCafeStore((s) => s.cartType)
  const setCartType = useCafeStore((s) => s.setCartType)
  const cartCustomer = useCafeStore((s) => s.cartCustomer)
  const setCartCustomer = useCafeStore((s) => s.setCartCustomer)
  const cartDiscountCode = useCafeStore((s) => s.cartDiscountCode)
  const setCartDiscount = useCafeStore((s) => s.setCartDiscount)
  const cartTableCode = useCafeStore((s) => s.cartTableCode)
  const setCartTable = useCafeStore((s) => s.setCartTable)

  const [tables, setTables] = useState<{ id: string; code: string; status: string }[]>([])

  useEffect(() => {
    void loadTables()
  }, [])

  async function loadTables() {
    try {
      const r = await fetch('/api/tables')
      const d = await r.json()
      setTables(d.tables || [])
    } catch {}
  }

  const total = cartTotal(cart)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="h-[88vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-4 border-b border-dashed border-border flex-row items-center justify-between">
          <SheetTitle className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-oswald)' }}>
            Đơn mới
          </SheetTitle>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm('Dọn giỏ hàng?')) clearCart() }} className="text-xs">
            <Trash2 className="size-3.5 mr-1" /> Dọn giỏ
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scroll-coffee p-4 space-y-3">
          <div>
            <Label>Khách / Bàn (để trống = khách lẻ)</Label>
            <Input
              value={cartCustomer}
              onChange={(e) => setCartCustomer(e.target.value)}
              placeholder="VD: Chị Hồng / Bàn 2"
            />
          </div>

          <div>
            <Label>Loại đơn</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={cartType === 'stay' ? 'default' : 'outline'}
                onClick={() => setCartType('stay')}
                className="justify-start"
              >
                <Home className="size-4 mr-2" /> Tại chỗ
              </Button>
              <Button
                variant={cartType === 'take' ? 'default' : 'outline'}
                onClick={() => setCartType('take')}
                className="justify-start"
              >
                <ShoppingBag className="size-4 mr-2" /> Mang đi
              </Button>
            </div>
          </div>

          {cartType === 'stay' && tables.length > 0 && (
            <div>
              <Label>Bàn</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCartTable(null)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${!cartTableCode ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card'}`}
                >
                  <Table2 className="size-3 mr-1 inline" /> Chọn bàn
                </button>
                {tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCartTable(t.code)}
                    disabled={t.status === 'occupied' && t.code !== cartTableCode}
                    className={`px-3 py-1.5 rounded-full text-xs border ${cartTableCode === t.code ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card'} ${t.status === 'occupied' && t.code !== cartTableCode ? 'opacity-40' : ''}`}
                  >
                    {t.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Mã giảm giá (nếu có)</Label>
            <Input
              value={cartDiscountCode}
              onChange={(e) => setCartDiscount(e.target.value.toUpperCase())}
              placeholder="VD: SUMMER10"
            />
          </div>

          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 border border-dashed border-border rounded-xl">
              Chưa chọn món — chạm món bên dưới.
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((c, i) => (
                <div key={i} className="border-b border-dashed border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <b className="block text-sm">{c.name}</b>
                      <small className="text-muted-foreground">{fmtVND(c.price)}</small>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => updateQty(i, -1)}>
                        <Minus className="size-3" />
                      </Button>
                      <b className="w-6 text-center text-sm">{c.qty}</b>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => updateQty(i, 1)}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <b className="text-primary font-semibold w-20 text-right" style={{ fontFamily: 'var(--font-oswald)' }}>
                      {fmtVND(c.price * c.qty)}
                    </b>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {NOTES_OPTIONS.map((n) => {
                      const on = c.notes.includes(n)
                      return (
                        <button
                          key={n}
                          onClick={() => toggleNote(i, n)}
                          className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground'}`}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-dashed border-border px-4 py-3 pb-safe space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Tổng tiền</span>
            <b className="text-2xl text-primary" style={{ fontFamily: 'var(--font-oswald)' }}>{fmtVND(total)}</b>
          </div>
          <Button
            disabled={cart.length === 0}
            className="w-full btn-push"
            size="lg"
            onClick={async () => {
              try {
                const { user } = useCafeStore.getState()
                if (!user) return
                const r = await fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'create',
                    customer: cartCustomer || 'Khách lẻ',
                    tableCode: cartTableCode,
                    type: cartType,
                    discountCode: cartDiscountCode || undefined,
                    items: cart,
                    by: user.name,
                    device: getDeviceId(),
                  }),
                })
                const d = await r.json()
                if (!r.ok) throw new Error(d.error)
                const { broadcastOrderNew } = await import('@/lib/socket-client')
                broadcastOrderNew('cafe', d.order)
                clearCart()
                setOpen(false)
                toast.success(`✓ Đã gửi ${d.order.code} — mọi thiết bị thấy ngay`)
              } catch (e) {
                toast.error((e as Error).message)
              }
            }}
          >
            Gửi đơn → Quầy pha
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
