'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { broadcastStaffUpdate } from '@/lib/socket-client'

interface StaffDTO {
  id: string
  name: string
  view: string
  hasPin: boolean
  lastLogin: string | null
  loginCount: number
}

interface StaffSheetProps {
  open: boolean
  onOpenChange: (b: boolean) => void
  name: string
}

export function StaffSheet({ open, onOpenChange, name }: StaffSheetProps) {
  const [staff, setStaff] = useState<StaffDTO | null>(null)
  const [pin, setPin] = useState('')
  const [view, setView] = useState('pos')

  useEffect(() => {
    if (!name || !open) return
    void load()
  }, [name, open])

  async function load() {
    try {
      const r = await fetch('/api/staff')
      const d = await r.json()
      const s = (d.staff || []).find((x: StaffDTO) => x.name === name)
      if (s) {
        setStaff(s)
        setView(s.view || 'pos')
        setPin('')
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function save() {
    if (!staff) return
    try {
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: staff.id, pin: pin || undefined, view }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastStaffUpdate('cafe')
      onOpenChange(false)
      window.dispatchEvent(new Event('report-refresh'))
      toast.success(`✓ Đã cập nhật ${staff.name}${pin ? ' · mã mới đã đặt' : ''}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function del() {
    if (!staff) return
    if (!confirm(`Xóa "${staff.name}"?`)) return
    try {
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: staff.id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastStaffUpdate('cafe')
      onOpenChange(false)
      window.dispatchEvent(new Event('report-refresh'))
      toast.success(`Đã xóa ${staff.name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="px-4 py-4 border-b border-dashed border-border">
          <SheetTitle className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-oswald)' }}>
            Phân quyền — {staff?.name}
          </SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-3">
          <div>
            <Label>Tên nhân viên</Label>
            <Input value={staff?.name || ''} disabled />
          </div>
          <div>
            <Label>Đổi mã PIN (để trống = giữ mã cũ)</Label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4 chữ số"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mã hiện tại: {staff?.hasPin ? 'đã đặt ✓' : 'chưa có — nhân viên chưa đăng nhập được'}
            </p>
          </div>
          <div>
            <Label>Mục được phép truy cập</Label>
            <Select value={view} onValueChange={setView}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pos">🧾 Tạo đơn</SelectItem>
                <SelectItem value="kitchen">☕ Quầy pha</SelectItem>
                <SelectItem value="pay">💵 Thu tiền</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="px-4 py-3 border-t border-dashed border-border pb-safe flex-col gap-2">
          <Button className="w-full btn-push" onClick={save}>Lưu thay đổi</Button>
          <Button variant="outline" className="w-full text-primary border-primary" onClick={del}>Xóa thành viên</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
