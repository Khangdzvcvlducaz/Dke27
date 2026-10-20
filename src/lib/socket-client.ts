'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(room: string): Socket {
  if (socket && socket.connected) return socket
  if (!socket) {
    socket = io('/', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })
    socket.on('connect', () => {
      console.log('[socket] connected', socket?.id)
    })
    socket.on('disconnect', () => {
      console.log('[socket] disconnected')
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
