'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker at site root (/sw.js) so it can handle push
 * events for the whole app. Does NOT register in dev mode unless explicitly
 * enabled, because dev HMR can conflict with SW caching.
 *
 * Also listens for messages from the SW:
 *   - `play-notif-sound` — when a push notification arrives, the SW cannot
 *     play audio directly (no AudioContext in SW) and Chrome ignores the
 *     `sound` field in showNotification(). So the SW postMessages to all
 *     open client tabs, and the tab plays our custom "Ho Ho Ho" sound.
 *     This works only when at least one app tab is open (foreground or
 *     background). When the app is fully closed, only the OS default
 *     notification sound plays (Chrome limitation).
 *   - `push-subscription-change` — re-subscribe.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    const isSecure = window.isSecureContext
    if (!isSecure) {
      console.warn('[sw] Skipping SW registration: insecure context (use HTTPS or localhost)')
      return
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        // Trigger update check — picks up the latest SW version.
        await reg.update()
        // Listen for updates and force-activate the new SW immediately.
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing
          if (!installingWorker) return
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed — tell it to skip waiting so it activates now.
              installingWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch (err) {
        console.warn('[sw] Registration failed:', err)
      }
    }
    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', register, { once: true })
    }

    // Listen for messages from the SW.
    const onMessage = (event: MessageEvent) => {
      const msg = event.data || {}
      if (msg.type === 'push-subscription-change') {
        window.dispatchEvent(new CustomEvent('push-subscription-expired'))
        return
      }
      if (msg.type === 'play-notif-sound' || msg.type === 'play-pay-sound') {
        // Deduplicate: if the same order's sound was played within the last
        // 5 seconds, skip — both the socket event handler AND the SW
        // postMessage might fire for the same order.
        const payload = msg.payload || {}
        const orderId = payload.data?.orderId
        const key = orderId || payload.tag || payload.title || 'untagged'
        const now = Date.now()
        const lastKey = (window as any).__lastSoundKey || ''
        const lastAt = (window as any).__lastSoundAt || 0
        if (key === lastKey && now - lastAt < 5000) {
          // Same sound played <5s ago — skip to avoid duplicate.
          return
        }
        ;(window as any).__lastSoundKey = key
        ;(window as any).__lastSoundAt = now
        // Determine which sound to play based on the message type:
        // - 'play-notif-sound' → Ho Ho Ho (kitchen: new order for prep)
        // - 'play-pay-sound' → Cha-Ching (pay: order done, collect money)
        const soundFile = msg.type === 'play-pay-sound' ? '/pay-notif.mp3' : '/notif.mp3'
        // Play the custom sound effect.
        try {
          const audio = new Audio(soundFile)
          audio.currentTime = 0
          audio.style.display = 'none'
          document.body.appendChild(audio)
          audio.addEventListener('ended', () => {
            try { document.body.removeChild(audio) } catch (e) {}
          })
          audio.addEventListener('error', () => {
            try { document.body.removeChild(audio) } catch (e) {}
          })
          void audio.play().catch(() => {
            try { document.body.removeChild(audio) } catch (e) {}
          })
        } catch (e) {
          // ignore
        }
        // Dispatch a global event so AppShell/kitchen view can react
        // (e.g., play Cha-Ching via Web Audio API, start vibration).
        window.dispatchEvent(new CustomEvent('dke-notif-received', { detail: payload }))
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
