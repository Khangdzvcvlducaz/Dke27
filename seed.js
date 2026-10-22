/**
 * Seed script — creates 15 staff members if they don't exist.
 * Run at container start (idempotent — safe to run multiple times).
 * Uses upsert to avoid duplicates.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const staff = [
  { name: 'Kim', pin: '2007', view: 'pay' },
  { name: 'Đỗ Thịnh', pin: '3636', view: 'pos' },
  { name: 'Quân', pin: '2909', view: 'pay' },
  { name: 'Ri', pin: '1234', view: 'kitchen' },
  { name: 'Thịnh', pin: '1235', view: 'pay' },
  { name: 'Lộc', pin: '0101', view: 'pos' },
  { name: 'Kiệt', pin: '1477', view: 'pay' },
  { name: 'Vỹ', pin: '1111', view: 'kitchen' },
  { name: 'Hưng', pin: '2710', view: 'pos' },
  { name: 'Việt', pin: '1234', view: 'pay' },
  { name: 'Khuê', pin: '2007', view: 'report' },
  { name: 'Hải', pin: '2006', view: 'pos' },
  { name: 'Kiên', pin: '6767', view: 'pay' },
  { name: 'Bình', pin: '9999', view: 'kitchen' },
  { name: 'Dung', pin: '2007', view: 'kitchen' },
]

async function main() {
  for (const s of staff) {
    await db.staff.upsert({
      where: { name: s.name },
      create: {
        name: s.name,
        pinHash: bcrypt.hashSync(s.pin, 10),
        view: s.view,
        onShift: true,
        notifyEnabled: true,
      },
      update: {},
    })
  }
  console.log(`[seed] ${staff.length} staff members ready`)
}

main().catch(() => process.exit(1)).finally(() => db.$disconnect())
