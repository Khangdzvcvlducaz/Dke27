'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCafeStore } from '@/store/cafe-store'
import { TABDEF } from '@/lib/format'
import { BrandLogo } from '@/components/brand-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'
import { Cloud, CloudOff, Lock, Moon, Sun, Sparkles } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'
import { PosView } from '@/components/views/pos-view'
import { KitchenView } from '@/components/views/kitchen-view'
import { PayView } from '@/components/views/pay-view'
import { ReportView } from '@/components/views/report-view'
import { MenuManagerView } from '@/components/views/menu-manager-view'
import { AiChatSheet } from '@/components/ai-chat-sheet'
import { CartSheet } from '@/components/cart-sheet'
import { CartBar } from '@/components/cart-bar'
import type { LucideIcon } from 'lucide-react'

const ORDER_BADGES: Record<string, number> = { kitchen: 0, pay: 0 }

export function AppShell() {
  const { user, cafeName, adminName, logo, currentView, setCurrentView, logout, cloudOnline } = useCafeStore()
  const { theme, setTheme } = useTheme()
  const [kitchenCount, setKitchenCount] = useState(0)
  const [payCount, setPayCount] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)

  const refreshBadges = useCallback(async () => {
    try {
      const r = await fetch('/api/orders?status=new')
      const d = await r.json()
      setKitchenCount(d.orders?.length || 0)
      const r2 = await fetch('/api/orders?status=done')
      const d2 = await r2.json()
      setPayCount(d2.orders?.length || 0)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    const socket = getSocket('cafe')
    // refresh badges on connect (initial fetch on mount)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshBadges()
    const interval = setInterval(() => { void refreshBadges() }, 10000)
    // Refresh on socket events
    const refresh = () => { void refreshBadges() }
    socket.on('order:new', refresh)
    socket.on('order:update', refresh)
    socket.on('order:delete', refresh)
    return () => {
      clearInterval(interval)
      socket.off('order:new', refresh)
      socket.off('order:update', refresh)
      socket.off('order:delete', refresh)
    }
  }, [user, refreshBadges])

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const allowedView: string[] = isAdmin ? ['pos', 'kitchen', 'pay', 'report', 'menu'] : [user.view || 'pos']
  const activeView = allowedView.includes(currentView) ? currentView : allowedView[0]

  function switchView(v: string) {
    if (!allowedView.includes(v)) return
    setCurrentView(v)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b-2 border-primary">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo variant="mini" logoUrl={logo} cafeName={cafeName} />
            <div className="flex flex-col min-w-0">
              <b className="text-sm sm:text-base font-semibold uppercase tracking-wide truncate" style={{ fontFamily: 'var(--font-oswald)' }}>
                {cafeName}
              </b>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Đổi giao diện"
              title="Sáng / Tối"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-1.5"
              onClick={() => setChatOpen(true)}
              title="Trợ lý AI"
            >
              <Sparkles className="size-4 text-primary" />
              Trợ lý AI
            </Button>
            <button
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent"
              aria-label="Trạng thái cloud"
              title={cloudOnline ? 'Đã kết nối cloud' : 'Chế độ máy đơn'}
            >
              {cloudOnline ? <Cloud className="size-4 text-primary" /> : <CloudOff className="size-4" />}
            </button>
            <span className="bg-accent border border-primary text-primary px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
              {isAdmin ? '👑 ' : '👤 '}{user.name}
            </span>
            <button
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent"
              onClick={() => {
                void logout()
                if (typeof window !== 'undefined') location.reload()
              }}
              aria-label="Khóa / Đăng xuất"
              title="Đăng xuất"
            >
              <Lock className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 pb-32 sm:pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'pos' && <PosView />}
            {activeView === 'kitchen' && <KitchenView />}
            {activeView === 'pay' && <PayView />}
            {activeView === 'report' && isAdmin && <ReportView />}
            {activeView === 'menu' && isAdmin && <MenuManagerView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer - always sticky */}
      <footer className="mt-auto border-t border-border bg-card/60 text-center text-xs text-muted-foreground py-2">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-2">
          <span style={{ fontFamily: 'var(--font-oswald)' }} className="uppercase tracking-widest">
            {cafeName} · Coffee &amp; Singing ☕🎶
          </span>
        </div>
      </footer>

      {/* Mobile bottom tabbar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid bg-card border-t-2 border-primary pb-safe" style={{ gridTemplateColumns: `repeat(${allowedView.length}, 1fr)` }}>
        {allowedView.map((v) => {
          const [ic, label] = TABDEF[v] || ['', v]
          const on = activeView === v
          return (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 text-xs font-semibold rounded-lg ${on ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {on && <span className="absolute -top-0.5 w-6 h-1 rounded-b-full bg-primary" />}
              <span className="text-xl leading-none">{ic}</span>
              <span>{label}</span>
              {v === 'kitchen' && kitchenCount > 0 && (
                <span className="absolute top-0 right-[calc(50%-22px)] bg-primary text-white text-[10px] px-1 rounded-full border border-card">
                  {kitchenCount}
                </span>
              )}
              {v === 'pay' && payCount > 0 && (
                <span className="absolute top-0 right-[calc(50%-22px)] bg-primary text-white text-[10px] px-1 rounded-full border border-card">
                  {payCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Cart bar (POS only) */}
      <CartBar />

      {/* Sheets */}
      <CartSheet />
      <AiChatSheet open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}
