'use client'

/**
 * Client-side push notification helpers — shared by lock-screen (auto-enable
 * on login) and profile-sheet (manual enable/disable/test).
 *
 * The key challenge: `Notification.requestPermission()` MUST be called within
 * a user gesture (click). On login, the user clicks "Vào làm việc" — that
 * click provides user activation for ~5 seconds. The login fetch takes
 * <1 second, so by the time the response comes back, the activation is still
 * valid. We call requestPermission() + subscribe() immediately after login
 * succeeds.
 */

/**
 * Auto-enable push notifications for a staff member after login.
 * Called from lock-screen.tsx's handleLogin() — must be called within the
 * user activation window (~5 seconds after the login click).
 *
 * Steps:
 * 1. If notification permission is 'default', request it.
 * 2. If permission is 'granted' (newly or previously), subscribe to push.
 * 3. Save the subscription to the backend.
 *
 * All errors are silently swallowed — the user can manually enable in the
 * Profile sheet if auto-enable fails.
 */
export async function autoEnablePush(staffId: string): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // Step 1: Request permission if not yet requested.
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
    } else if (Notification.permission !== 'granted') {
      return
    }

    // Step 2: Wait for SW to be ready.
    const reg = await navigator.serviceWorker.ready

    // Check if already subscribed (avoid duplicate subscriptions).
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      // Already subscribed — save to backend to ensure it's registered.
      await saveSubscription(staffId, existing)
      return
    }

    // Step 3: Get VAPID public key from backend.
    const r = await fetch('/api/push/vapid')
    const vd = await r.json()
    if (!vd?.publicKey) return
    const key = urlBase64ToUint8Array(vd.publicKey)

    // Step 4: Subscribe to push.
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })

    // Step 5: Save subscription to backend.
    await saveSubscription(staffId, sub)
  } catch (e) {
    // Silent fail — user can manually enable in Profile sheet.
    console.warn('[auto-push] failed:', (e as Error).message)
  }
}

/**
 * Save (or re-save) a push subscription to the backend.
 */
export async function saveSubscription(staffId: string, sub: PushSubscription): Promise<void> {
  try {
    const subJson = sub.toJSON()
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffId,
        subscription: {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        },
      }),
    })
  } catch (e) {
    // Silent fail.
  }
}

/**
 * Convert base64url to Uint8Array for applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
