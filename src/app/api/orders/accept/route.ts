import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { broadcastOrderUpdate } from '@/lib/socket-server-broadcast'

export const runtime = 'nodejs'

/**
 * POST /api/orders/accept
 * Body: { orderId, staffId, staffName }
 *
 * Called from:
 *   - The service worker "Accept" notification action (data + notification click)
 *   - The kitchen view "Accept" button
 *
 * This is the explicit acceptance step that moves the order from "notified"
 * (delivery sent) to "making" (accepted for preparation). Push delivery is
 * NOT considered acceptance.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const orderId = body?.orderId
    const staffId = body?.staffId
    const staffName = body?.staffName
    if (!orderId) return NextResponse.json({ error: 'Thiếu orderId' }, { status: 400 })

    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) return NextResponse.json({ error: 'Không thấy đơn' }, { status: 404 })

    if (order.status === 'making' || order.status === 'done' || order.status === 'paid') {
      // Already accepted — idempotent. Return current state.
      return NextResponse.json({ ok: true, order, alreadyAccepted: true })
    }
    if (order.status === 'canceled') {
      return NextResponse.json({ error: 'Đơn đã bị hủy' }, { status: 400 })
    }

    const updated = await db.order.update({
      where: { id: orderId },
      data: { status: 'making', assignedTo: staffName || order.assignedTo },
      include: { items: true },
    })

    // Audit log: who accepted.
    if (staffId || staffName) {
      await db.notificationLog.create({
        data: { orderId, staffId: staffId || null, staffName: staffName || null, event: 'accepted' },
      })
    }

    // Broadcast to other devices.
    broadcastOrderUpdate('cafe', updated)
    return NextResponse.json({ ok: true, order: updated })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
