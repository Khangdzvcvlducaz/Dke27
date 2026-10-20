import { io as ioc, Socket } from 'socket.io-client'

// Singleton server-side socket client that connects to the realtime-sync
// mini-service. Lets server API routes broadcast order updates to all
// browser clients (e.g., when the SW accepts an order from a notification).
let _socket: Socket | null = null
let _connecting = false

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
    })
    _socket.on('disconnect', () => {
      // Will auto-reconnect.
    })
    _socket.on('connect_error', () => {
      _connecting = false
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
    s.emit('order:update', { room, order })
  } catch (e) {
    // ignore
  }
}

export function broadcastOrderNew(room: string, order: any): void {
  const s = getSocket()
  if (!s) return
  try {
    s.emit('order:new', { room, order })
  } catch (e) {
    // ignore
  }
}
