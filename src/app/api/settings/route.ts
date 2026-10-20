import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
    return NextResponse.json({
      name: cafe?.name ?? 'Đông Không Em?',
      adminName: cafe?.adminName ?? 'Admin',
      logo: cafe?.logo ?? null,
      qrCode: cafe?.qrCode ?? null,
      hasPin: !!cafe?.pinHash,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'setName') {
      const { name } = body
      if (!name) return NextResponse.json({ error: 'Thiếu tên' }, { status: 400 })
      await db.cafe.upsert({ where: { id: 'default' }, update: { name }, create: { id: 'default', name } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'setPin') {
      const { pin, oldPin } = body
      if (!/^\d{4}$/.test(pin || '')) return NextResponse.json({ error: 'PIN phải 4 số' }, { status: 400 })
      const cafe = await db.cafe.findUnique({ where: { id: 'default' } })
      if (cafe?.pinHash && oldPin && !bcrypt.compareSync(oldPin, cafe.pinHash)) {
        return NextResponse.json({ error: 'Mã PIN cũ không đúng' }, { status: 401 })
      }
      const pinHash = bcrypt.hashSync(pin, 10)
      await db.cafe.upsert({ where: { id: 'default' }, update: { pinHash }, create: { id: 'default', pinHash } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'setLogo') {
      const { logo } = body // dataURL
      if (logo && logo.length > 2500000) return NextResponse.json({ error: 'Logo quá lớn' }, { status: 400 })
      await db.cafe.upsert({ where: { id: 'default' }, update: { logo }, create: { id: 'default', logo } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'clearLogo') {
      await db.cafe.update({ where: { id: 'default' }, data: { logo: null } })
      return NextResponse.json({ ok: true })
    }

    // Banking QR code — admin only. Stored as base64 data URL in the Cafe
    // table. Used by the Pay view's "Chuyển khoản" button to show the
    // customer a QR they can scan with their banking app.
    if (action === 'setQrCode') {
      const { qrCode } = body // dataURL
      if (qrCode && qrCode.length > 2500000) return NextResponse.json({ error: 'QR quá lớn' }, { status: 400 })
      await db.cafe.upsert({ where: { id: 'default' }, update: { qrCode }, create: { id: 'default', qrCode } })
      return NextResponse.json({ ok: true })
    }

    if (action === 'clearQrCode') {
      await db.cafe.update({ where: { id: 'default' }, data: { qrCode: null } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
