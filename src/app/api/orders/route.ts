import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendNewOrderPush } from '@/lib/push'
import { broadcastOrderNew, broadcastOrderUpdate } from '@/lib/socket-server-broadcast'

export const runtime = 'nodejs'

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// GET — danh sách đơn (filter theo status, day)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const day = url.searchParams.get('day')
    const where: { status?: string; day?: string } = {}
    if (status) where.status = status
    if (day) where.day = day
    const orders = await db.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    return NextResponse.json({ orders })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST — tạo đơn mới hoặc cập nhật trạng thái
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { customer, type, tableCode, items, by, device, discountCode, note } = body
      if (!items?.length) return NextResponse.json({ error: 'Đơn không có món' }, { status: 400 })

      const day = todayStr()
      const dayCount = await db.order.count({ where: { day } })
      const code = `#${pad2(dayCount + 1)}`

      // validate discount
      let discount = 0
      let usedCode: string | null = null
      if (discountCode) {
        const d = await db.discount.findFirst({ where: { code: discountCode, active: true } })
        if (d) {
          usedCode = d.code
          const subtotal = items.reduce((s: number, i: any) => s + i.price * i.qty, 0)
          if (d.kind === 'percent') discount = Math.round((subtotal * d.value) / 100)
          else discount = Math.min(d.value, subtotal)
        }
      }

      const subtotal = items.reduce((s: number, i: any) => s + i.price * i.qty, 0)
      const total = Math.max(0, subtotal - discount)

      const order = await db.order.create({
        data: {
          code,
          day,
          customer: customer || 'Khách lẻ',
          tableCode: tableCode || null,
          type: type || 'stay',
          status: 'new',
          total,
          discount,
          discountCode: usedCode,
          note: note || null,
          by: by || null,
          device: device || null,
          items: {
            create: items.map((i: any) => ({
              menuId: i.menuId || null,
              icon: i.icon,
              name: i.name,
              price: i.price,
              qty: i.qty,
              notes: i.notes?.length ? i.notes.join(', ') : null,
            })),
          },
        },
        include: { items: true },
      })

      // update table status
      if (tableCode) {
        await db.table.updateMany({ where: { code: tableCode }, data: { status: 'occupied' } })
      }

      // Mark the order as "notified" (delivery sent) — distinct from "accepted for preparation".
      // Send Web Push to eligible on-shift drink-prep staff. Best-effort: failures
      // are logged but never block the order creation. The order is visible and
      // actionable in the dashboard regardless of push delivery.
      try {
        await sendNewOrderPush({
          id: order.id,
          code: order.code,
          customer: order.customer,
          tableCode: order.tableCode,
          type: order.type,
          items: order.items.map((i: any) => ({ icon: i.icon, name: i.name, qty: i.qty, notes: i.notes })),
        })
        await db.order.update({ where: { id: order.id }, data: { notifiedAt: new Date(), status: 'notified' } })
        order.status = 'notified'
        order.notifiedAt = new Date()
      } catch (e) {
        // Push failed — order remains in 'new' status, still visible in dashboard.
        console.error('[orders] push send failed:', (e as Error).message)
      }

      // SERVER-SIDE BROADCAST (not client-side): ensures the kitchen view
      // receives the new-order event regardless of whether the cashier's
      // browser tab is active, suspended, or the client-side broadcast fails.
      // This is the authoritative source of truth — the client-side broadcast
      // in cart-sheet.tsx is a backup for the optimistic-UI case.
      try {
        broadcastOrderNew('cafe', {
          ...order,
          // Make sure items are included so kitchen view can render immediately.
          items: order.items.map((i: any) => ({
            id: i.id,
            icon: i.icon,
            name: i.name,
            price: i.price,
            qty: i.qty,
            notes: i.notes,
          })),
        })
      } catch (e) {
        // Socket broadcast failed — clients will catch up on next poll.
        console.warn('[orders] server-side broadcast failed:', (e as Error).message)
      }

      return NextResponse.json({ ok: true, order })
    }

    if (action === 'update') {
      const { id, status, payMethod, by } = body
      const order = await db.order.findUnique({ where: { id }, include: { items: true } })
      if (!order) return NextResponse.json({ error: 'Không thấy đơn' }, { status: 404 })

      const data: { status: string; payMethod?: string | null; paidAt?: Date; paidBy?: string | null } = {
        status: status || order.status,
      }
      if (status === 'paid') {
        data.payMethod = payMethod || 'cash'
        data.paidAt = new Date()
        data.paidBy = by || null
        // free up table if assigned
        if (order.tableCode) {
          await db.table.updateMany({ where: { code: order.tableCode }, data: { status: 'free' } })
        }
      }
      const updated = await db.order.update({ where: { id }, data, include: { items: true } })
      return NextResponse.json({ ok: true, order: updated })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
