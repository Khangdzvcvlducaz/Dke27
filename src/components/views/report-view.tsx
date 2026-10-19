'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCafeStore } from '@/store/cafe-store'
import { fmtVND, fmtDateTime, VIEWIC, VIEWNAME } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import { Download, Plus, Trash2, Pencil, Banknote, Landmark, TrendingUp, Coffee, Clock } from 'lucide-react'
import { broadcastStaffUpdate } from '@/lib/socket-client'
import { StaffSheet } from '@/components/staff-sheet'

interface ReportData {
  day: string
  revenue: number
  cups: number
  paidCount: number
  activeCount: number
  activeSum: number
  canceledCount: number
  cash: number
  transfer: number
  cashN: number
  transferN: number
  top: { name: string; q: number; revenue: number }[]
  members: {
    name: string
    role: 'admin' | 'staff'
    view: string | null
    hasPin: boolean
    lastLogin: string | null
    loginCount: number | null
    money: { sum: number; n: number; cash: number; transfer: number }
  }[]
  sessions: { id: string; name: string; action: string; at: string }[]
  last7Days: { date: string; label: string; revenue: number; orders: number }[]
  avgPrepMin: number
  prepCount: number
}

const CHART_COLORS = ['#b3202c', '#2f6b3f', '#c9973f', '#3b82c4', '#7a4d2b', '#8a5a12', '#8a7563', '#a0a0a0']

