import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db } from '../models/db'

const router = Router()

// Guardar / actualizar el push token del dispositivo
router.put('/push-token', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { token } = req.body

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ ok: false, error: 'Token requerido' })
  }

  try {
    await db.query('UPDATE users SET push_token = $1 WHERE id = $2', [token, userId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('push-token error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// Eliminar el token al cerrar sesión
router.delete('/push-token', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  try {
    await db.query('UPDATE users SET push_token = NULL WHERE id = $1', [userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

export default router
