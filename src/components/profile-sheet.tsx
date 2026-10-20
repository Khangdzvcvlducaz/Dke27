'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Bell, BellRing, Loader2, Send, Trash2,
  Power, Smartphone, Apple, Info, ShieldCheck,
} from 'lucide-react'
import { useCafeStore } from '@/store/cafe-store'

interface ProfileSheetProps {
  open: boolean
  onOpenChange: (b: boolean) => void
}

type PermState = 'default' | 'granted' | 'denied' | 'unsupported'

interface StaffState {
  id?: string
  onShift?: boolean
  notifyEnabled?: boolean
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const user = useCafeStore((s) => s.user)
  const [perm, setPerm] = useState<PermState>('default')
  const [busy, setBusy] = useState(false)
  const [staff, setStaff] = useState<StaffState>({})
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [iosDevice, setIosDevice] = useState(false)

  const refreshPermission = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setPerm('unsupported')
      return
    }
    setPerm(Notification.permission as PermState)
  }, [])

  const refreshSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSubscription(null)
      return
    }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscription(sub)
    } catch (e) {
      setSubscription(null)
    }
  }, [])

  const refreshStaff = useCallback(async () => {
    if (!user?.staffId) return
    try {
      const r = await fetch('/api/staff')
      const d = await r.json()
      const me = (d.staff || []).find((s: { id: string; onShift: boolean; notifyEnabled: boolean }) => s.id === user.staffId)
      if (me) setStaff(me)
    } catch (e) {
      // ignore
    }
  }, [user])

  useEffect(() => {
    refreshPermission()
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)
    setIosDevice(/iPad|iPhone|iPod/.test(navigator.userAgent) && !((window as any).MSStream))
  }, [refreshPermission])

  useEffect(() => {
    if (open) {
      void refreshPermission()
      void refreshSubscription()
      void refreshStaff()
      // Listen for SW telling us the subscription expired.
      const onExpired = () => {
        setSubscription(null)
        toast.info('Thiết bị cần đăng ký nhận thông báo lại')
      }
      window.addEventListener('push-subscription-expired', onExpired)
      return () => window.removeEventListener('push-subscription-expired', onExpired)
    }
  }, [open, refreshPermission, refreshSubscription, refreshStaff])

  /**
   * Request notification permission ONLY after the user has clicked this button.
   * We never call Notification.requestPermission() on page load.
   */
  async function handleEnable() {
    if (!user?.staffId) {
      toast.error('Chỉ nhân viên mới có thể bật thông báo')
      return
    }
    if (perm === 'denied') {
      toast.error('Quyền đã bị từ chối — mở Settings trình duyệt để cấp lại')
      return
    }
    if (perm === 'unsupported') {
      toast.error('Trình duyệt này không hỗ trợ thông báo')
      return
    }
    setBusy(true)
    try {
      // 1. Request permission.
      const result = await Notification.requestPermission()
      refreshPermission()
      if (result !== 'granted') {
        toast.error('Bạn đã từ chối thông báo. Mở Settings trình duyệt để cấp lại.')
        return
      }

      // 2. Make sure SW is ready.
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error('Trình duyệt này không hỗ trợ Push')
        return
      }
      const reg = await navigator.serviceWorker.ready

      // 3. Get VAPID public key from backend.
      const r = await fetch('/api/push/vapid')
      const vd = await r.json()
      if (!vd.publicKey) {
        toast.error('Chưa cấu hình VAPID — liên hệ quản trị viên')
        return
      }
      const key = urlBase64ToUint8Array(vd.publicKey)

      // 4. Subscribe.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
      setSubscription(sub)

      // 5. Persist to backend.
      const subJson = sub.toJSON()
      const r2 = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: user.staffId,
          subscription: {
            endpoint: subJson.endpoint,
            keys: { p256dh: subJson.keys!.p256dh, auth: subJson.keys!.auth },
          },
        }),
      })
      const d2 = await r2.json()
      if (!r2.ok) throw new Error(d2.error)
      void refreshStaff()
      toast.success('✓ Đã bật thông báo đơn mới')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    try {
      if (subscription) {
        // Unsubscribe from push service (so device stops receiving push).
        await subscription.unsubscribe()
      }
      // Tell backend to remove this device's subscription.
      if (user?.staffId) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: user.staffId }),
        })
      }
      setSubscription(null)
      void refreshStaff()
      toast.success('Đã tắt thông báo trên thiết bị này')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleTest() {
    if (!user?.staffId) return
    setBusy(true)
    try {
      const r = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: user.staffId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast.success(`Đã gửi ${d.sent} thông báo thử${d.failed ? ` · ${d.failed} lỗi` : ''}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleShift(on: boolean) {
    if (!user?.staffId) return
    try {
      const r = await fetch('/api/staff/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: user.staffId, onShift: on }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setStaff((s) => ({ ...s, onShift: on }))
      toast.success(on ? 'Đang trên ca — sẽ nhận thông báo đơn mới' : 'Đã nghỉ ca — không nhận thông báo')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Helpers for display
  const permBadge = () => {
    if (perm === 'granted') return <Badge className="bg-emerald-600 text-white">Đã bật</Badge>
    if (perm === 'denied') return <Badge variant="destructive">Bị chặn</Badge>
    if (perm === 'unsupported') return <Badge variant="secondary">Không hỗ trợ</Badge>
    return <Badge variant="outline">Chưa yêu cầu</Badge>
  }

  const isAdmin = user?.role === 'admin'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[90vh] flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
            <Bell className="size-4" /> Hồ sơ &amp; thông báo
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scroll-coffee p-4 space-y-4">
          {/* Identity */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground uppercase">Nhân viên</div>
            <div className="text-lg font-bold mt-0.5">
              {isAdmin ? '👑 ' : '👤 '}{user?.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {isAdmin ? 'Quản trị viên — truy cập mọi mục' : 'Nhân viên'}
            </div>
          </div>

          {/* Notifications section */}
          {!isAdmin ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
                  <BellRing className="size-4" /> Thông báo đơn mới
                </h3>
                {permBadge()}
              </div>

              {/* State-aware message */}
              {perm === 'denied' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-lg p-3 text-xs space-y-1">
                  <b>⚠ Quyền thông báo đã bị chặn</b>
                  <p>Để bật lại:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><b>Chrome/Edge (Android)</b>: mở menu ⋮ → Settings → Site settings → Notifications → cho phép.</li>
                    <li><b>Safari (iOS)</b>: cài app vào màn hình chính, mở Settings iOS → App → Notifications → bật.</li>
                    <li><b>Chrome (Desktop)</b>: nhấp 🔒 bên thanh адрес → Site settings → Notifications → Allow.</li>
                  </ul>
                </div>
              )}
              {perm === 'unsupported' && (
                <div className="bg-muted border border-border rounded-lg p-3 text-xs">
                  Trình duyệt này không hỗ trợ Web Push. Vui lòng dùng Chrome (Android), Edge, hoặc Safari 16.4+ (iOS) cài app vào màn hình chính.
                </div>
              )}
              {perm === 'default' && (
                <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs">
                  Bấm nút bên dưới để xin quyền. Bạn sẽ thấy thông báo khi có đơn mới cần pha — kể cả khi tab đang đóng.
                </div>
              )}
              {perm === 'granted' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 rounded-lg p-3 text-xs">
                  <ShieldCheck className="size-3.5 inline mr-1" />
                  Đã bật thông báo. Đơn mới sẽ rung và báo trên thiết bị này.
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                {!subscription ? (
                  <Button
                    className="btn-push"
                    onClick={handleEnable}
                    disabled={busy || perm === 'denied' || perm === 'unsupported'}
                  >
                    {busy ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Bell className="size-4 mr-1" />}
                    Bật thông báo đơn mới
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleTest} disabled={busy} className="btn-push">
                      {busy ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
                      Gửi thông báo thử
                    </Button>
                    <Button variant="outline" onClick={handleDisable} disabled={busy} className="text-destructive border-destructive">
                      <Trash2 className="size-4 mr-1" /> Gỡ thiết bị này
                    </Button>
                  </>
                )}
              </div>

              {/* Shift toggle */}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Power className="size-4" /> Trên ca</h4>
                  <p className="text-xs text-muted-foreground">Tắt để không nhận thông báo khi nghỉ.</p>
                </div>
                <Switch
                  checked={!!staff.onShift}
                  onCheckedChange={toggleShift}
                  disabled={busy}
                />
              </div>
            </section>
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs">
              Quản trị viên không nhận thông báo đơn. Mở mục <b>Báo cáo</b> để xem nhân viên trên ca và trạng thái thông báo.
            </div>
          )}

          {/* Add to Home Screen guidance */}
          <Separator />
          <section className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
              <Smartphone className="size-4" /> Cài app vào màn hình chính
            </h3>
            {standalone ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 rounded-lg p-3 text-xs">
                ✓ App đang chạy chế độ PWA. Thông báo sẽ hoạt động khi tab đóng.
              </div>
            ) : (
              <>
                {iosDevice ? (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100 rounded-lg p-3 text-xs space-y-1">
                    <b><Apple className="size-3 inline mr-1" /> iOS Safari</b>
                    <p>1. Bấm nút <b>Share</b> (hình vuông mũi tên lên) trong Safari.</p>
                    <p>2. Chọn <b>"Add to Home Screen"</b>.</p>
                    <p>3. Mở app từ màn hình chính, bật thông báo như trên.</p>
                    <p className="text-muted italic">iOS 16.4+ hỗ trợ Web Push chỉ khi chạy từ màn hình chính.</p>
                  </div>
                ) : (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs">
                    <b>Chrome/Edge (Android)</b>: menu ⋮ → <b>"Install app"</b> / <b>"Add to Home screen"</b>.
                    <br />
                    <b>Chrome (Desktop)</b>: biểu tượng cài đặt trên thanh địa chỉ, hoặc menu ⋮ → <b>"Install..."</b>.
                  </div>
                )}
              </>
            )}
          </section>

          <Separator />
          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <p>
              Thông báo dùng Web Push chuẩn (RFC 8030). Rung chỉ hoạt động trên thiết bị hỗ trợ Vibration API (Android). iOS tôn trọng Settings hệ thống (DND, rung, âm thanh).
            </p>
          </div>
        </div>

        <SheetFooter className="border-t border-border px-4 py-3 pb-safe">
          <Button className="w-full btn-push" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// Convert base64url to Uint8Array for applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
