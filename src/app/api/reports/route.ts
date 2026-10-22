import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }
function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// GET — báo cáo hôm nay (hoặc theo ngày)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const day = url.searchParams.get('day') || dayStr()
    const range = url.searchParams.get('range') // 7d, 30d

    // hôm nay
    const paidOrders = await db.order.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      include: { items: true },
    })
    const todaysPaid = paidOrders.filter((o) => {
      if (!o.paidAt) return false
      return dayStr(new Date(o.paidAt)) === day
    })

    let revenue = 0, cups = 0, cash = 0, transfer = 0, cashN = 0, transferN = 0
    const agg: Record<string, { q: number; revenue: number }> = {}
    const byStaff: Record<string, { sum: number; n: number; cash: number; transfer: number }> = {}

    for (const o of todaysPaid) {
      revenue += o.total
      if (o.payMethod === 'cash') { cash += o.total; cashN++ }
      else { transfer += o.total; transferN++ }
      for (const it of o.items) {
        cups += it.qty
        const key = `${it.icon} ${it.name}`
        if (!agg[key]) agg[key] = { q: 0, revenue: 0 }
        agg[key].q += it.qty
        agg[key].revenue += it.qty * it.price
      }
      const pb = o.paidBy || ''
      if (!byStaff[pb]) byStaff[pb] = { sum: 0, n: 0, cash: 0, transfer: 0 }
      byStaff[pb].sum += o.total
      byStaff[pb].n += 1
      if (o.payMethod === 'cash') byStaff[pb].cash += o.total
      else byStaff[pb].transfer += o.total
    }

    const top = Object.entries(agg)
      .sort((a, b) => b[1].q - a[1].q)
      .slice(0, 8)
      .map(([k, v]) => ({ name: k, ...v }))

    // đơn chưa thu (active)
    const activeOrders = await db.order.findMany({
      where: { status: { in: ['new', 'making', 'done'] }, day },
      include: { items: true },
    })
    const activeSum = activeOrders.reduce((s, o) => s + o.total, 0)

    const canceledCount = await db.order.count({ where: { status: 'canceled', day } })

    // chart 7 ngày
    const last7Days: { date: string; label: string; revenue: number; orders: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = dayStr(d)
      const dayPaid = paidOrders.filter((o) => o.paidAt && dayStr(new Date(o.paidAt)) === ds)
      const rev = dayPaid.reduce((s, o) => s + o.total, 0)
      last7Days.push({
        date: ds,
        label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
        revenue: rev,
        orders: dayPaid.length,
      })
    }

    // staff list
    const staff = await db.staff.findMany({ orderBy: { name: 'asc' } })
    const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
    const sessions = await db.session.findMany({ orderBy: { at: 'desc' }, take: 20 })

    const members = [
      { name: cafe?.adminName || 'Admin', role: 'admin', view: null, hasPin: !!cafe?.pinHash, lastLogin: null, loginCount: null, money: byStaff[cafe?.adminName || ''] || { sum: 0, n: 0, cash: 0, transfer: 0 } },
      ...staff.map((s) => ({
        id: s.id,
        name: s.name,
        role: 'staff' as const,
        view: s.view,
        hasPin: !!s.pinHash,
        onShift: s.onShift,
        notifyEnabled: s.notifyEnabled,
        lastLogin: s.lastLogin,
        loginCount: s.loginCount,
        money: byStaff[s.name] || { sum: 0, n: 0, cash: 0, transfer: 0 },
      })),
    ]

    // avg prep time (new→done)
    let avgPrep = 0
    let prepN = 0
    for (const o of activeOrders) {
      // we only have createdAt — would need timestamps; using placeholder
    }
    // simpler: get done orders today, compute createdAt -> updatedAt diff
    const doneOrders = await db.order.findMany({ where: { status: { in: ['done', 'paid'] }, day } })
    let totalPrepMs = 0
    let prepCount = 0
    for (const o of doneOrders) {
      const diff = new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()
      if (diff > 0 && diff < 60 * 60 * 1000) {
        totalPrepMs += diff
        prepCount++
      }
    }
    avgPrep = prepCount ? Math.round(totalPrepMs / prepCount / 1000 / 60) : 0

    return NextResponse.json({
      day,
      revenue,
      cups,
      paidCount: todaysPaid.length,
      activeCount: activeOrders.length,
      activeSum,
      canceledCount,
      cash, transfer, cashN, transferN,
      top,
      members,
      sessions,
      last7Days,
      avgPrepMin: avgPrep,
      prepCount,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
