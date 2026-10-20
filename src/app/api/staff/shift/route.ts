import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/staff/shift
 * Body: { staffId, onShift: boolean }
 *
 * Toggles the on-shift status for a staff member. The shift status is the
 * gate that decides whether push notifications are sent to that staff.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staffId = body?.staffId
    const onShift = !!body?.onShift
    if (!staffId) return NextResponse.json({ error: 'Thiếu staffId' }, { status: 400 })

    const staff = await db.staff.findUnique({ where: { id: staffId } })
    if (!staff) return NextResponse.json({ error: 'Không thấy nhân viên' }, { status: 404 })

    await db.staff.update({ where: { id: staffId }, data: { onShift } })
    return NextResponse.json({ ok: true, onShift })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
