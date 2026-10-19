import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }
function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// POST — đóng ca (Z-report)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { closedBy, note } = body
    if (!closedBy) return NextResponse.json({ error: 'Thiếu tên người đóng ca' }, { status: 400 })
    const day = dayStr()

    // tính toán
    const paidOrders = await db.order.findMany({
      where: { status: 'paid', paidAt: { not: null } },
      include: { items: true },
    })
    const todaysPaid = paidOrders.filter((o) => o.paidAt && dayStr(new Date(o.paidAt)) === day)
    const revenue = todaysPaid.reduce((s, o) => s + o.total, 0)
    const cashTotal = todaysPaid.filter((o) => o.payMethod === 'cash').reduce((s, o) => s + o.total, 0)
    const transferTotal = todaysPaid.filter((o) => o.payMethod === 'transfer').reduce((s, o) => s + o.total, 0)
    const cupsCount = todaysPaid.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0)
    const canceledCount = await db.order.count({ where: { status: 'canceled', day } })

    const close = await db.shiftClose.create({
      data: { closedBy, day, revenue, cashTotal, transferTotal, orderCount: todaysPaid.length, cupsCount, canceledCount, note: note || null },
    })

    // log session
    await db.session.create({ data: { name: closedBy, action: 'shift-close' } })

    return NextResponse.json({ ok: true, close })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET — lịch sử đóng ca
export async function GET() {
  try {
    const closes = await db.shiftClose.findMany({ orderBy: { closedAt: 'desc' }, take: 30 })
    return NextResponse.json({ closes })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
