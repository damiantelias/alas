import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import rateLimit from 'express-rate-limit'

import { checkDbConnection } from './models/db'
import { redis } from './models/redis'
import { setupChatSocket } from './sockets/chat.socket'

import authRoutes     from './routes/auth.routes'
import profileRoutes  from './routes/profiles.routes'
import discoverRoutes from './routes/discover.routes'
import matchRoutes    from './routes/matches.routes'
import likeRoutes     from './routes/likes.routes'
import reportRoutes   from './routes/reports.routes'

const app  = express()
const http = createServer(app)
const io   = new SocketServer(http, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.set('trust proxy', 1)
app.use(helmet())
app.use(compression())
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://alas.app' : '*' }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })
const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })
app.use('/api', globalLimiter)
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)

app.get('/health', async (_req, res) => {
  const dbOk    = await checkDbConnection()
  const redisOk = redis.status === 'ready'
  res.status(dbOk && redisOk ? 200 : 503).json({
    ok: dbOk && redisOk,
    version: '0.1.0',
    services: { postgres: dbOk, redis: redisOk },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/auth',     authRoutes)
app.use('/api/profiles', profileRoutes)
app.use('/api/discover', discoverRoutes)
app.use('/api/matches',  matchRoutes)
app.use('/api/likes',    likeRoutes)
app.use('/api/reports',  reportRoutes)

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada' }))
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Error no controlado:', err)
  res.status(500).json({ ok: false, error: 'Error interno del servidor' })
})

setupChatSocket(io)

const PORT = Number(process.env.PORT) || 4000

async function start() {
  try {
    await redis.connect()
    const dbOk = await checkDbConnection()
    if (!dbOk) throw new Error('No se pudo conectar a PostgreSQL')
    http.listen(PORT, () => {
      console.log(`\n🚀 Alas API → http://localhost:${PORT}`)
      console.log(`📡 Socket.io activo`)
      console.log(`🔍 Health  → http://localhost:${PORT}/health`)
      console.log(`🌍 Entorno → ${process.env.NODE_ENV ?? 'development'}\n`)
    })
  } catch (err) {
    console.error('❌ No se pudo arrancar:', err)
    process.exit(1)
  }
}

start()
