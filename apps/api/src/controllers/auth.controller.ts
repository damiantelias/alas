import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../models/db'
import { redis, TTL } from '../models/redis'

function generateTokens(userId: string, tier: string) {
  const accessToken = jwt.sign(
    { userId, subscriptionTier: tier },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m' }
  )
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES ?? '30d' }
  )
  return { accessToken, refreshToken }
}

export async function register(req: Request, res: Response) {
  const { email, password } = req.body
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'Este email ya está registrado' })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const userId = uuidv4()
    await db.query(
      `INSERT INTO users (id, email, password_hash, subscription_tier, created_at, last_seen_at)
       VALUES ($1, $2, $3, 'free', NOW(), NOW())`,
      [userId, email.toLowerCase(), passwordHash]
    )
    const tokens = generateTokens(userId, 'free')
    await redis.setex(`refresh:${userId}`, TTL.USER_SESSION, tokens.refreshToken)
    return res.status(201).json({
      ok: true,
      data: {
        user: { id: userId, email, isVerified: false, subscriptionTier: 'free' },
        profile: null,
        tokens,
      },
    })
  } catch (err) {
    console.error('register error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' })
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body
  try {
    const result = await db.query(
      'SELECT id, email, password_hash, subscription_tier, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    )
    const user = result.rows[0]
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' })
    }
    if (!user.is_active) {
      return res.status(403).json({ ok: false, error: 'Cuenta suspendida' })
    }
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' })
    }
    await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id])
    const tokens = generateTokens(user.id, user.subscription_tier)
    await redis.setex(`refresh:${user.id}`, TTL.USER_SESSION, tokens.refreshToken)

    // Buscar perfil si existe
    const profileResult = await db.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    )
    return res.json({
      ok: true,
      data: {
        user: { id: user.id, email: user.email, isVerified: user.is_verified, subscriptionTier: user.subscription_tier },
        profile: profileResult.rows[0] ?? null,
        tokens,
      },
    })
  } catch (err) {
    console.error('login error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' })
  }
}

export async function refreshToken(req: Request, res: Response) {
  const { refreshToken } = req.body
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string }
    const stored = await redis.get(`refresh:${payload.userId}`)
    if (stored !== refreshToken) {
      return res.status(401).json({ ok: false, error: 'Refresh token inválido' })
    }
    const userResult = await db.query(
      'SELECT id, subscription_tier FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    )
    if (!userResult.rows[0]) {
      return res.status(401).json({ ok: false, error: 'Usuario no encontrado' })
    }
    const user = userResult.rows[0]
    const tokens = generateTokens(user.id, user.subscription_tier)
    await redis.setex(`refresh:${user.id}`, TTL.USER_SESSION, tokens.refreshToken)
    return res.json({ ok: true, data: { tokens } })
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' })
  }
}

export async function logout(req: Request, res: Response) {
  const userId = (req as any).userId
  await redis.del(`refresh:${userId}`)
  return res.json({ ok: true, message: 'Sesión cerrada' })
}
