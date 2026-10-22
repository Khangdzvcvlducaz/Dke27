'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { fmtVND, fmtTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSocket, broadcastOrderUpdate } from '@/lib/socket-client'
import { QrPaymentSheet } from '@/components/qr-payment-sheet'
import { Printer, Banknote, Landmark, Volume2 } from 'lucide-react'
import type { OrderDTO } from './kitchen-view'

export function PayView() {
  const user = useCafeStore((s) => s.user)
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrOrder, setQrOrder] = useState<OrderDTO | null>(null)

  useEffect(() => {
    void load()
    const socket = getSocket('cafe')
    // Socket listener — only updates the orders list. The Cha-Ching sound
    // + toast are handled GLOBALLY by AppShell (so they fire even when the
    // user is on a different view, like POS or Report).
    const onNew = (o: OrderDTO) => {
      if (o.status !== 'done') return
      setOrders((list) => [o, ...list.filter((x) => x.id !== o.id)])
    }
    const onUpdate = (o: OrderDTO) => {
      if (o.status === 'done') {
        setOrders((list) => [o, ...list.filter((x) => x.id !== o.id)])
      } else if (o.status === 'paid' || o.status === 'canceled') {
        setOrders((list) => list.filter((x) => x.id !== o.id))
      }
    }
    const onDelete = ({ id }: { id: string }) => {
      setOrders((list) => list.filter((x) => x.id !== id))
    }
    socket.on('order:new', onNew)
    socket.on('order:update', onUpdate)
    socket.on('order:delete', onDelete)
    socket.on('connect', () => {
      socket.emit('join', 'cafe')
      void load()
    })
    return () => {
      socket.off('order:new', onNew)
      socket.off('order:update', onUpdate)
      socket.off('order:delete', onDelete)
      socket.off('connect')
    }
  }, [user])

  // POLLING FALLBACK: refetch done orders every 10 seconds to keep the list
  // in sync if socket events are missed. Does NOT play sound — AppShell
  // handles Cha-Ching globally (so user hears it from any view, not just
  // when on Pay view).
  useEffect(() => {
    if (!user) return
    let active = true
    const poll = async () => {
      if (!active) return
      try {
        const r = await fetch('/api/orders?status=done')
        const d = await r.json()
        if (!active) return
        const newOrders: OrderDTO[] = d.orders || []
        setOrders((prev) => {
          const sameSet = prev.length === newOrders.length && prev.every((o, i) => o.id === newOrders[i]?.id)
          return sameSet ? prev : newOrders
        })
      } catch (e) {
        // Network error — retry next tick.
      }
    }
    const interval = setInterval(poll, 10000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/orders?status=done')
      const d = await r.json()
      setOrders(d.orders || [])
    } finally {
      setLoading(false)
    }
  }

  async function pay(method: 'cash' | 'transfer', id: string) {
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, status: 'paid', payMethod: method, by: user?.name }),
      })
      const d = await r.json()
      if (!r.ok) {
        throw new Error(d.error)
      }
      broadcastOrderUpdate('cafe', d.order)
      setOrders((list) => list.filter((x) => x.id !== id))
      toast.success(`💰 ${user?.name} đã thu ${fmtVND(d.order.total)} (${method === 'cash' ? 'tiền mặt' : 'chuyển khoản'})`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const sum = orders.reduce((s, o) => s + o.total, 0)

  function openQrSheet(o: OrderDTO) {
    setQrOrder(o)
    setQrOpen(true)
  }

  function printReceipt(o: OrderDTO) {
    const w = window.open('', '_blank', 'width=320,height=600')
    if (!w) {
      toast.error('Trình duyệt chặn cửa sổ in')
      return
    }
    const items = o.items.map((it) => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${it.qty}× ${it.icon} ${it.name}${it.notes ? ` (${it.notes})` : ''}</span><b>${fmtVND(it.price * it.qty)}</b></div>`).join('')
    const d = new Date(o.createdAt)
    w.document.write(`
      <html><head><meta charset="utf-8"><title>${o.code}</title>
      <style>
        body{font-family:-apple-system,system-ui,sans-serif;padding:8px;font-size:13px;max-width:280px;margin:0 auto;color:#000}
        h1{font-size:18px;text-align:center;margin:4px 0}
        .meta{font-size:11px;text-align:center;color:#666;margin-bottom:8px}
        hr{border:none;border-top:1px dashed #999;margin:6px 0}
        .items > div{font-size:12px;margin:2px 0}
        .total{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-top:6px}
        .foot{text-align:center;font-size:10px;color:#666;margin-top:8px}
      </style></head><body>
        <h1>${useCafeStore.getState().cafeName}</h1>
        <div class="meta">Coffee &amp; Singing ☕🎶<br>
        ${d.toLocaleString('vi-VN')} · NV: ${o.by || '—'}</div>
        <hr>
        <div>Mã: <b>${o.code}</b> · ${o.type === 'stay' ? 'Tại chỗ' : 'Mang đi'}${o.tableCode ? ` · ${o.tableCode}` : ''}</div>
        <div>Khách: ${o.customer}</div>
        <hr>
        <div class="items">${items}</div>
        <hr>
        ${o.discount ? `<div style="display:flex;justify-content:space-between;font-size:12px"><span>Giảm giá (${o.discountCode})</span><b>-${fmtVND(o.discount)}</b></div>` : ''}
        <div class="total"><span>TỔNG</span><span>${fmtVND(o.total)}</span></div>
        <div class="foot">Cảm ơn quý khách!<br>Hẹn gặp lại ❤️</div>
        <script>window.print();window.onafterprint=()=>window.close();</script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-4 rounded-2xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)' }}></div>
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-90" style={{ fontFamily: 'var(--font-oswald)' }}>
              {orders.length} đơn chờ thanh toán
            </div>
            <b className="text-2xl count-up" style={{ fontFamily: 'var(--font-oswald)' }}>{fmtVND(sum)}</b>
          </div>
          {orders.length > 0 && (
            <div className="flex items-center gap-1 text-xs opacity-90 glow px-2 py-1 rounded-full bg-white/10">
              <Volume2 className="size-4 float" />
              <span>Cha-Ching</span>
            </div>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer h-24 rounded-2xl"></div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          Quầy pha bấm "Xong món" thì đơn sẽ hiện ở đây để thu tiền.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {orders.map((o) => (
              <motion.div
                layout
                key={o.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border rounded-2xl p-3 shadow-sm border-border"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mb-1.5">
                  <b className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-sm" style={{ fontFamily: 'var(--font-oswald)' }}>{o.code}</b>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold">
                    {o.type === 'take' ? '🥡' : '🏠'} {o.customer}
                  </span>
                  <span className="ml-auto font-mono">{fmtTime(o.createdAt)}</span>
                </div>
                <div className="text-sm text-muted-foreground mb-1">
                  {o.items.map((it, i) => (
                    <span key={i}>{i ? ' · ' : ''}{it.qty}× {it.icon} {it.name}</span>
                  ))}
                </div>
                <div className="text-primary font-bold text-base mb-2" style={{ fontFamily: 'var(--font-oswald)' }}>
                  {fmtVND(o.total)}
                  {o.discount > 0 && <span className="text-xs text-muted-foreground ml-2">(đã giảm {fmtVND(o.discount)})</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => printReceipt(o)} className="border-border">
                    <Printer className="size-3.5 mr-1" /> In bill
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 btn-push flex-1" onClick={() => pay('cash', o.id)}>
                    <Banknote className="size-3.5 mr-1" /> Tiền mặt
                  </Button>
                  <Button size="sm" className="btn-push flex-1" onClick={() => openQrSheet(o)}>
                    <Landmark className="size-3.5 mr-1" /> Chuyển khoản
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <QrPaymentSheet
        open={qrOpen}
        onOpenChange={setQrOpen}
        order={qrOrder}
        onConfirmPaid={(orderId) => void pay('transfer', orderId)}
      />
    </div>
  )
}
