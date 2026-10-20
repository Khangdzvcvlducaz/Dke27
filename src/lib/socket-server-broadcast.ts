import { io as ioc, Socket } from 'socket.io-client'

// Singleton server-side socket client that connects to the realtime-sync
// mini-service. Lets server API routes broadcast order updates to all
// browser clients (e.g., when a cashier creates an order via /api/orders,
// the server broadcasts the new-order event to all kitchen tabs).
//
// This is the AUTHORITATIVE source of truth — the client-side broadcast
// in cart-sheet.tsx is a backup. The server-side broadcast is more
// reliable because it doesn't depend on the cashier's tab being active.
let _socket: Socket | null = null
let _connecting = false
// Buffer messages emitted before the socket is connected. They get flushed
// when the connection establishes.
const _pending: Array<{ event: string; data: any }> = []

function getSocket(): Socket | null {
  if (_socket && _socket.connected) return _socket
  if (_connecting) return null
  // Mini-service runs on localhost:3030 (configured in Caddyfile as the
  // XTransformPort target). Server-side we connect directly to that port.
  const url = process.env.REALTIME_URL || 'http://localhost:3030'
  _connecting = true
  try {
    _socket = ioc(url, {
      path: '/',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
    _socket.on('connect', () => {
      _connecting = false
      // Flush any pending messages that were emitted before the connection
      // was established.
      while (_pending.length > 0) {
        const { event, data } = _pending.shift()!
        try { _socket?.emit(event, data) } catch (e) {}
      }
    })
    _socket.on('disconnect', () => {
      // Will auto-reconnect.
    })
    _socket.on('connect_error', (err: any) => {
      _connecting = false
      // Don't log endpoint/keys — just the error message.
      console.warn('[socket-server] connect error:', err?.message || 'unknown')
    })
  } catch (e) {
    _connecting = false
    return null
  }
  return _socket
}

export function broadcastOrderUpdate(room: string, order: any): void {
  const s = getSocket()
  if (!s) return
  try {
    if (s.connected) {
      s.emit('order:update', { room, order })
    } else {
      // Socket not yet connected — buffer for flush on connect.
      _pending.push({ event: 'order:update', data: { room, order } })
    }
  } catch (e) {
    // ignore
  }
}

export function broadcastOrderNew(room: string, order: any): void {
  const s = getSocket()
  if (!s) return
  try {
    if (s.connected) {
      s.emit('order:new', { room, order })
    } else {
      // Socket not yet connected — buffer for flush on connect.
      _pending.push({ event: 'order:new', data: { room, order } })
    }
  } catch (e) {
    // ignore
  }
}
