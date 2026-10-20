'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/brand-logo'
import { useTheme } from '@/components/theme-provider'
import { Moon, Sun, Cloud, CloudOff } from 'lucide-react'
import { useCafeStore } from '@/store/cafe-store'
import { getSocket } from '@/lib/socket-client'
import { autoEnablePush } from '@/lib/push-client'

export function LockScreen() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const setCafe = useCafeStore((s) => s.setCafe)
  const setUser = useCafeStore((s) => s.setUser)
  const setCurrentView = useCafeStore((s) => s.setCurrentView)
  const setCloudOnline = useCafeStore((s) => s.setCloudOnline)

  const [initialized, setInitialized] = useState(false)
  const [cafeName, setCafeNameState] = useState('Đông Không Em?')
  const [adminName, setAdminName] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [cloudOk, setCloudOk] = useState(false)

  const [pin, setPin] = useState('')
  const [me, setMe] = useState('')
  const [loginPin, setLoginPin] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const r = await fetch('/api/auth')
      const data = await r.json()
      setInitialized(!!data.initialized)
      setCafeNameState(data.cafeName || 'Đông Không Em?')
      setAdminName(data.adminName || 'Admin')
      setCafe({ name: data.cafeName, adminName: data.adminName })
      // load settings for logo
      try {
        const s = await fetch('/api/settings')
        const sd = await s.json()
        setLogo(sd.logo)
        setCafe({ logo: sd.logo })
      } catch {}
      // try connect to realtime
      try {
        getSocket('cafe')
        setCloudOnline(true)
        setCloudOk(true)
      } catch {
        setCloudOnline(false)
        setCloudOk(false)
      }
    } catch (e) {
      toast.error('Không tải được dữ liệu quán')
    }
  }

  async function handleCreate() {
    if (!adminName.trim()) return toast.error('Nhập tên Admin')
    if (!/^\d{4}$/.test(pin)) return toast.error('PIN phải 4 chữ số')
    setLoading(true)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', cafeName: cafeName || 'Đông Không Em?', adminName, pin }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setUser({ name: adminName, role: 'admin', view: null })
      setCurrentView('pos')
      setCafe({ name: cafeName, adminName })
      toast.success(`Chào ${adminName}! Nhóm đã được tạo.`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!me.trim()) return toast.error('Nhập tên của bạn')
    if (!/^\d{4}$/.test(loginPin)) return toast.error('PIN phải 4 chữ số')
    setLoading(true)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', name: me, pin: loginPin }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setUser({ name: data.name, role: data.role, view: data.view, staffId: data.staffId })
      setCurrentView(data.role === 'admin' ? 'pos' : data.view || 'pos')
      if (typeof window !== 'undefined') localStorage.setItem('cfh-me', data.name)
      toast.success(`Chào ${data.name}!`)
      // AUTO-ENABLE push notifications for staff (not admin — admin doesn't
      // have a staffId or push subscription). This must be called within
      // the user activation window (~5 seconds after the login click).
      // The fetch above takes <1s, so the activation is still valid.
      if (data.role === 'staff' && data.staffId) {
        void autoEnablePush(data.staffId)
      }
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Snowflake decorations */}
      <span className="snowflake absolute text-primary/15 pointer-events-none text-2xl" style={{ top: '8%', left: '10%' }}>❄</span>
      <span className="snowflake absolute text-primary/15 pointer-events-none text-xl" style={{ top: '16%', right: '12%', animationDelay: '1.2s' }}>❄</span>
      <span className="snowflake absolute text-primary/15 pointer-events-none text-lg" style={{ bottom: '14%', left: '16%', animationDelay: '0.6s' }}>❄</span>
      <span className="snowflake absolute text-primary/15 pointer-events-none text-2xl" style={{ bottom: '20%', right: '9%', animationDelay: '1.8s' }}>❄</span>
      <span className="snowflake absolute text-primary/15 pointer-events-none text-sm" style={{ top: '44%', left: '4%', animationDelay: '2.4s' }}>❄</span>
      <span className="snowflake absolute text-primary/15 pointer-events-none text-sm" style={{ top: '52%', right: '5%', animationDelay: '0.9s' }}>❄</span>

      {/* Theme toggle */}
      <button
        className="absolute top-4 right-4 z-10 p-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Đổi giao diện sáng/tối"
      >
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-[2] w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl relative">
          <div className="absolute top-0 left-6 right-6 h-1.5 rounded-b-md bg-primary" />
          <div className="pt-2 pb-1 flex justify-center">
            <BrandLogo variant="full" logoUrl={logo} cafeName={cafeName} />
          </div>
          <h1 className="text-center text-2xl font-bold mt-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-oswald)' }}>
            {initialized ? cafeName : 'Quản lý đơn hàng'}
          </h1>
          <p className="text-center text-xs text-muted-foreground mb-4 mt-1">
            {initialized ? `Dùng chung nhiều thiết bị qua cloud` : `Đông Không Em? — dùng chung nhiều thiết bị qua cloud`}
          </p>

          {/* Cloud status */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
            {cloudOk ? (
              <>
                <Cloud className="size-3.5 text-primary" />
                <span>Đã kết nối cloud</span>
              </>
            ) : (
              <>
                <CloudOff className="size-3.5" />
                <span>Đang dùng chế độ máy đơn</span>
              </>
            )}
          </div>

          {!initialized ? (
            // Create new group
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div>
                <Label>Tên quán / nhóm</Label>
                <Input
                  value={cafeName}
                  onChange={(e) => setCafeNameState(e.target.value)}
                  placeholder="VD: Đông Không Em?"
                />
              </div>
              <div>
                <Label>Tên bạn (Quản trị viên)</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="VD: An" />
              </div>
              <div>
                <Label>Mã PIN Admin (4 chữ số)</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                />
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full btn-push" size="lg">
                {loading ? 'Đang tạo...' : 'Tạo nhóm & vào làm Admin'}
              </Button>
              <div className="bg-accent/60 border border-primary text-accent-foreground rounded-lg p-2.5 text-xs font-semibold mt-2">
                👑 Bạn là Admin duy nhất — truy cập mọi mục. Nhân viên do bạn tạo, mỗi người chỉ vào 1 mục.
              </div>
            </motion.div>
          ) : (
            // Login
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div>
                <Label>Tên của bạn</Label>
                <Input value={me} onChange={(e) => setMe(e.target.value)} placeholder="Tên đã đăng ký" />
              </div>
              <div>
                <Label>Mã PIN (4 chữ số)</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <Button onClick={handleLogin} disabled={loading} className="w-full btn-push" size="lg">
                {loading ? 'Đang vào...' : 'Vào làm việc'}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-2">
                👑 Admin: mã PIN quản trị · Nhân viên: mã do Admin cấp
              </p>
              <button
                className="block mx-auto text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => {
                  if (typeof window === 'undefined') return
                  if (confirm('Xóa dữ liệu trên máy này, bắt đầu lại?')) {
                    localStorage.clear()
                    location.reload()
                  }
                }}
              >
                Xóa dữ liệu máy này
              </button>
            </motion.div>
          )}
        </div>
        <div className="text-center mt-4 text-xs uppercase tracking-[0.4em] text-muted-foreground" style={{ fontFamily: 'var(--font-oswald)' }}>
          Coffee &amp; Singing ☕🎶
        </div>
      </motion.div>
    </div>
  )
}
