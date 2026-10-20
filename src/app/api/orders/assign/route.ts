import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { broadcastOrderUpdate } from '@/lib/socket-server-broadcast'

export const runtime = 'nodejs'

/**
 * POST /api/orders/assign
 * Body: { orderId, staffName } (admin manually assigns order to a staff)
 *
 * Manager fallback for orders that weren't accepted via notifications
 * (notifications failed, no eligible on-shift staff, etc.). The order is
 * never lost — admin can always re-assign manually.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const orderId = body?.orderId
    const staffName = body?.staffName
    if (!orderId || !staffName) return NextResponse.json({ error: 'Thiếu orderId hoặc staffName' }, { status: 400 })

    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) return NextResponse.json({ error: 'Không thấy đơn' }, { status: 404 })

    const updated = await db.order.update({
      where: { id: orderId },
      data: { status: 'making', assignedTo: staffName },
      include: { items: true },
    })

    await db.notificationLog.create({
      data: { orderId, staffName, event: 'accepted', reason: 'manual-assign' },
    })

    broadcastOrderUpdate('cafe', updated)
    return NextResponse.json({ ok: true, order: updated })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
