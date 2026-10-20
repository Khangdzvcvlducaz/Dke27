import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// GET — kiểm tra trạng thái khởi tạo (có admin chưa?)
export async function GET() {
  try {
    const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
    const staffCount = await db.staff.count()
    const menuCount = await db.menuItem.count()
    return NextResponse.json({
      initialized: !!cafe?.pinHash,
      cafeName: cafe?.name ?? 'Đông Không Em?',
      adminName: cafe?.adminName ?? 'Admin',
      staffCount,
      menuCount,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST — tạo nhóm mới hoặc đăng nhập
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { cafeName, adminName, pin } = body
      if (!adminName || !/^\d{4}$/.test(pin || '')) {
        return NextResponse.json({ error: 'Thiếu tên admin hoặc PIN 4 số' }, { status: 400 })
      }
      const existing = await db.cafe.findUnique({ where: { id: 'default' } })
      if (existing?.pinHash) {
        return NextResponse.json({ error: 'Nhóm đã được tạo. Hãy đăng nhập.' }, { status: 400 })
      }
      const pinHash = bcrypt.hashSync(pin, 10)
      await db.cafe.upsert({
        where: { id: 'default' },
        update: { name: cafeName || 'Đông Không Em?', adminName, pinHash },
        create: { id: 'default', name: cafeName || 'Đông Không Em?', adminName, pinHash },
      })
      // seed menu nếu trống
      const count = await db.menuItem.count()
      if (count === 0) await seedMenu()
      await logSession(adminName, 'in')
      return NextResponse.json({ ok: true, role: 'admin', name: adminName, view: null })
    }

    if (action === 'login') {
      const { name, pin } = body
      if (!name || !/^\d{4}$/.test(pin || '')) {
        return NextResponse.json({ error: 'Thiếu tên hoặc PIN 4 số' }, { status: 400 })
      }
      const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
      if (!cafe?.pinHash) {
        return NextResponse.json({ error: 'Chưa có nhóm nào được tạo.' }, { status: 400 })
      }
      // check admin
      if (name.toLowerCase() === cafe.adminName.toLowerCase()) {
        if (!bcrypt.compareSync(pin, cafe.pinHash)) {
          return NextResponse.json({ error: 'Sai mã PIN Admin' }, { status: 401 })
        }
        await logSession(cafe.adminName, 'in')
        return NextResponse.json({ ok: true, role: 'admin', name: cafe.adminName, view: null })
      }
      // check staff (SQLite is case-sensitive by default; we fetch and compare lowercase)
      const allStaff = await db.staff.findMany()
      const staff = allStaff.find((s) => s.name.toLowerCase() === name.toLowerCase())
      if (!staff) return NextResponse.json({ error: 'Không thấy nhân viên — nhờ Admin thêm' }, { status: 401 })
      if (!staff.pinHash) return NextResponse.json({ error: 'Tài khoản chưa có mã' }, { status: 401 })
      if (!bcrypt.compareSync(pin, staff.pinHash)) return NextResponse.json({ error: 'Sai mã PIN' }, { status: 401 })
      if (!staff.view) return NextResponse.json({ error: 'Chưa được phân mục' }, { status: 401 })
      await db.staff.update({ where: { id: staff.id }, data: { lastLogin: new Date(), loginCount: { increment: 1 } } })
      await logSession(staff.name, 'in')
      return NextResponse.json({ ok: true, role: 'staff', name: staff.name, view: staff.view, staffId: staff.id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function logSession(name: string, action: string) {
  await db.session.create({ data: { name, action } })
}

async function seedMenu() {
  const items = [
    { icon: '☕', name: 'Cà phê đen', price: 15000 },
    { icon: '🥛', name: 'Cà phê sữa đá', price: 20000 },
    { icon: '🥛', name: 'Bạc xỉu', price: 22000 },
    { icon: '🧋', name: 'Trà sữa trân châu', price: 25000 },
    { icon: '🍋', name: 'Trà chanh', price: 12000 },
    { icon: '🍹', name: 'Trà đào', price: 25000 },
    { icon: '🍫', name: 'Ca cao nóng', price: 20000 },
    { icon: '💧', name: 'Nước suối', price: 5000 },
  ]
  await db.menuItem.createMany({
    data: items.map((m, i) => ({ ...m, sortOrder: i })),
  })
  // seed tables
  const tables = ['Bàn 1', 'Bàn 2', 'Bàn 3', 'Bàn 4', 'Bàn 5', 'Bàn 6']
  await db.table.createMany({
    data: tables.map((code, i) => ({ code, seats: 4, sortOrder: i })),
  })
}
