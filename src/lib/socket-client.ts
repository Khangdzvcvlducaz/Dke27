'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

// IMPORTANT: On the sandbox, the realtime-sync mini-service runs on port 3030
// and the Caddy gateway routes to it ONLY when ?XTransformPort=3030 is in the
// URL. On Railway/Render/Fly.io, Socket.io runs on the SAME port as Next.js
// (via custom-server.js) — so we connect to the same origin without the query.
//
// Detect environment:
// - If running on Caddy (port 81) or localhost:3000 without Railway → use
//   XTransformPort=3030 routing.
// - If running on Railway (custom-server.js merged Socket.io) → connect
//   directly to same origin.
//
// We detect by checking if window.location.port is 81 (Caddy) or if we're
// on a Railway domain (*.up.railway.app).
function detectSocketUrl(): string {
  if (typeof window === 'undefined') return '/?XTransformPort=3030'
  const host = window.location.hostname || ''
  const port = window.location.port || ''
  // Railway domains: *.up.railway.app, *.railway.app
  // Render domains: *.onrender.com
  // Fly.io domains: *.fly.dev
  if (host.includes('railway.app') || host.includes('onrender.com') || host.includes('fly.dev')) {
    // Cloud deployment — Socket.io is merged into Next.js (same port, same origin)
    return '/'
  }
  // Sandbox/local — use Caddy XTransformPort routing
  if (port === '81') {
    return '/?XTransformPort=3030'
  }
  // localhost without Caddy → try direct connection to same origin
  // (custom-server.js handles it)
  return '/'
}

const SOCKET_URL = detectSocketUrl()

export function getSocket(room: string): Socket {
  if (socket && socket.connected) return socket
  if (!socket) {
    socket = io(SOCKET_URL, {
      // The mini-service is configured with path: '/'. The Caddy gateway
      // preserves the rest of the query string (EIO, transport, etc.) when
      // it forwards to localhost:3030.
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })
    socket.on('connect', () => {
      console.log('[socket] connected', socket?.id)
    })
    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason)
    })
    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message)
    })
  }
  // join room
  if (room) {
    socket.emit('join', room)
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/** Broadcast order new */
export function broadcastOrderNew(room: string, order: any) {
  getSocket(room).emit('order:new', { room, order })
}

export function broadcastOrderUpdate(room: string, order: any) {
  getSocket(room).emit('order:update', { room, order })
}

export function broadcastOrderDelete(room: string, id: string) {
  getSocket(room).emit('order:delete', { room, id })
}

export function broadcastSettingsUpdate(room: string) {
  getSocket(room).emit('settings:update', { room })
}

export function broadcastMenuUpdate(room: string) {
  getSocket(room).emit('menu:update', { room })
}

export function broadcastStaffUpdate(room: string) {
  getSocket(room).emit('staff:update', { room })
}

