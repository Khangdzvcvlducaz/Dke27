'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { fmtVND } from '@/lib/format'
import { Upload, Trash2, Banknote, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { broadcastSettingsUpdate } from '@/lib/socket-client'
import type { OrderDTO } from './views/kitchen-view'

interface QrPaymentSheetProps {
  open: boolean
  onOpenChange: (b: boolean) => void
  order: OrderDTO | null
  onConfirmPaid: (orderId: string) => void
}

/**
 * Banking QR payment sheet — opens when the cashier clicks "Chuyển khoản"
 * on a pay-ready order. Shows the café's banking QR code so the customer
 * can scan it with their banking app.
 *
 * Permission model:
 *   - Admin (role === 'admin'): can upload / replace / clear the QR image.
 *   - Staff (role === 'staff'): can only VIEW the QR (read-only).
 *
 * The QR is stored once per café (in the Cafe table) and reused for every
 * transfer-payment order — admin uploads it once in the settings or right
 * here the first time.
 */
export function QrPaymentSheet({ open, onOpenChange, order, onConfirmPaid }: QrPaymentSheetProps) {
  const user = useCafeStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open) void loadQr()
  }, [open])

  async function loadQr() {
    try {
      const r = await fetch('/api/settings')
      const d = await r.json()
      setQrCode(d.qrCode || null)
    } catch (e) {
      // ignore
    }
  }

  async function uploadQr(file: File) {
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const img = new Image()
        img.onload = async () => {
          // Resize to max 600px to keep payload small (QR doesn't need hi-res).
          const MAX = 600
          const sc = Math.min(1, MAX / Math.max(img.width, img.height))
          const cv = document.createElement('canvas')
          cv.width = Math.round(img.width * sc)
          cv.height = Math.round(img.height * sc)
          cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
          const data = cv.toDataURL('image/png')
          if (data.length > 2500000) {
            toast.error('Ảnh QR quá lớn — giảm kích thước hoặc nén lại')
            setUploading(false)
            return
          }
          try {
            const r = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'setQrCode', qrCode: data }),
            })
            const d = await r.json()
            if (!r.ok) throw new Error(d.error)
            setQrCode(data)
            broadcastSettingsUpdate('cafe')
            toast.success('✓ Đã lưu QR chuyển khoản — mọi thiết bị sẽ thấy')
          } catch (e) {
            toast.error((e as Error).message)
          } finally {
            setUploading(false)
          }
        }
        img.onerror = () => {
          toast.error('File không phải ảnh hợp lệ')
          setUploading(false)
        }
        img.src = reader.result as string
      }
      reader.onerror = () => {
        toast.error('Không đọc được file')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (e) {
      toast.error((e as Error).message)
      setUploading(false)
    }
  }

  async function clearQr() {
    if (!confirm('Xóa QR chuyển khoản?')) return
    setUploading(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearQrCode' }),
      })
      setQrCode(null)
      broadcastSettingsUpdate('cafe')
      toast.success('Đã xóa QR')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[90vh] flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-dashed border-border">
          <SheetTitle className="uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-oswald)' }}>
            🏦 Chuyển khoản — {order?.code}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Order summary */}
          {order && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground uppercase">Tổng tiền</div>
              <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'var(--font-oswald)' }}>
                {fmtVND(order.total)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Khách: {order.customer}
                {order.tableCode && ` · ${order.tableCode}`}
              </div>
            </div>
          )}

          {/* QR display / upload */}
          <div>
            <Label>QR ngân hàng</Label>
            {qrCode ? (
              <div className="space-y-2">
                <div className="bg-white rounded-xl p-4 flex items-center justify-center border border-border">
                  <img src={qrCode} alt="QR chuyển khoản" className="max-w-[280px] w-full h-auto" />
                </div>
                {isAdmin ? (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                      <label className="cursor-pointer">
                        {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                        Thay QR khác
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void uploadQr(f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </Button>
                    <Button variant="outline" onClick={clearQr} disabled={uploading} className="text-destructive border-destructive">
                      <Trash2 className="size-4 mr-1" /> Xóa
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    Chỉ Admin mới được thay QR. Yêu cầu Admin tải lên nếu cần.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-muted/50 border-2 border-dashed border-border rounded-xl p-6 text-center">
                <ImageIcon className="size-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Chưa có QR chuyển khoản</p>
                {isAdmin ? (
                  <Button asChild className="btn-push">
                    <label className="cursor-pointer">
                      {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                      Tải QR lên
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void uploadQr(f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Yêu cầu Admin vào mục <b>Cài đặt</b> để tải QR lên trước.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-100">
            <b>📲 Hướng dẫn khách:</b>
            <ol className="list-decimal pl-4 mt-1 space-y-0.5">
              <li>Mở app ngân hàng trên điện thoại.</li>
              <li>Quét mã QR bên trên.</li>
              <li>Kiểm tra số tiền khớp với tổng: <b>{order ? fmtVND(order.total) : ''}</b></li>
              <li>Xác nhận chuyển khoản.</li>
            </ol>
          </div>
        </div>

        <SheetFooter className="border-t border-dashed border-border px-4 py-3 pb-safe flex-col gap-2">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 btn-push"
            disabled={loading || !order}
            onClick={() => {
              if (order) {
                onConfirmPaid(order.id)
                onOpenChange(false)
              }
            }}
          >
            <Banknote className="size-4 mr-1" /> Đã nhận tiền chuyển khoản
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            <X className="size-4 mr-1" /> Đóng
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
