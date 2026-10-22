import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const staff = await db.staff.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        view: s.view,
        hasPin: !!s.pinHash,
        lastLogin: s.lastLogin,
        loginCount: s.loginCount,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'add') {
      const { name, pin, view } = body
      if (!name) return NextResponse.json({ error: 'Thiếu tên' }, { status: 400 })
      const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
      if (cafe?.adminName && name.toLowerCase() === cafe.adminName.toLowerCase()) {
        return NextResponse.json({ error: 'Tên trùng với Admin' }, { status: 400 })
      }
      const allStaff = await db.staff.findMany()
      const exists = allStaff.find((s) => s.name.toLowerCase() === name.toLowerCase())
      if (exists) return NextResponse.json({ error: 'Đã có nhân viên tên này' }, { status: 400 })
      let pinHash: string | null = null
      if (pin) {
        if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN phải 4 số' }, { status: 400 })
        pinHash = bcrypt.hashSync(pin, 10)
      }
      const s = await db.staff.create({ data: { name, pinHash, view: view || 'pos' } })
      return NextResponse.json({ ok: true, staff: s })
    }

    if (action === 'update') {
      const { id, pin, view } = body
      const data: { pinHash?: string | null; view?: string } = {}
      if (pin) {
        if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN phải 4 số' }, { status: 400 })
        data.pinHash = bcrypt.hashSync(pin, 10)
      }
      if (view) data.view = view
      await db.staff.update({ where: { id }, data })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      await db.staff.deleteMany({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
