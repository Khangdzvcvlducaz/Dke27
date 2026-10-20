import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/push/subscribe
 * Body: { staffId, subscription: { endpoint, keys: { p256dh, auth } } }
 *
 * Stores (or upserts) a push subscription for the given staff.
 * Staff must already exist (created by admin). We do not require an auth
 * token here — the closed-network café trust model relies on staffId matching
 * the logged-in user; the public VAPID key is the only secret in play.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staffId = body?.staffId
    const subscription = body?.subscription
    if (!staffId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Thiếu thông tin subscription' }, { status: 400 })
    }

    const staff = await db.staff.findUnique({ where: { id: staffId } })
    if (!staff) {
      return NextResponse.json({ error: 'Không thấy nhân viên' }, { status: 404 })
    }

    const userAgent = req.headers.get('user-agent') || null
    // Upsert by endpoint — each device has one endpoint, so re-subscribe
    // updates the keys if they rotated.
    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        staffId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent,
      },
      update: {
        staffId, // in case device switched accounts
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent,
      },
    })

    // Mark notifyEnabled so the manager view reflects consent.
    await db.staff.update({ where: { id: staffId }, data: { notifyEnabled: true } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
