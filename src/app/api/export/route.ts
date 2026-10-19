import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/export?type=orders|menu|staff — trả về CSV
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'orders'
    const day = url.searchParams.get('day')

    if (type === 'orders') {
      const where: { day?: string } = {}
      if (day) where.day = day
      const orders = await db.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      })
      const rows = [
        ['Mã đơn', 'Ngày', 'Giờ', 'Khách', 'Bàn', 'Loại', 'Món', 'SL', 'Đơn giá', 'Tổng tiền', 'Giảm giá', 'PT thanh toán', 'Trạng thái', 'Người tạo', 'Người thu'].join(','),
      ]
      for (const o of orders) {
        const time = new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        const items = o.items.map((i) => `${i.qty}x ${i.name.replace(/,/g, ';')}`).join(' | ')
        const totalQty = o.items.reduce((s, i) => s + i.qty, 0)
        rows.push([
          o.code,
          o.day,
          time,
          `"${o.customer.replace(/"/g, '""')}"`,
          o.tableCode || '',
          o.type === 'stay' ? 'Tại chỗ' : 'Mang đi',
          `"${items}"`,
          totalQty,
          o.items.reduce((s, i) => s + i.price * i.qty, 0),
          o.total,
          o.discount,
          o.payMethod === 'cash' ? 'Tiền mặt' : o.payMethod === 'transfer' ? 'Chuyển khoản' : '',
          o.status,
          o.by || '',
          o.paidBy || '',
        ].join(','))
      }
      return new NextResponse(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="orders${day ? '-' + day : ''}.csv"`,
        },
      })
    }

    if (type === 'menu') {
      const items = await db.menuItem.findMany({ orderBy: { sortOrder: 'asc' } })
      const rows = [['Icon', 'Tên món', 'Giá', 'Còn bán', 'Hình ảnh'].join(',')]
      for (const m of items) {
        rows.push([m.icon, `"${m.name.replace(/,/g, ';')}"`, m.price, m.available ? 'Có' : 'Hết', m.imageUrl || ''].join(','))
      }
      return new NextResponse(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="menu.csv"',
        },
      })
    }

    if (type === 'staff') {
      const staff = await db.staff.findMany({ orderBy: { name: 'asc' } })
      const rows = [['Tên', 'Mục', 'Có mã', 'Lần đăng nhập', 'Lần cuối'].join(',')]
      for (const s of staff) {
        rows.push([
          `"${s.name}"`,
          s.view,
          s.pinHash ? 'Có' : 'Không',
          s.loginCount,
          s.lastLogin ? new Date(s.lastLogin).toLocaleString('vi-VN') : '',
        ].join(','))
      }
      return new NextResponse(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="staff.csv"',
        },
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
