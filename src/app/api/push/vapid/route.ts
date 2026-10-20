import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/push'

export const runtime = 'nodejs'

/** GET /api/push/vapid — returns the VAPID public key. This key is safe to expose. */
export async function GET() {
  const key = getVapidPublicKey()
  if (!key) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 })
  }
  return NextResponse.json({ publicKey: key })
}
