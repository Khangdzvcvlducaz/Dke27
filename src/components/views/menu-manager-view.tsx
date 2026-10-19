'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { fmtVND } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Upload, Trash2, Plus, Image as ImageIcon, Save, Wrench, Tag, Table2 } from 'lucide-react'
import { broadcastMenuUpdate, broadcastSettingsUpdate } from '@/lib/socket-client'

interface MenuItemDTO {
  id: string
  icon: string
  name: string
  price: number
  available: boolean
  imageUrl?: string | null
  sortOrder: number
}

export function MenuManagerView() {
  return (
    <div className="space-y-6">
      <MenuManager />
      <TablesManager />
      <DiscountsManager />
      <SettingsManager />
    </div>
  )
}

function MenuManager() {
  const [items, setItems] = useState<MenuItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [newIcon, setNewIcon] = useState('')
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')

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

  async function add() {
    if (!newName || !newPrice) return toast.error('Nhập tên và giá')
    try {
      const r = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', icon: newIcon || '☕', name: newName, price: Number(newPrice) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastMenuUpdate('cafe')
      setNewIcon(''); setNewName(''); setNewPrice('')
      await load()
      toast.success(`Đã thêm ${d.item.name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function updateItem(id: string, patch: Partial<MenuItemDTO>) {
    try {
      const r = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...patch }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastMenuUpdate('cafe')
      setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function remove(id: string) {
    if (!confirm('Xóa món này khỏi menu?')) return
    try {
      const r = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastMenuUpdate('cafe')
      setItems((list) => list.filter((it) => it.id !== id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function generateImage(item: MenuItemDTO) {
    try {
      toast.info(`Đang sinh ảnh cho ${item.name}...`)
      const r = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${item.name} Vietnamese coffee drink` }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      await updateItem(item.id, { imageUrl: d.imageUrl })
      toast.success(`✓ Đã sinh ảnh cho ${item.name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="size-4" /> Quản lý menu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="☕" maxLength={4} className="w-16 text-center" />
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên món mới" className="flex-1 min-w-[150px]" />
          <Input value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ''))} placeholder="Giá" className="w-28" inputMode="numeric" />
          <Button onClick={add} className="btn-push"><Plus className="size-4 mr-1" /> Thêm</Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto scroll-coffee">
            {items.map((m) => (
              <div key={m.id} className={`flex items-center gap-2 bg-card border border-border rounded-xl p-2.5 ${!m.available ? 'opacity-60' : ''}`}>
                <span className="text-2xl shrink-0">{m.icon}</span>
                <Input
                  defaultValue={m.name}
                  onBlur={(e) => e.target.value !== m.name && updateItem(m.id, { name: e.target.value })}
                  className="flex-1 min-w-0"
                />
                <Input
                  type="number"
                  defaultValue={m.price}
                  onBlur={(e) => Number(e.target.value) !== m.price && updateItem(m.id, { price: Number(e.target.value) })}
                  className="w-24"
                />
                <Switch
                  checked={m.available}
                  onCheckedChange={(b) => updateItem(m.id, { available: b })}
                  title={m.available ? 'Còn bán' : 'Hết'}
                />
                <Button size="sm" variant="outline" onClick={() => generateImage(m)} title="Sinh ảnh AI" disabled={!m.available}>
                  <Sparkles className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-primary border-primary" onClick={() => remove(m.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TablesManager() {
  const [tables, setTables] = useState<{ id: string; code: string; seats: number; status: string }[]>([])
  const [newCode, setNewCode] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      const r = await fetch('/api/tables')
      const d = await r.json()
      setTables(d.tables || [])
    } catch {}
  }

  async function add() {
    if (!newCode) return toast.error('Nhập mã bàn')
    try {
      const r = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', code: newCode }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setNewCode('')
      await load()
      toast.success(`Đã thêm ${d.table.code}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function toggleStatus(t: { id: string; status: string; code: string }) {
    const next = t.status === 'free' ? 'occupied' : 'free'
    try {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: t.id, status: next }),
      })
      await load()
    } catch {}
  }

  async function remove(id: string) {
    if (!confirm('Xóa bàn này?')) return
    try {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      await load()
    } catch {}
  }

  async function resetAll() {
    if (!confirm('Đặt lại tất cả bàn về "Trống"?')) return
    await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    await load()
    toast.success('Đã reset tất cả bàn')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Table2 className="size-4" /> Quản lý bàn</span>
          <Button size="sm" variant="outline" onClick={resetAll}>Reset tất cả</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="VD: Bàn 7" className="flex-1" />
          <Button onClick={add} className="btn-push"><Plus className="size-4 mr-1" /> Thêm</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {tables.map((t) => (
            <div key={t.id} className={`border rounded-xl p-2 text-center ${t.status === 'occupied' ? 'border-primary bg-accent/40' : 'border-border bg-card'}`}>
              <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-oswald)' }}>{t.code}</div>
              <div className="text-xs text-muted-foreground mb-1.5">{t.seats} chỗ · {t.status === 'free' ? 'Trống' : 'Có khách'}</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => toggleStatus(t)}>
                  {t.status === 'free' ? 'Đặt' : 'Trống'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 text-primary border-primary p-0" onClick={() => remove(t.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DiscountsManager() {
  const [discounts, setDiscounts] = useState<{ id: string; code: string; kind: string; value: number; active: boolean; note: string | null }[]>([])
  const [newCode, setNewCode] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newKind, setNewKind] = useState<'percent' | 'amount'>('percent')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      const r = await fetch('/api/discounts')
      const d = await r.json()
      setDiscounts(d.discounts || [])
    } catch {}
  }

  async function add() {
    if (!newCode || !newValue) return toast.error('Nhập mã và giá trị')
    try {
      const r = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', code: newCode.toUpperCase(), kind: newKind, value: Number(newValue) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setNewCode(''); setNewValue('')
      await load()
      toast.success(`Đã thêm mã ${newCode.toUpperCase()}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function toggle(d: { id: string; active: boolean }) {
    await fetch('/api/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: d.id, active: !d.active }),
    })
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Xóa mã giảm giá này?')) return
    await fetch('/api/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="size-4" /> Mã giảm giá
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3 flex-wrap">
          <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="VD: SUMMER10" className="flex-1 min-w-[150px]" />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as 'percent' | 'amount')} className="px-3 py-2 rounded-md border border-input bg-card">
            <option value="percent">% giảm</option>
            <option value="amount">Số tiền</option>
          </select>
          <Input value={newValue} onChange={(e) => setNewValue(e.target.value.replace(/\D/g, ''))} placeholder="Giá trị" className="w-28" inputMode="numeric" />
          <Button onClick={add} className="btn-push"><Plus className="size-4 mr-1" /> Thêm</Button>
        </div>
        {discounts.length === 0 ? (
          <div className="text-muted-foreground text-center py-4 text-sm border border-dashed border-border rounded-xl">
            Chưa có mã giảm giá nào
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {discounts.map((d) => (
              <div key={d.id} className={`border rounded-xl p-2.5 ${d.active ? 'border-primary bg-accent/40' : 'border-border opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <b className="font-mono text-primary" style={{ fontFamily: 'var(--font-oswald)' }}>{d.code}</b>
                  <Switch checked={d.active} onCheckedChange={() => toggle(d)} />
                </div>
                <div className="text-sm mt-1">
                  Giảm <b>{d.kind === 'percent' ? `${d.value}%` : fmtVND(d.value)}</b>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary mt-1 p-0" onClick={() => remove(d.id)}>Xóa</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SettingsManager() {
  const { cafeName, adminName, logo, setCafe } = useCafeStore()
  const [name, setName] = useState(cafeName)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')

  useEffect(() => {
    setName(cafeName)
  }, [cafeName])

  async function saveName() {
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setName', name }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastSettingsUpdate('cafe')
      setCafe({ name })
      toast.success('Đã lưu tên quán')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function savePin() {
    if (!/^\d{4}$/.test(newPin)) return toast.error('PIN mới phải 4 số')
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setPin', pin: newPin, oldPin: oldPin || undefined }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastSettingsUpdate('cafe')
      setOldPin(''); setNewPin('')
      toast.success('Đã đổi mã PIN Admin')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function uploadLogo(file: File) {
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const img = new Image()
        img.onload = async () => {
          const MAX = 480
          const sc = Math.min(1, MAX / Math.max(img.width, img.height))
          const cv = document.createElement('canvas')
          cv.width = Math.round(img.width * sc)
          cv.height = Math.round(img.height * sc)
          cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
          const data = cv.toDataURL('image/png')
          if (data.length > 2500000) {
            toast.error('Ảnh quá lớn')
            return
          }
          const r = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'setLogo', logo: data }),
          })
          const d = await r.json()
          if (!r.ok) throw new Error(d.error)
          broadcastSettingsUpdate('cafe')
          setCafe({ logo: data })
          toast.success('Logo đã lưu — mọi thiết bị sẽ thấy')
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function clearLogo() {
    if (!confirm('Gỡ logo?')) return
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearLogo' }),
    })
    broadcastSettingsUpdate('cafe')
    setCafe({ logo: null })
    toast.success('Đã gỡ logo')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Save className="size-4" /> Cài đặt (Admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Tên quán</Label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Button onClick={saveName} className="btn-push">Lưu</Button>
          </div>
        </div>

        <div>
          <Label>Logo quán</Label>
          {logo && (
            <div className="mb-2 p-3 border border-border rounded-xl bg-card flex items-center justify-center">
              <img src={logo} alt="Logo" className="max-h-24 w-auto" />
            </div>
          )}
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <label className="cursor-pointer">
                <Upload className="size-4 mr-1 inline" /> Tải logo lên
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
              </label>
            </Button>
            {logo && (
              <Button variant="outline" className="text-primary border-primary" onClick={clearLogo}>
                <Trash2 className="size-4" /> Gỡ
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Logo lưu trên server — tải lên 1 lần, mọi thiết bị đều thấy.</p>
        </div>

        <div>
          <Label>Mã PIN của Admin</Label>
          <div className="flex gap-2 flex-wrap">
            <Input type="tel" inputMode="numeric" maxLength={4} value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN cũ" className="w-32" />
            <Input type="tel" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN mới" className="w-32" />
            <Button onClick={savePin} className="btn-push">Lưu</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">PIN lưu dưới dạng hash (bcrypt) — an toàn hơn.</p>
        </div>

        <div className="pt-3 border-t border-dashed border-border">
          <Label className="text-amber-700">Xuất dữ liệu</Label>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => window.open('/api/export?type=orders')}>Đơn hàng CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/api/export?type=menu')}>Menu CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/api/export?type=staff')}>Nhân viên CSV</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
