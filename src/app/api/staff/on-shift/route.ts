import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/staff/on-shift
 * Returns the list of all staff with their on-shift status and whether they
 * have at least one active push subscription. Used by the manager view.
 *
 * For privacy, never returns the subscription endpoint/keys.
 */
export async function GET() {
  try {
    const staff = await db.staff.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    })
    const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        view: s.view,
        onShift: s.onShift,
        notifyEnabled: s.notifyEnabled,
        hasSubscription: s._count.subscriptions > 0,
        subscriptionCount: s._count.subscriptions,
        lastLogin: s.lastLogin,
      })),
      admin: cafe
        ? { name: cafe.adminName, onShift: true, notifyEnabled: false, hasSubscription: false, isAdmin: true }
        : null,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
