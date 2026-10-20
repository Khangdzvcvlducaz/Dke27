'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker at site root (/sw.js) so it can handle push
 * events for the whole app. Does NOT register in dev mode unless explicitly
 * enabled, because dev HMR can conflict with SW caching.
 *
 * Mount this component once at the root (in layout).
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Only register over HTTPS or localhost (Push API requires secure context).
    const isSecure = window.isSecureContext
    if (!isSecure) {
      console.warn('[sw] Skipping SW registration: insecure context (use HTTPS or localhost)')
      return
    }
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        // Trigger update check.
        await reg.update()
      } catch (err) {
        console.warn('[sw] Registration failed:', err)
      }
    }
    // Register after load to avoid competing with first paint.
    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
    // Listen for subscription change events from the SW.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pushsubscriptionchange') {
        // Tell the app to re-subscribe — handled in ProfileSheet via periodic check.
        window.dispatchEvent(new CustomEvent('push-subscription-expired'))
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
