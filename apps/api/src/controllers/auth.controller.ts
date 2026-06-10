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
    { expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as jwt.SignOptions['expiresIn'] }
  )
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '30d') as jwt.SignOptions['expiresIn'] }
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

// ── POST /auth/forgot-password ────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body
  if (!email) return res.status(400).json({ ok: false, error: 'Email requerido' })

  try {
    const result = await db.query('SELECT id FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()])
    // Siempre responder OK para no revelar si el email existe
    if (!result.rows[0]) {
      return res.json({ ok: true, message: 'Si ese email existe, te enviamos un link.' })
    }
    const userId = result.rows[0].id

    // Generar token seguro
    const crypto = await import('crypto')
    const token  = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, token, expires]
    )

    // Enviar email con Resend
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const resetUrl = `alas://reset-password?token=${token}`

    await resend.emails.send({
      from:    process.env.EMAIL_FROM ?? 'no-reply@alas.app',
      to:      email.toLowerCase(),
      subject: 'Recuperá tu contraseña — Alas',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#08080e;color:#ede9e0;padding:32px;border-radius:16px">
          <h1 style="color:#a855f7;font-size:28px;margin:0 0 8px">🪶 Alas</h1>
          <p style="color:#605b70;margin:0 0 24px">Recuperá tu contraseña</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. El link es válido por 1 hora.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#a855f7;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;margin:24px 0">
            Restablecer contraseña
          </a>
          <p style="color:#605b70;font-size:12px">Si no pediste esto, ignorá este email.</p>
        </div>
      `,
    })

    return res.json({ ok: true, message: 'Si ese email existe, te enviamos un link.' })
  } catch (err) {
    console.error('forgotPassword error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── POST /auth/reset-password ─────────────────────────────────────────────────

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body
  if (!token || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Token y nueva contraseña requeridos' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  try {
    const result = await db.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    )
    if (!result.rows[0]) {
      return res.status(400).json({ ok: false, error: 'El link es inválido o ya expiró.' })
    }
    const { id: tokenId, user_id: userId } = result.rows[0]

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])
    await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId])

    // Invalidar sesiones activas (opcional: eliminar refresh tokens en redis)
    return res.json({ ok: true, message: 'Contraseña actualizada correctamente.' })
  } catch (err) {
    console.error('resetPassword error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── DELETE /auth/account ──────────────────────────────────────────────────────

export async function deleteAccount(req: Request & { userId?: string }, res: Response) {
  const userId = (req as any).userId
  const { password } = req.body
  if (!password) return res.status(400).json({ ok: false, error: 'Contraseña requerida para confirmar' })

  try {
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId])
    if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })

    const valid = await bcrypt.compare(password, result.rows[0].password_hash)
    if (!valid) return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' })

    // Eliminar storage photos (no bloqueante)
    const photosResult = await db.query('SELECT photos FROM profiles WHERE user_id = $1', [userId])
    const photos: { url: string }[] = photosResult.rows[0]?.photos ?? []
    const { deletePhoto } = await import('../services/storage.service')
    await Promise.allSettled(photos.map(p => deletePhoto(p.url)))

    // Eliminar usuario (cascada elimina perfil, matches, likes, mensajes, etc.)
    await db.query('DELETE FROM users WHERE id = $1', [userId])

    return res.json({ ok: true, message: 'Cuenta eliminada permanentemente.' })
  } catch (err) {
    console.error('deleteAccount error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
