/* Service Worker for Đông Không Em? — handles Web Push + click actions.
   Registered from site root (/sw.js) so scope covers the whole app.
   Does NOT cache anything; existing dev server caching is untouched. */

const SW_VERSION = 'dke-v1';

// Vibration pattern requested by the app — the OS may or may not honor it
// depending on device settings (DND, silent mode, vibration preference).
const VIBRATE_PATTERN = [300, 150, 300, 150, 300];

self.addEventListener('install', (event) => {
  // Skip waiting so updates apply immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all clients on activation.
  event.waitUntil(self.clients.claim());
});

// Helper: find or open the app window, optionally with a deep link.
async function focusOrOpenApp(query = '') {
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  // Prefer an existing client that's already visible.
  for (const client of allClients) {
    try {
      await client.focus();
      if (query) {
        const url = new URL(client.url);
        // Only navigate if needed.
        if (!url.searchParams.has('order') && !url.searchParams.has('open')) {
          const target = new URL(client.url);
          target.search = query;
          await client.navigate(target.toString());
        }
      }
      return client;
    } catch (e) {
      // continue
    }
  }
  // No existing window — open a new one.
  try {
    return await self.clients.openWindow('/' + (query ? '?' + query : ''));
  } catch (e) {
    return null;
  }
}

// Handle Push events from the push service.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch (e2) {
      payload = {};
    }
  }

  const title = payload.title || 'Đông Không Em?';
  const body = payload.body || 'Có đơn mới cần chuẩn bị';
  const tag = payload.tag || 'dke-order';
  const data = payload.data || {};
  const actions = Array.isArray(payload.actions) ? payload.actions : [];

  const options = {
    body,
    tag,
    data,
    // Vibrate — honored only on supported devices (mostly Android Chrome).
    vibrate: VIBRATE_PATTERN,
    // Notification is NOT silent: we want sound + vibration when a vibration pattern is requested.
    silent: false,
    // Custom notification sound — best-effort. Chrome currently ignores this
    // field (it plays the OS default), but Safari and other browsers may honor
    // it for installed PWAs.
    sound: '/notif.mp3',
    requireInteraction: true, // keep notification visible until staff acts
    // badge: small monochrome icon for Android status bar.
    badge: '/icon-192.png',
    icon: '/icon-512.png',
    actions,
  };

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options);
      } catch (e) {
        // Fall back to a basic notification without actions.
        try {
          await self.registration.showNotification(title, { body, tag, data });
        } catch (e2) {
          // give up
        }
      }
    })()
  );
});

// Handle notification click — including action buttons.
self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  notif.close();
  const data = notif.data || {};
  const action = event.action; // '' for body click, 'accept'/'view' for buttons

  event.waitUntil(
    (async () => {
      // If the staff clicked "Accept" on a drink-order notification,
      // call the accept endpoint (fire-and-forget — app state will sync via socket).
      if (action === 'accept' && data.orderId && data.staffId) {
        try {
          await fetch('/api/orders/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderId,
              staffId: data.staffId,
              staffName: data.staffName,
            }),
          });
        } catch (e) {
          // Accept will be retried from the order queue UI; the order is never lost.
        }
      }

      // Open the app to the kitchen queue, with the order deep-linked.
      const params = new URLSearchParams();
      if (data.orderId) params.set('order', data.orderId);
      params.set('open', data.targetView || 'kitchen');
      await focusOrOpenApp(params.toString());
    })()
  );
});

// Handle subscription expiration / push service change.
self.addEventListener('pushsubscriptionchange', (event) => {
  // The app will re-subscribe on next interaction; here we just notify the page.
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const c of clients) {
        c.postMessage({ type: 'pushsubscriptionchange' });
      }
    })()
  );
});

// Listen for messages from the page (e.g., "test notification" requests).
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
