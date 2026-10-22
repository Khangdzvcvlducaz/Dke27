import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const tables = await db.table.findMany({ orderBy: { sortOrder: 'asc' } })
    return NextResponse.json({ tables })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'add') {
      const { code, seats } = body
      if (!code) return NextResponse.json({ error: 'Thiếu mã bàn' }, { status: 400 })
      const maxSort = await db.table.count()
      const t = await db.table.create({
        data: { code, seats: seats || 4, sortOrder: maxSort },
      })
      return NextResponse.json({ ok: true, table: t })
    }

    if (action === 'update') {
      const { id, code, seats, status } = body
      const data: { code?: string; seats?: number; status?: string } = {}
      if (code !== undefined) data.code = code
      if (seats !== undefined) data.seats = seats
      if (status !== undefined) data.status = status
      await db.table.update({ where: { id }, data })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      await db.table.deleteMany({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'reset') {
      await db.table.updateMany({ data: { status: 'free' } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
