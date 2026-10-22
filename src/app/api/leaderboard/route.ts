import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }
function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * GET /api/leaderboard?period=today|week|month|all
 *
 * Computes staff points from orders:
 * - Created order (by): +10
 * - Accepted order (assignedTo, making): +15
 * - Completed order (assignedTo, done/paid): +20
 * - Collected payment (paidBy): +30
 * - Bonus accept <1 min: +5
 * - Bonus complete <5 min: +10
 * - Bonus collect <2 min: +5
 * - Penalize collect >5 min: -5
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || 'today'

    // Determine date range
    const now = new Date()
    let where: any = {}
    if (period === 'today') {
      where = { day: dayStr(now) }
    } else if (period === 'week') {
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      where = { createdAt: { gte: weekAgo } }
    } else if (period === 'month') {
      const monthAgo = new Date(now)
      monthAgo.setDate(monthAgo.getDate() - 30)
      where = { createdAt: { gte: monthAgo } }
    }
    // 'all' = no filter

    const orders = await db.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })

    // Compute points per staff name
    const points: Record<string, { total: number; breakdown: { action: string; pts: number; count: number }[] }> = {}

    function addPts(name: string, pts: number, action: string) {
      if (!name) return
      if (!points[name]) points[name] = { total: 0, breakdown: [] }
      points[name].total += pts
      let b = points[name].breakdown.find((x) => x.action === action)
      if (!b) { b = { action, pts: 0, count: 0 }; points[name].breakdown.push(b) }
      b.pts += pts
      b.count += 1
    }

    for (const o of orders) {
      const createdTs = new Date(o.createdAt).getTime()
      const notifiedTs = o.notifiedAt ? new Date(o.notifiedAt).getTime() : 0
      const updatedTs = new Date(o.updatedAt).getTime()
      const paidTs = o.paidAt ? new Date(o.paidAt).getTime() : 0

      // Created (by)
      if (o.by) {
        addPts(o.by, 10, 'Tạo đơn')
      }

      // Accepted + Completed (assignedTo)
      if (o.assignedTo && (o.status === 'making' || o.status === 'done' || o.status === 'paid')) {
        addPts(o.assignedTo, 15, 'Nhận pha')
        // Bonus: accepted within 1 minute of notification
        if (notifiedTs > 0 && updatedTs - notifiedTs < 60000) {
          addPts(o.assignedTo, 5, 'Bonus nhận nhanh')
        }
      }
      if (o.assignedTo && (o.status === 'done' || o.status === 'paid')) {
        addPts(o.assignedTo, 20, 'Xong pha')
        // Bonus: completed within 5 minutes of acceptance
        if (updatedTs - createdTs < 5 * 60000) {
          addPts(o.assignedTo, 10, 'Bonus pha nhanh')
        }
      }

      // Collected payment (paidBy)
      if (o.paidBy && o.status === 'paid') {
        addPts(o.paidBy, 30, 'Thu tiền')
        // Bonus: collected within 2 minutes of completion
        if (updatedTs > 0 && paidTs - updatedTs < 2 * 60000) {
          addPts(o.paidBy, 5, 'Bonus thu nhanh')
        }
        // Penalize: collected after 5 minutes
        if (updatedTs > 0 && paidTs - updatedTs > 5 * 60000) {
          addPts(o.paidBy, -5, 'Chậm thu')
        }
      }
    }

    // Get staff names + roles + avatars for display
    const staff = await db.staff.findMany()
    const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
    const staffMap = new Map<string, { role: string; view: string; avatar: string | null }>()
    staff.forEach((s) => staffMap.set(s.name, { role: 'staff', view: s.view, avatar: s.avatar }))
    if (cafe?.adminName) staffMap.set(cafe.adminName, { role: 'admin', view: 'admin', avatar: null })

    // Build ranked list
    const ranked = Object.entries(points)
      .map(([name, data]) => ({
        name,
        points: data.total,
        breakdown: data.breakdown,
        role: staffMap.get(name)?.role || 'staff',
        view: staffMap.get(name)?.view || 'pos',
        avatar: staffMap.get(name)?.avatar || null,
      }))
      .sort((a, b) => b.points - a.points)

    return NextResponse.json({ period, ranked })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
