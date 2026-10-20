'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { fmtVND, fmtTime, minsAgo } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getSocket, broadcastOrderUpdate } from '@/lib/socket-client'
import { Play, Check, X, Clock, Flame, Hourglass } from 'lucide-react'

export interface OrderDTO {
  id: string
  code: string
  day: string
  customer: string
  tableCode: string | null
  type: string
  status: string
  total: number
  discount: number
  discountCode: string | null
  note: string | null
  payMethod: string | null
  paidAt: string | null
  by: string | null
  paidBy: string | null
  createdAt: string
  updatedAt: string
  items: { id: string; icon: string; name: string; price: number; qty: number; notes: string | null }[]
}

export function KitchenView() {
  const user = useCafeStore((s) => s.user)
  const [wait, setWait] = useState<OrderDTO[]>([])
  const [making, setMaking] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
    const socket = getSocket('cafe')
    const onNew = (o: OrderDTO) => {
      setWait((w) => {
        if (w.some((x) => x.id === o.id)) return w
        return [o, ...w]
      })
      if (o.by !== user?.name) {
        toast.success(`🔔 Đơn mới ${o.code} — ${o.by}`)
        tryBeep()
      }
    }
    const onUpdate = (o: OrderDTO) => {
      setWait((w) => w.filter((x) => x.id !== o.id))
      setMaking((m) => {
        const exists = m.some((x) => x.id === o.id)
        if (o.status === 'making') {
          if (exists) return m.map((x) => (x.id === o.id ? o : x))
          return [o, ...m]
        }
        if (o.status === 'done' || o.status === 'paid' || o.status === 'canceled') {
          return m.filter((x) => x.id !== o.id)
        }
        return m
      })
      if (o.status === 'new' || o.status === 'notified') {
        setWait((w) => (w.some((x) => x.id === o.id) ? w : [o, ...w]))
      }
    }
    const onDelete = ({ id }: { id: string }) => {
      setWait((w) => w.filter((x) => x.id !== id))
      setMaking((m) => m.filter((x) => x.id !== id))
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
      // Wait column = orders awaiting acceptance (new OR notified).
      const r = await fetch('/api/orders?status=new')
      const d = await r.json()
      const waitList: OrderDTO[] = d.orders || []
      const r2 = await fetch('/api/orders?status=notified')
      const d2 = await r2.json()
      const notifiedList: OrderDTO[] = d2.orders || []
      // Notified orders appear first (waiting longest), then new.
      const merged = [...notifiedList, ...waitList.filter((n) => !notifiedList.some((no) => no.id === n.id))]
      setWait(merged)
      const r3 = await fetch('/api/orders?status=making')
      const d3 = await r3.json()
      setMaking(d3.orders || [])
    } finally {
      setLoading(false)
    }
  }

  async function doAction(act: 'start' | 'finish' | 'cancel', id: string) {
    try {
      if (act === 'start') {
        // "Start making" = accept for preparation (uses accept endpoint,
        // which is also reachable from the SW notification action).
        const user = useCafeStore.getState().user
        const r = await fetch('/api/orders/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: id, staffId: user?.staffId, staffName: user?.name }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        broadcastOrderUpdate('cafe', d.order)
        setWait((w) => w.filter((x) => x.id !== id))
        if (!d.alreadyAccepted) {
          setMaking((m) => [d.order, ...m])
          toast.success(`Bắt đầu pha ${d.order.code}`)
        } else {
          toast.info(`${d.order.code} đã có người nhận`)
        }
      } else {
        const status = act === 'finish' ? 'done' : 'canceled'
        const r = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', id, status }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        broadcastOrderUpdate('cafe', d.order)
        if (act === 'finish') {
          setMaking((m) => m.filter((x) => x.id !== id))
          toast.success(`✓ ${d.order.code} xong — chờ thu tiền`)
        } else {
          setWait((w) => w.filter((x) => x.id !== id))
          setMaking((m) => m.filter((x) => x.id !== id))
          toast(`Đã hủy ${d.order.code}`)
        }
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-oswald)' }}>
        ☕ Quầy pha
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wait column */}
        <div>
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide" style={{ fontFamily: 'var(--font-oswald)' }}>
              <Hourglass className="size-4 text-amber-600" />
              Chờ pha
            </div>
            <Badge variant="secondary">{wait.length}</Badge>
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {wait.map((o) => (
                <KitchenCard key={o.id} order={o} onAction={doAction} />
              ))}
            </AnimatePresence>
            {wait.length === 0 && !loading && <EmptyState msg="Hết đơn chờ 🎉" />}
          </div>
        </div>

        {/* Making column */}
        <div>
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide text-primary" style={{ fontFamily: 'var(--font-oswald)' }}>
              <Flame className="size-4" />
              Đang pha
            </div>
            <Badge>{making.length}</Badge>
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {making.map((o) => (
                <KitchenCard key={o.id} order={o} onAction={doAction} />
              ))}
            </AnimatePresence>
            {making.length === 0 && !loading && <EmptyState msg="Chưa có món đang pha" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="text-center text-muted-foreground py-8 border border-dashed border-border rounded-xl text-sm">
      {msg}
    </div>
  )
}

function KitchenCard({ order, onAction }: { order: OrderDTO; onAction: (act: 'start' | 'finish' | 'cancel', id: string) => void }) {
  // Late = waiting over 8 min (covers both 'new' and 'notified' states).
  const late = (order.status === 'new' || order.status === 'notified') && minsAgo(order.createdAt) > 8
  const mins = minsAgo(order.createdAt)
  const isNotified = order.status === 'notified'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`ticket-cut bg-card border border-border rounded-2xl p-3 shadow-sm relative ${late ? 'border-primary border-2' : ''} ${order.status === 'making' ? 'border-primary' : ''} ${isNotified ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <b className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-sm" style={{ fontFamily: 'var(--font-oswald)' }}>{order.code}</b>
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs">
          {order.type === 'take' ? '🥡 Mang đi' : '🏠 Tại chỗ'}
        </span>
        {order.tableCode && <Badge variant="outline" className="text-xs">{order.tableCode}</Badge>}
        {isNotified && <Badge variant="secondary" className="text-xs">🔔 Đã gửi thông báo</Badge>}
        <span className="ml-auto font-mono flex items-center gap-1">
          <Clock className="size-3" /> {fmtTime(order.createdAt)}
          {mins > 0 && <span className={mins > 8 ? 'text-primary font-bold' : ''}>({mins}p)</span>}
        </span>
      </div>

      <div className="font-bold mt-1.5 mb-1 text-sm">
        {order.customer}
        {order.by && <span className="text-muted-foreground font-normal"> · {order.by}</span>}
      </div>

      <ul className="text-base leading-relaxed list-disc pl-5 mb-2 space-y-0.5">
        {order.items.map((it, i) => (
          <li key={i}>
            <b>{it.qty}×</b> {it.icon} {it.name}
            {it.notes && <span className="text-primary font-semibold"> — {it.notes}</span>}
          </li>
        ))}
      </ul>

      <div className="text-primary font-bold text-base mb-1" style={{ fontFamily: 'var(--font-oswald)' }}>
        {fmtVND(order.total)}
      </div>

      <div className="border-t border-dashed border-border pt-2 mt-1 flex gap-2">
        {order.status === 'new' || order.status === 'notified' ? (
          <Button size="sm" className="btn-push flex-1" onClick={() => onAction('start', order.id)}>
            <Play className="size-3.5 mr-1" /> {isNotified ? 'Nhận pha' : 'Bắt đầu pha'}
          </Button>
        ) : (
          <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => onAction('finish', order.id)}>
            <Check className="size-3.5 mr-1" /> Xong món
          </Button>
        )}
        <Button size="sm" variant="outline" className="text-primary border-primary" onClick={() => {
          if (confirm(`Hủy ${order.code}?`)) onAction('cancel', order.id)
        }}>
          <X className="size-3.5" />
        </Button>
      </div>
    </motion.div>
  )
}

function tryBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = ctx.currentTime
    ;[0, 0.18].forEach((off) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 900
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.exponentialRampToValueAtTime(0.35, t + off + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.16)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(t + off)
      o.stop(t + off + 0.2)
    })
  } catch {}
}
