import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db } from '../models/db'

const router = Router()

// GET /subscriptions/status — estado actual de suscripcion
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  try {
    const result = await db.query(
      'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
      [userId]
    )
    const user = result.rows[0]
    return res.json({
      ok: true,
      data: {
        tier:      user?.subscription_tier ?? 'free',
        expiresAt: user?.subscription_expires_at ?? null,
      },
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PUT /subscriptions/upgrade — mock: activa Plus por 30 dias
// En produccion esto lo dispara el webhook de MercadoPago/Stripe
router.put('/upgrade', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { plan = 'plus' } = req.body

  if (!['plus', 'pro'].includes(plan)) {
    return res.status(400).json({ ok: false, error: 'Plan invalido' })
  }

  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await db.query(
      `UPDATE users
       SET subscription_tier = $1,
           subscription_expires_at = $2
       WHERE id = $3`,
      [plan, expiresAt.toISOString(), userId]
    )

    return res.json({
      ok: true,
      data: { tier: plan, expiresAt: expiresAt.toISOString() },
    })
  } catch (err) {
    console.error('upgrade error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PUT /subscriptions/downgrade — volver a free (o cuando vence)
router.put('/downgrade', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  try {
    await db.query(
      "UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = $1",
      [userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

export default router
