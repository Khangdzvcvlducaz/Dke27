import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/push/unsubscribe
 * Body: { endpoint } OR { staffId } (to remove all of a staff's devices)
 *
 * Removes the device subscription from the backend.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const endpoint = body?.endpoint
    const staffId = body?.staffId

    if (endpoint) {
      await db.pushSubscription.deleteMany({ where: { endpoint } })
      return NextResponse.json({ ok: true })
    }

    if (staffId) {
      await db.pushSubscription.deleteMany({ where: { staffId } })
      // Mark notifyEnabled off so we don't try to push to a non-existent sub.
      await db.staff.updateMany({ where: { id: staffId }, data: { notifyEnabled: false } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Thiếu endpoint hoặc staffId' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
