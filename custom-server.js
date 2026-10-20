/**
 * Custom server — runs Next.js + Socket.io on the SAME port (3000).
 *
 * Why: On Railway/Render/Fly.io, only ONE port is exposed to the public.
 * The Socket.io mini-service (port 3030) is not accessible from the browser.
 * This file patches http.createServer to intercept the Next.js standalone
 * server and attach Socket.io to it — so both run on port 3000.
 *
 * This replaces:
 *   - The mini-services/realtime-sync/ service (no longer needed in prod)
 *   - The Caddy XTransformPort routing (no longer needed)
 *
 * Usage: node custom-server.js (from start.sh)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const http = require('http')
let io

// Patch http.createServer to capture the Next.js server instance and
// attach Socket.io to it.
const originalCreateServer = http.createServer
http.createServer = function () {
  const args = Array.prototype.slice.call(arguments)
  const server = originalCreateServer.apply(http, args)

  // Attach Socket.io to the captured server
  try {
    const SocketIO = require('socket.io')
    var Server = SocketIO.Server || SocketIO
    io = new Server(server, {
      path: '/',
      cors: { origin: '*', methods: ['GET', 'POST'] },
      pingTimeout: 60000,
      pingInterval: 25000,
    })

    // Room management + order broadcast handlers
    io.on('connection', function (socket) {
      console.log('[socket] connected', socket.id)

      socket.on('join', function (room) {
        if (!room) return
        socket.join('cafe:' + room)
        socket.emit('joined', room)
      })

      socket.on('order:new', function (payload) {
        if (!payload || !payload.room) return
        socket.to('cafe:' + payload.room).emit('order:new', payload.order)
      })

      socket.on('order:update', function (payload) {
        if (!payload || !payload.room) return
        socket.to('cafe:' + payload.room).emit('order:update', payload.order)
      })

      socket.on('order:delete', function (payload) {
        if (!payload || !payload.room) return
        socket.to('cafe:' + payload.room).emit('order:delete', { id: payload.id })
      })

      socket.on('settings:update', function (payload) {
        if (!payload || !payload.room) return
        socket.to('cafe:' + payload.room).emit('settings:update', {})
      })

      socket.on('menu:update', function (payload) {
        if (!payload || !payload.room) return
        socket.to('cafe:' + payload.room).emit('menu:update', {})
      })

      socket.on('staff:update', function (payload) {
        if (!payload || !payload.room) return
        socket.to('cafe:' + payload.room).emit('staff:update', {})
      })

      socket.on('ping', function () { socket.emit('pong') })
    })

    console.log('[socket] Socket.io attached to Next.js server')
  } catch (e) {
    console.warn('[socket] Failed to attach Socket.io:', e.message)
  }

  // Restore original — only intercept once
  http.createServer = originalCreateServer
  return server
}

// Now load the Next.js standalone server — it will call http.createServer
// which we've patched, so Socket.io gets attached automatically.
require('./server.js')
