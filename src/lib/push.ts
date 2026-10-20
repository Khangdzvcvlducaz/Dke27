import webpush from 'web-push'
import { db } from '@/lib/db'

// Push subscription info per device — never log secrets.
interface SubRow {
  id: string
  staffId: string
  endpoint: string
  p256dhKey: string
  authKey: string
}

interface OrderForPush {
  id: string
  code: string
  customer: string
  tableCode: string | null
  type: string
  items: { icon: string; name: string; qty: number; notes: string | null }[]
}

// Configure once at module load. If env vars are missing, push is disabled gracefully.
let configured = false
function ensureConfigured() {
  if (configured) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID env vars missing — push notifications disabled.')
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

/** Get the public VAPID key (safe to expose to clients). */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

/**
 * Send a new-order push notification to all eligible drink-prep staff.
 * Eligible = staff.view === 'kitchen' AND onShift === true AND notifyEnabled === true.
 * Returns the list of attempted deliveries; failures are logged but don't block the order.
 */
export async function sendNewOrderPush(order: OrderForPush): Promise<void> {
  if (!ensureConfigured()) return

  // Compose a concise, customer-safe payload.
  const itemsLine = order.items
    .map((it) => `${it.qty}× ${it.name}`)
    .join(', ')
  const tableLine = order.tableCode ? ` — ${order.tableCode}` : ''
  const title = `Đơn mới ${order.code}`
  const body = `${itemsLine}${tableLine}`

  // Find eligible staff (drink-prep role + on shift + opted-in).
  const eligible = await db.staff.findMany({
    where: { view: 'kitchen', onShift: true, notifyEnabled: true },
    include: { subscriptions: true },
  })

  if (eligible.length === 0) {
    // No one to notify — log this so manager can see in audit.
    await db.notificationLog.create({
      data: {
        orderId: order.id,
        event: 'failed',
        reason: 'no-eligible-staff',
      },
    })
    return
  }

  // Build the payload that the SW will use to showNotification.
  const buildPayloadFor = (staffId: string, staffName: string) => ({
    title,
    body,
    tag: `dke-order-${order.id}`, // collapse duplicates for the same order
    data: {
      orderId: order.id,
      staffId,
      staffName,
      targetView: 'kitchen',
      ts: Date.now(),
    },
    // Custom sound (best-effort: Chrome ignores; Safari/iOS may honor).
    sound: '/notif.mp3',
    // Vibration pattern — honored on Android Chrome.
    vibrate: [300, 150, 300, 150, 300],
    silent: false,
    requireInteraction: true,
    actions: [
      { action: 'accept', title: '✓ Nhận pha' },
      { action: 'view', title: '👀 Xem đơn' },
    ],
  })

  for (const staff of eligible) {
    for (const sub of staff.subscriptions) {
      const subscription = {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
      }
      try {
        const result = await webpush.sendNotification(
          subscription,
          JSON.stringify(buildPayloadFor(staff.id, staff.name))
        )
        // Log success — never log the endpoint or keys.
        await db.notificationLog.create({
          data: {
            orderId: order.id,
            staffId: staff.id,
            staffName: staff.name,
            event: 'sent',
            status: result.statusCode,
          },
        })
      } catch (err: any) {
        const statusCode = err?.statusCode || 0
        const reason = err?.message || 'unknown'
        await db.notificationLog.create({
          data: {
            orderId: order.id,
            staffId: staff.id,
            staffName: staff.name,
            event: 'failed',
            status: statusCode,
            reason: reason.slice(0, 200),
          },
        })
        // 404 / 410 = subscription no longer valid → remove it.
        if (statusCode === 404 || statusCode === 410) {
          try {
            await db.pushSubscription.delete({ where: { id: sub.id } })
          } catch (e) {
            // ignore
          }
        }
      }
    }
  }
}

/**
 * Send a test push to all subscriptions of a staff member.
 * Used by the "Send test notification" button in the staff profile.
 */
export async function sendTestPush(staffId: string, staffName: string): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) return { sent: 0, failed: 0 }
  const subs = await db.pushSubscription.findMany({ where: { staffId } })
  if (subs.length === 0) return { sent: 0, failed: 0 }

  const payload = {
    title: '🔔 Thông báo thử',
    body: `Xin chào ${staffName}. Đơn mới sẽ hiện thông báo như thế này khi có khách đặt.`,
    tag: 'dke-test',
    data: { targetView: 'kitchen', ts: Date.now() },
    vibrate: [300, 150, 300, 150, 300],
    silent: false,
    requireInteraction: false,
    actions: [{ action: 'view', title: 'Đã hiểu' }],
  }

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      expirationTime: null,
      keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
    }
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
      sent++
      await db.notificationLog.create({
        data: { staffId, staffName, event: 'sent', reason: 'test' },
      })
    } catch (err: any) {
      failed++
      const statusCode = err?.statusCode || 0
      await db.notificationLog.create({
        data: { staffId, staffName, event: 'failed', status: statusCode, reason: (err?.message || 'unknown').slice(0, 200) },
      })
      if (statusCode === 404 || statusCode === 410) {
        try {
          await db.pushSubscription.delete({ where: { id: sub.id } })
        } catch (e) {
          // ignore
        }
      }
    }
  }
  return { sent, failed }
}

/** Convert a base64url public key to Uint8Array for the browser. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = typeof Buffer !== 'undefined'
    ? Buffer.from(base64, 'base64')
    : Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Uint8Array(rawData as unknown as number[])
}
