import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import rateLimit from 'express-rate-limit'

import { checkDbConnection, db } from './models/db'
import { redis } from './models/redis'
import { setupChatSocket } from './sockets/chat.socket'

import authRoutes          from './routes/auth.routes'
import profileRoutes       from './routes/profiles.routes'
import discoverRoutes      from './routes/discover.routes'
import matchRoutes         from './routes/matches.routes'
import likeRoutes          from './routes/likes.routes'
import reportRoutes        from './routes/reports.routes'
import uploadRoutes        from './routes/upload.routes'
import notificationsRoutes from './routes/notifications.routes'
import subscriptionsRoutes from './routes/subscriptions.routes'
import communityRoutes     from './routes/community.routes'
import verifyRoutes        from './routes/verify.routes'
import blocksRoutes        from './routes/blocks.routes'

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

app.use('/api/auth',          authRoutes)
app.use('/api/profiles',      profileRoutes)
app.use('/api/discover',      discoverRoutes)
app.use('/api/matches',       matchRoutes)
app.use('/api/likes',         likeRoutes)
app.use('/api/reports',       reportRoutes)
app.use('/api/upload',        uploadRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/subscriptions', subscriptionsRoutes)
app.use('/api/community',     communityRoutes)
app.use('/api/verify',        verifyRoutes)
app.use('/api/blocks',        blocksRoutes)

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada' }))
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error no controlado:', err)
  res.status(500).json({ ok: false, error: 'Error interno del servidor' })
})

setupChatSocket(io)

const PORT = Number(process.env.PORT) || 4000

async function runMigrations() {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content      TEXT NOT NULL,
      type         VARCHAR(20) DEFAULT 'text',
      likes_count  INTEGER DEFAULT 0,
      is_deleted   BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS community_post_likes (
      id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id  UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    );
  `)
  await db.query(`
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS is_incognito BOOLEAN DEFAULT false;
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS verification_requests (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selfie_url   TEXT NOT NULL,
      status       VARCHAR(20) DEFAULT 'pending',
      reviewed_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    );
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(blocker_id, blocked_id)
    );
  `)
  console.log('Migrations OK')
}

async function start() {
  try {
    await redis.connect()
    const dbOk = await checkDbConnection()
    if (!dbOk) throw new Error('No se pudo conectar a PostgreSQL')
    await runMigrations()
    http.listen(PORT, () => {
      console.log('Alas API listening on port ' + PORT)
      console.log('Env: ' + (process.env.NODE_ENV ?? 'development'))
    })
  } catch (err) {
    console.error('Startup error:', err)
    process.exit(1)
  }
}

start()
