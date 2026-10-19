'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { fmtVND, fmtTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getSocket, broadcastOrderUpdate } from '@/lib/socket-client'
import { Printer, Banknote, Landmark, Check } from 'lucide-react'
import type { OrderDTO } from './kitchen-view'

export function PayView() {
  const user = useCafeStore((s) => s.user)
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
    const socket = getSocket('cafe')
    const onNew = (o: OrderDTO) => {
      if (o.status === 'done') {
        setOrders((list) => [o, ...list.filter((x) => x.id !== o.id)])
      }
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
    return () => {
      socket.off('order:new', onNew)
      socket.off('order:update', onUpdate)
      socket.off('order:delete', onDelete)
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
      if (!r.ok) throw new Error(d.error)
      broadcastOrderUpdate('cafe', d.order)
      setOrders((list) => list.filter((x) => x.id !== id))
      toast.success(`💰 ${user?.name} đã thu ${fmtVND(d.order.total)} (${method === 'cash' ? 'tiền mặt' : 'chuyển khoản'})`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const sum = orders.reduce((s, o) => s + o.total, 0)

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
      <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-90" style={{ fontFamily: 'var(--font-oswald)' }}>
              {orders.length} đơn chờ thanh toán
            </div>
            <b className="text-xl" style={{ fontFamily: 'var(--font-oswald)' }}>{fmtVND(sum)}</b>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-6">Đang tải...</div>
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
                className="bg-card border border-border rounded-2xl p-3 shadow-sm"
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
                  <Button size="sm" className="btn-push flex-1" onClick={() => pay('transfer', o.id)}>
                    <Landmark className="size-3.5 mr-1" /> Chuyển khoản
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
