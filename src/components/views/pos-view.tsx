'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useCafeStore, cartCount } from '@/store/cafe-store'
import { fmtVND } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Mic, ShoppingCart } from 'lucide-react'
import { VoiceInputButton } from '@/components/voice-input-button'

export interface MenuItemDTO {
  id: string
  icon: string
  name: string
  price: number
  available: boolean
  imageUrl?: string | null
  sortOrder: number
}

export function PosView() {
  const addToCart = useCafeStore((s) => s.addToCart)
  const setCartSheetOpen = useCafeStore((s) => s.setCartSheetOpen)
  const cart = useCafeStore((s) => s.cart)

  const [items, setItems] = useState<MenuItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/menu')
      const d = await r.json()
      setItems(d.items || [])
    } catch {
      toast.error('Không tải được menu')
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(
    (m) => !query || m.name.toLowerCase().includes(query.toLowerCase())
  )

  function handleAdd(m: MenuItemDTO) {
    if (!m.available) {
      toast.error(`${m.name} đang hết`)
      return
    }
    addToCart({ menuId: m.id, icon: m.icon, name: m.name, price: m.price })
  }

  async function onVoiceTranscript(text: string) {
    setQuery(text)
    // try match items by name keywords
    const matched = items.filter((m) => {
      const t = text.toLowerCase()
      return m.name.toLowerCase().split(/\s+/).some((w) => w.length > 2 && t.includes(w))
    })
    if (matched.length) {
      for (const m of matched.slice(0, 3)) {
        if (m.available) addToCart({ menuId: m.id, icon: m.icon, name: m.name, price: m.price })
      }
      toast.success(`Đã thêm ${matched.length} món từ giọng nói`)
    } else {
      toast.info('Không nhận ra món, dùng thanh tìm kiếm')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
          🧾 Chọn món
          <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
        </h2>
        {cart.length > 0 && (
          <Button size="sm" onClick={() => setCartSheetOpen(true)} className="btn-push gap-1">
            <ShoppingCart className="size-4" />
            {cartCount(cart)} · {fmtVND(cart.reduce((s, c) => s + c.price * c.qty, 0))}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm món theo tên..."
            className="pl-9"
          />
        </div>
        <VoiceInputButton onTranscript={onVoiceTranscript} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {items.length === 0 ? 'Chưa có món nào trong menu.' : `Không thấy món "${query}"`}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((m, i) => (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleAdd(m)}
              disabled={!m.available}
              className={`group relative bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5 min-h-[140px] justify-center text-center transition-all hover:border-primary hover:shadow-md active:scale-95 ${!m.available ? 'opacity-50' : ''}`}
            >
              {m.imageUrl ? (
                <img src={m.imageUrl} alt={m.name} className="absolute inset-0 w-full h-full object-cover rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
              ) : null}
              <span className="text-3xl relative z-10">{m.icon}</span>
              <span className="text-sm font-semibold leading-tight relative z-10">{m.name}</span>
              <span className="text-primary font-bold text-sm tracking-wide relative z-10" style={{ fontFamily: 'var(--font-oswald)' }}>
                {fmtVND(m.price)}
              </span>
              {!m.available && <Badge variant="destructive" className="absolute top-2 right-2 z-20 text-[10px]">Hết</Badge>}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