export function ReportView() {
  const user = useCafeStore((s) => s.user)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    void load()
  }, [day])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/reports?day=${day}`)
      const d = await r.json()
      setData(d)
    } catch {
      toast.error('Không tải được báo cáo')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const isAdmin = user?.role === 'admin'

  function exportCsv() {
    window.location.href = `/api/export?type=orders&day=${day}`
  }

  async function closeShift() {
    if (!confirm('Đóng ca hôm nay và tạo Z-report?')) return
    try {
      const r = await fetch('/api/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedBy: user?.name, note: '' }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast.success(`✓ Đã đóng ca. Doanh thu: ${fmtVND(d.close.revenue)}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold uppercase tracking-wide" style={{ fontFamily: 'var(--font-oswald)' }}>
          📊 Báo cáo
        </h2>
        <div className="flex gap-2 items-center">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-auto" />
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={closeShift} className="border-primary text-primary">
            Đóng ca
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp className="size-4" />} label="Doanh thu" value={fmtVND(data.revenue)} />
        <StatCard icon={<Banknote className="size-4" />} label="Đơn đã thu" value={`${data.paidCount}`} />
        <StatCard icon={<Coffee className="size-4" />} label="Số ly / món" value={`${data.cups}`} />
        <StatCard icon={<Clock className="size-4" />} label="Chưa thu" value={`${data.activeCount} đơn`} sub={fmtVND(data.activeSum)} />
      </div>

      {/* Revenue 7 days chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📈 Doanh thu 7 ngày gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.last7Days}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(v) => (v / 1000) + 'k'} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v: number) => [fmtVND(v), 'Doanh thu']}
              />
              <Bar dataKey="revenue" name="Doanh thu" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top items + payment split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">🔥 Top món bán chạy</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.top.length === 0 ? (
              <div className="text-muted-foreground text-center py-6 text-sm">Chưa có dữ liệu</div>
            ) : (
              data.top.map((t, i) => {
                const max = data.top[0].q
                return (
                  <div key={t.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{i + 1}. {t.name}</span>
                      <b className="font-mono" style={{ fontFamily: 'var(--font-oswald)' }}>{t.q} · {fmtVND(t.revenue)}</b>
                    </div>
                    <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(t.q / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">💳 Phân loại thanh toán</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Tiền mặt', value: data.cash, color: CHART_COLORS[0] },
                    { name: 'Chuyển khoản', value: data.transfer, color: CHART_COLORS[1] },
                  ].filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {[0, 1].map((i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtVND(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-sm space-y-1 mt-2">
              <div className="flex justify-between">
                <span className="flex items-center gap-1"><Banknote className="size-3.5" /> Tiền mặt</span>
                <b>{data.cashN} đơn · {fmtVND(data.cash)}</b>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1"><Landmark className="size-3.5" /> Chuyển khoản</span>
                <b>{data.transferN} đơn · {fmtVND(data.transfer)}</b>
              </div>
              {data.canceledCount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>❌ Đơn đã hủy</span><b>{data.canceledCount}</b>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avg prep time */}
      <Card>
        <CardHeader><CardTitle className="text-base">⏱️ Hiệu suất bếp</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase">Thời gian pha TB</div>
            <b className="text-xl text-primary" style={{ fontFamily: 'var(--font-oswald)' }}>
              {data.avgPrepMin} phút
            </b>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Số đơn đã xong</div>
            <b className="text-xl" style={{ fontFamily: 'var(--font-oswald)' }}>{data.prepCount}</b>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      {isAdmin && <MembersSection data={data} />}

      {/* Sessions log */}
      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">🕓 Lịch sử hoạt động</CardTitle></CardHeader>
          <CardContent>
            {data.sessions.length === 0 ? (
              <div className="text-muted-foreground text-center py-4 text-sm">Chưa có lịch sử</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto scroll-coffee">
                {data.sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-dashed border-border last:border-0">
                    <span className="font-mono text-muted-foreground text-xs">{fmtDateTime(s.at)}</span>
                    <span><b>{s.name}</b> {s.action === 'in' ? 'vào làm việc' : s.action === 'out' ? 'khóa ứng dụng' : 'đóng ca'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      <CardContent className="p-3 pt-4">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </div>
        <b className="block mt-1 text-lg md:text-xl" style={{ fontFamily: 'var(--font-oswald)' }}>{value}</b>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function MembersSection({ data }: { data: ReportData }) {
  const user = useCafeStore((s) => s.user)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [nmName, setNmName] = useState('')
  const [nmPin, setNmPin] = useState('')
  const [nmView, setNmView] = useState('pos')

  async function addMember() {
    if (!nmName.trim()) return toast.error('Nhập tên nhân viên')
    try {
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: nmName, pin: nmPin || undefined, view: nmView }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastStaffUpdate('cafe')
      setNmName(''); setNmPin(''); setNmView('pos')
      toast.success(d.staff.pinHash !== null ? `Đã thêm ${nmName}` : `Đã thêm ${nmName} — nhớ cấp mã PIN`)
      // trigger parent refresh
      window.dispatchEvent(new Event('report-refresh'))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(`Xóa "${name}" khỏi nhóm?`)) return
    try {
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      broadcastStaffUpdate('cafe')
      window.dispatchEvent(new Event('report-refresh'))
      toast.success(`Đã xóa ${name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">👥 Thành viên &amp; phân quyền</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.members.map((m) => (
            <div key={m.name} className={`flex items-center gap-2 bg-card border rounded-xl p-2.5 ${m.name === user?.name ? 'border-primary bg-accent/40' : 'border-border'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-sm">👤 {m.name}</b>
                  {m.name === user?.name && <span className="bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full">Bạn</span>}
                  {m.role === 'admin' ? (
                    <Badge className="text-[10px]">👑 Quản trị</Badge>
                  ) : m.view ? (
                    <Badge variant="outline" className="text-[10px]">{VIEWIC[m.view]} {VIEWNAME[m.view]}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">⚠ chưa phân mục</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {m.role === 'admin'
                    ? 'Admin truy cập mọi mục'
                    : `Đăng nhập: ${fmtDateTime(m.lastLogin)} · ${m.loginCount || 0} lần${m.hasPin ? '' : ' · chưa có mã'}`}
                </div>
                <div className="text-xs mt-0.5 text-muted-foreground">
                  Tạm thu: <b className="text-primary">{fmtVND(m.money.sum)}</b> ({m.money.n} đơn)
                </div>
              </div>
              {m.role === 'staff' && (
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(m.name); setSheetOpen(true) }}>
                    <Pencil className="size-3" /> Sửa
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-primary border-primary" onClick={() => deleteMember(m.name, m.name)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-dashed border-border">
          <Label className="mb-2">+ Thêm nhân viên mới</Label>
          <div className="flex gap-2 flex-wrap">
            <Input value={nmName} onChange={(e) => setNmName(e.target.value)} placeholder="Tên nhân viên" className="flex-1 min-w-[150px]" />
            <Input
              value={nmPin}
              onChange={(e) => setNmPin(e.target.value.replace(/\D/g, ''))}
              maxLength={4}
              placeholder="PIN 4 số"
              className="w-24"
            />
            <Select value={nmView} onValueChange={setNmView}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pos">🧾 Tạo đơn</SelectItem>
                <SelectItem value="kitchen">☕ Quầy pha</SelectItem>
                <SelectItem value="pay">💵 Thu tiền</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addMember} className="btn-push"><Plus className="size-4 mr-1" /> Thêm</Button>
          </div>
        </div>
      </CardContent>

      <StaffSheet open={sheetOpen} onOpenChange={(b) => { setSheetOpen(b); if (!b) setEditing(null) }} name={editing || ''} />
    </Card>
  )
}
