import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const discounts = await db.discount.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ discounts })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'add') {
      const { code, kind, value, note } = body
      if (!code || !value) return NextResponse.json({ error: 'Thiếu mã hoặc giá trị' }, { status: 400 })
      const d = await db.discount.create({ data: { code, kind: kind || 'percent', value: Math.max(0, Number(value) || 0), note: note || null } })
      return NextResponse.json({ ok: true, discount: d })
    }

    if (action === 'update') {
      const { id, active, value } = body
      const data: { active?: boolean; value?: number } = {}
      if (active !== undefined) data.active = active
      if (value !== undefined) data.value = Math.max(0, Number(value) || 0)
      await db.discount.update({ where: { id }, data })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      await db.discount.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
