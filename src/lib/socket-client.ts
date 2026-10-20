'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

// IMPORTANT: the realtime-sync mini-service runs on port 3030 (separate from
// Next.js on port 3000). The Caddy gateway routes to port 3030 ONLY when the
// request URL contains ?XTransformPort=3030. Without this query, requests to
// "/" go to Next.js (which doesn't speak socket.io) and the connection fails
// silently — causing kitchen view to never receive realtime updates.
const SOCKET_URL = '/?XTransformPort=3030'

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

