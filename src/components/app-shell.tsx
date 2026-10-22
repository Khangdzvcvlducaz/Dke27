'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { TABDEF, fmtVND } from '@/lib/format'
import { BrandLogo } from '@/components/brand-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'
import { Cloud, CloudOff, Lock, Moon, Sun, Sparkles, User } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'
import { PosView } from '@/components/views/pos-view'
import { KitchenView } from '@/components/views/kitchen-view'
import { PayView } from '@/components/views/pay-view'
import { ReportView } from '@/components/views/report-view'
import { LeaderboardView } from '@/components/views/leaderboard-view'
import { MenuManagerView } from '@/components/views/menu-manager-view'
import { AiChatSheet } from '@/components/ai-chat-sheet'
import { CartSheet } from '@/components/cart-sheet'
import { CartBar } from '@/components/cart-bar'
import { ProfileSheet } from '@/components/profile-sheet'
import type { LucideIcon } from 'lucide-react'

const ORDER_BADGES: Record<string, number> = { kitchen: 0, pay: 0 }

export function AppShell() {
  const { user, cafeName, adminName, logo, currentView, setCurrentView, logout, cloudOnline } = useCafeStore()
  const { theme, setTheme } = useTheme()
  const [kitchenCount, setKitchenCount] = useState(0)
  const [payCount, setPayCount] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Synchronous set of recently-announced order IDs — prevents double-Cha-Ching
  // when both socket 'order:new' AND polling fallback fire for the same order.
  // Each order triggers EXACTLY ONE Cha-Ching — not zero, not multiple.
  const seenOrderIdsRef = useRef<Set<string>>(new Set())

  /**
   * Cha-Ching sound filter — based on user role AND current view:
   *
   * - 'order:new' (cashier creates order, Shopify-style):
   *   → Heard by everyone EXCEPT kitchen staff (who hear Ho Ho Ho instead).
   *     Admin on any view hears it. POS staff (cashier) hears it as
   *     confirmation that the order was placed. Pay staff hears it as
   *     a heads-up that a new order is in the pipeline.
   *
   * - 'order:update status=done' (kitchen marks order ready for payment):
   *   → Heard ONLY when the user is currently on the PAY VIEW.
   *     - Pay staff (always on Pay view) → hears it (their job to collect)
   *     - Admin on Pay view → hears it (admin is acting as pay person)
   *     - Admin on POS/Report/Menu view → does NOT hear it (not collecting)
   *     - Cashier (POS view) → does NOT hear it (already moved to next customer)
   *     - Kitchen staff → does NOT hear it (they just finished making it)
   *
   * The "done" Cha-Ching is the pay person's signal — it fires only for
   * the person currently responsible for collecting money.
   */
  const shouldHearChaChingForNew = !!user && user.view !== 'kitchen'
  const shouldHearChaChingForDone = !!user && currentView === 'pay'

  /**
   * Play the "Cha-Ching Money" sound — uses Web Audio API instead of
   * HTMLAudioElement to bypass Chrome's strict autoplay policy.
   *
   * Chrome's autoplay policy: HTMLAudioElement.play() requires "user
   * activation" that lasts only ~5 seconds after a click. After 5s, all
   * subsequent play() calls fail with NotAllowedError — which is why
   * Cha-Ching only played for the FIRST order and not subsequent ones.
   *
   * Web Audio API's AudioContext.resume() also requires user activation,
   * BUT once resumed, the AudioContext stays active for the entire session.
   * We can create unlimited AudioBufferSourceNode instances and start()
   * them without any per-play user activation requirement. Each source
   * node is independent — multiple Cha-Chings can play in parallel
   * (overlapping), exactly what the user wants for multi-order scenarios.
   */
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const audioInitPromiseRef = useRef<Promise<void> | null>(null)

  async function initAudioContext(): Promise<void> {
    if (audioContextRef.current && audioBufferRef.current) return
    if (audioInitPromiseRef.current) return audioInitPromiseRef.current
    audioInitPromiseRef.current = (async () => {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext
        if (!Ctor) return
        const ctx = new Ctor()
        // IMPORTANT: set the ref IMMEDIATELY (before resume()).
        // ctx.resume() requires user activation and may hang if the
        // activation has expired. By setting the ref first, playChaChing()
        // can still use the context (and try to resume it) even if the
        // initial resume() didn't complete.
        audioContextRef.current = ctx
        // Decode the audio file — works even when context is suspended.
        const response = await fetch('/pay-notif.mp3')
        const arrayBuffer = await response.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)
        audioBufferRef.current = buffer
        // Try to resume the context (fire-and-forget, don't await — may hang).
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {})
        }
      } catch (e) {
        // Fall back to HTMLAudioElement in playChaChing() below.
      }
    })()
    return audioInitPromiseRef.current
  }

  // Listen for ALL user clicks/touches and try to resume the AudioContext.
  // Each click grants user activation — if the context is suspended,
  // resume() will succeed and the context will transition to 'running'.
  // Once running, it stays running for the entire session.
  useEffect(() => {
    const onResumeClick = () => {
      const ctx = audioContextRef.current
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {})
      }
    }
    document.addEventListener('click', onResumeClick)
    document.addEventListener('touchstart', onResumeClick)
    return () => {
      document.removeEventListener('click', onResumeClick)
      document.removeEventListener('touchstart', onResumeClick)
    }
  }, [])

  // Initialize the AudioContext ASAP. The user already clicked the login
  // button on the LockScreen (which is a user interaction that grants
  // sticky activation for ~5 seconds). By the time AppShell mounts, that
  // activation may still be valid — so we try to init immediately. If it
  // fails (activation expired), we also listen for the NEXT click/touch
  // to retry. Once the AudioContext is resumed successfully, it stays
  // active for the entire session — no per-play user activation needed.
  useEffect(() => {
    // Try to init immediately (user activation from login click may still be active).
    void initAudioContext()
    // Also listen for the next click/touch — if the immediate init failed
    // (e.g., user activation expired during login fetch), a subsequent
    // click will unlock the AudioContext.
    const onFirstInteraction = () => {
      void initAudioContext()
      document.removeEventListener('click', onFirstInteraction)
      document.removeEventListener('touchstart', onFirstInteraction)
    }
    document.addEventListener('click', onFirstInteraction)
    document.addEventListener('touchstart', onFirstInteraction)
    return () => {
      document.removeEventListener('click', onFirstInteraction)
      document.removeEventListener('touchstart', onFirstInteraction)
    }
  }, [])

  function playChaChing() {
    // Preferred path: Web Audio API (works without per-play user activation).
    const ctx = audioContextRef.current
    const buffer = audioBufferRef.current
    if (ctx && buffer) {
      if (ctx.state === 'running') {
        // Context is running — play immediately.
        try {
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(ctx.destination)
          source.start()
          return
        } catch (e) {}
      } else {
        // Context is suspended (user reopened app, hasn't clicked yet).
        // Try to resume — if user activation is available, this will work.
        // If not, the source.start() below runs but no sound is produced
        // (the context is suspended). The toast still shows, so the user
        // knows there's a new order. On their next click, the context
        // resumes and subsequent plays work.
        void ctx.resume().then(() => {
          if (ctx.state === 'running') {
            try {
              const source = ctx.createBufferSource()
              source.buffer = buffer!
              source.connect(ctx.destination)
              source.start()
            } catch (e) {}
          }
        }).catch(() => {})
        // Also try immediately (some browsers allow start on suspended context
        // and produce sound when the context is later resumed).
        try {
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(ctx.destination)
          source.start()
          return
        } catch (e) {}
      }
    }
    // Fallback: HTMLAudioElement (may fail with NotAllowedError if no
    // recent user interaction — but at least it works for the first few
    // plays after a click).
    try {
      const audio = new Audio('/pay-notif.mp3')
      audio.style.display = 'none'
      document.body.appendChild(audio)
      audio.addEventListener('ended', () => {
        try { document.body.removeChild(audio) } catch (e) {}
      })
      void audio.play().catch(() => {
        try { document.body.removeChild(audio) } catch (e) {}
      })
    } catch {}
  }

  // GLOBAL socket listener for Cha-Ching — fires based on the filters above.
  useEffect(() => {
    if (!user) return
    if (!shouldHearChaChingForNew && !shouldHearChaChingForDone) return
    const socket = getSocket('cafe')
    const handleOrderEvent = (o: { id: string; code: string; status: string; by?: string; total: number; customer?: string }) => {
      const isNew = o.status === 'new' || o.status === 'notified'
      const isDone = o.status === 'done'
      // Skip events we shouldn't hear based on role/view filter.
      if (isNew && !shouldHearChaChingForNew) return
      if (isDone && !shouldHearChaChingForDone) return
      if (!isNew && !isDone) return
      // Dedup: each order triggers exactly ONE Cha-Ching per event type.
      const key = `${o.id}:${o.status}`
      if (seenOrderIdsRef.current.has(key)) return
      seenOrderIdsRef.current.add(key)
      setTimeout(() => { seenOrderIdsRef.current.delete(key) }, 30000)
      playChaChing()
      if (isNew) {
        toast.success(`🔔 Đơn mới ${o.code} — ${o.by || 'Khách'}`)
      } else if (isDone) {
        toast.success(`💰 Đơn ${o.code} xong — chờ thu tiền ${fmtVND(o.total)}`)
      }
    }
    const onNew = (o: any) => handleOrderEvent(o)
    const onUpdate = (o: any) => handleOrderEvent(o)
    socket.on('order:new', onNew)
    socket.on('order:update', onUpdate)
    socket.on('connect', () => {
      socket.emit('join', 'cafe')
    })
    return () => {
      socket.off('order:new', onNew)
      socket.off('order:update', onUpdate)
      socket.off('connect')
    }
  }, [user, shouldHearChaChingForNew, shouldHearChaChingForDone])

  // POLLING FALLBACK for Cha-Ching: every 10s + on tab visibility change,
  // fetch all 'done' orders and detect any that arrived while the user was
  // away (tab closed, backgrounded, or socket missed the event). Play
  // Cha-Ching for each newly-detected 'done' order (deduped by orderId).
  //
  // This is CRITICAL for the "thoát app vào lại" (exit app and reopen)
  // scenario: when the user closes the tab, socket events are missed.
  // When they reopen the app, the polling catches up and plays Cha-Ching
  // for orders that became 'done' while they were away.
  useEffect(() => {
    if (!user) return
    if (!shouldHearChaChingForDone) return // only poll for pay view users
    let active = true
    const poll = async () => {
      if (!active) return
      try {
        const r = await fetch('/api/orders?status=done')
        const d = await r.json()
        if (!active) return
        const doneOrders: any[] = d.orders || []
        for (const o of doneOrders) {
          const key = `${o.id}:done`
          if (seenOrderIdsRef.current.has(key)) continue
          // New 'done' order detected via polling — play Cha-Ching.
          seenOrderIdsRef.current.add(key)
          setTimeout(() => { seenOrderIdsRef.current.delete(key) }, 30000)
          playChaChing()
          toast.success(`💰 Đơn ${o.code} xong — chờ thu tiền ${fmtVND(o.total)}`)
        }
      } catch {}
    }
    // Poll every 10 seconds.
    const interval = setInterval(poll, 10000)
    // Also poll when the tab becomes visible again (user reopens app).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    // Initial poll on mount (catch orders that became 'done' while user was away).
    void poll()
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, shouldHearChaChingForDone])

  // Wake Lock — keep the screen on so the tab doesn't sleep and miss
  // socket events (which would silence Cha-Ching in background tabs).
  // Released when user logs out or navigates away.
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!('wakeLock' in navigator)) return
    if (!user) return
    // Skip if user doesn't hear any Cha-Ching (e.g., kitchen staff).
    if (!shouldHearChaChingForNew && !shouldHearChaChingForDone) return
    let wakeLock: any = null
    const request = async () => {
      try { wakeLock = await (navigator as any).wakeLock.request('screen') } catch {}
    }
    void request()
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLock) void request()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (wakeLock?.release) { try { wakeLock.release() } catch {} }
      wakeLock = null
    }
  }, [user, shouldHearChaChingForNew, shouldHearChaChingForDone])

  // Handle deep links from notification clicks: ?open=kitchen&order=ID
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const openView = url.searchParams.get('open')
    if (openView && ['pos', 'kitchen', 'pay', 'report', 'leaderboard', 'menu'].includes(openView)) {
      const allowedViews = user?.role === 'admin'
        ? ['pos', 'kitchen', 'pay', 'report', 'leaderboard', 'menu']
        : [user?.view || 'pos', 'leaderboard']
      if (allowedViews.includes(openView)) {
        setCurrentView(openView)
      }
    }
    // Clean query so refresh doesn't re-trigger.
    if (url.searchParams.has('open')) {
      url.searchParams.delete('open')
      url.searchParams.delete('order')
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
    }
  }, [user, setCurrentView])

  const refreshBadges = useCallback(async () => {
    try {
      // Kitchen badge counts orders awaiting acceptance (new + notified).
      const r = await fetch('/api/orders?status=new')
      const d = await r.json()
      const newCount: number = d.orders?.length || 0
      const r2 = await fetch('/api/orders?status=notified')
      const d2 = await r2.json()
      const notifiedCount: number = d2.orders?.length || 0
      setKitchenCount(newCount + notifiedCount)
      const r3 = await fetch('/api/orders?status=done')
      const d3 = await r3.json()
      setPayCount(d3.orders?.length || 0)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    const socket = getSocket('cafe')
    // refresh badges on connect (initial fetch on mount — standard fetch+setState pattern)
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
  const allowedView: string[] = isAdmin ? ['pos', 'kitchen', 'pay', 'report', 'leaderboard', 'menu'] : [user.view || 'pos', 'leaderboard']
  // Report view is accessible to: admin + staff with view='report'
  // But staff with view='report' should NOT see the full admin report
  // (they see the same report page — it's read-only for them)
  const activeView = allowedView.includes(currentView) ? currentView : allowedView[0]

  function switchView(v: string) {
    if (!allowedView.includes(v)) return
    setCurrentView(v)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b-2 border-primary">
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
            {/* Profile + notifications settings — accessible to all staff */}
            <button
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent"
              onClick={() => setProfileOpen(true)}
              aria-label="Hồ sơ & thông báo"
              title="Hồ sơ & thông báo"
            >
              <User className="size-4" />
            </button>
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
            {activeView === 'leaderboard' && <LeaderboardView />}
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
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  )
}
