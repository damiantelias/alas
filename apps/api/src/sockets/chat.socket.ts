import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { db } from '../models/db'
import { redis } from '../models/redis'
import { v4 as uuidv4 } from 'uuid'

interface AuthSocket extends Socket {
  userId?: string
}

export function setupChatSocket(io: Server) {
  // Autenticación del socket vía JWT
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('Token requerido'))
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      socket.userId = payload.userId
      next()
    } catch {
      next(new Error('Token inválido'))
    }
  })

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!
    console.log(`🔌 Socket conectado: ${userId}`)

    // Unirse a sala personal para notificaciones
    socket.join(`user:${userId}`)

    // Unirse a sala de un match/chat
    socket.on('chat:join', (matchId: string) => {
      socket.join(`match:${matchId}`)
    })

    // Enviar mensaje
    socket.on('chat:message', async (payload: { matchId: string; content: string; type: string }) => {
      try {
        const { matchId, content, type } = payload

        // Verificar que el usuario es parte del match
        const matchResult = await db.query(
          'SELECT id FROM matches WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) AND status = $3',
          [matchId, userId, 'active']
        )
        if (!matchResult.rows[0]) return

        // Guardar mensaje en DB
        const messageId = uuidv4()
        await db.query(
          `INSERT INTO messages (id, match_id, sender_id, content, type, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [messageId, matchId, userId, content, type ?? 'text']
        )

        // Actualizar last_message_at del match
        await db.query(
          'UPDATE matches SET last_message_at = NOW() WHERE id = $1',
          [matchId]
        )

        const message = { id: messageId, matchId, senderId: userId, content, type: type ?? 'text', createdAt: new Date().toISOString() }

        // Emitir a todos en la sala del match
        io.to(`match:${matchId}`).emit('chat:new_message', message)

        // Cache del último mensaje en Redis
        await redis.setex(`last_msg:${matchId}`, 60 * 60, JSON.stringify(message))
      } catch (err) {
        console.error('chat:message error:', err)
      }
    })

    // Typing indicator
    socket.on('chat:typing', (matchId: string) => {
      socket.to(`match:${matchId}`).emit('chat:typing_start', { matchId, userId })
    })

    socket.on('disconnect', () => {
      console.log(`🔌 Socket desconectado: ${userId}`)
    })
  })
}
