import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const items = await db.menuItem.findMany({ orderBy: { sortOrder: 'asc' } })
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'add') {
      const { icon, name, price, imageUrl } = body
      if (!name || !price) return NextResponse.json({ error: 'Thiếu tên hoặc giá' }, { status: 400 })
      const maxSort = await db.menuItem.max({ _max: { sortOrder: true } }).catch(() => ({ _max: { sortOrder: 0 } }))
      const item = await db.menuItem.create({
        data: {
          icon: icon || '☕',
          name,
          price: Math.max(0, Number(price) || 0),
          imageUrl: imageUrl || null,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      })
      return NextResponse.json({ ok: true, item })
    }

    if (action === 'update') {
      const { id, name, price, icon, available, imageUrl } = body
      const data: { name?: string; price?: number; icon?: string; available?: boolean; imageUrl?: string | null } = {}
      if (name !== undefined) data.name = name
      if (price !== undefined) data.price = Math.max(0, Number(price) || 0)
      if (icon !== undefined) data.icon = icon
      if (available !== undefined) data.available = available
      if (imageUrl !== undefined) data.imageUrl = imageUrl
      await db.menuItem.update({ where: { id }, data })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      await db.menuItem.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
