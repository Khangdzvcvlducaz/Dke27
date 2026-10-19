// Realtime sync mini-service for Đông Không Em? — port 3030
import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface OrderPayload {
  id: string
  code: string
  status: string
  by?: string
  device?: string
  [k: string]: unknown
}

const rooms = new Set<string>()

io.on('connection', (socket) => {
  console.log(`[realtime] connect ${socket.id}`)

  socket.on('join', (room: string) => {
    if (!room) return
    socket.join(`cafe:${room}`)
    rooms.add(room)
    socket.emit('joined', room)
    console.log(`[realtime] ${socket.id} joined cafe:${room}`)
  })

  socket.on('order:new', (payload: { room: string; order: OrderPayload }) => {
    if (!payload?.room) return
    socket.to(`cafe:${payload.room}`).emit('order:new', payload.order)
    console.log(`[realtime] order:new ${payload.order.code} → cafe:${payload.room}`)
  })

  socket.on('order:update', (payload: { room: string; order: OrderPayload }) => {
    if (!payload?.room) return
    socket.to(`cafe:${payload.room}`).emit('order:update', payload.order)
  })

  socket.on('order:delete', (payload: { room: string; id: string }) => {
    if (!payload?.room) return
    socket.to(`cafe:${payload.room}`).emit('order:delete', { id: payload.id })
  })

  socket.on('settings:update', (payload: { room: string }) => {
    if (!payload?.room) return
    socket.to(`cafe:${payload.room}`).emit('settings:update', {})
  })

  socket.on('menu:update', (payload: { room: string }) => {
    if (!payload?.room) return
    socket.to(`cafe:${payload.room}`).emit('menu:update', {})
  })

  socket.on('staff:update', (payload: { room: string }) => {
    if (!payload?.room) return
    socket.to(`cafe:${payload.room}`).emit('staff:update', {})
  })

  socket.on('ping', () => socket.emit('pong'))

  socket.on('disconnect', () => {
    console.log(`[realtime] disconnect ${socket.id}`)
  })
})

const PORT = 3030
httpServer.listen(PORT, () => {
  console.log(`[realtime-sync] listening on :${PORT}`)
})
