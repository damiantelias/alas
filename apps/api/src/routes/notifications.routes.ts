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

// Eliminar el token al cerrar sesion
router.delete('/push-token', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  try {
    await db.query('UPDATE users SET push_token = NULL WHERE id = $1', [userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// Feed de actividad reciente (matches + mensajes recibidos)
router.get('/activity', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  try {
    const matchRows = await db.query(
      `SELECT
         m.id AS match_id,
         m.matched_at,
         p.display_name,
         p.photos
       FROM matches m
       JOIN profiles p ON p.user_id = CASE
         WHEN m.user_a_id = $1 THEN m.user_b_id
         ELSE m.user_a_id
       END
       WHERE (m.user_a_id = $1 OR m.user_b_id = $1)
         AND m.status = 'active'
       ORDER BY m.matched_at DESC
       LIMIT 20`,
      [userId]
    )

    const msgRows = await db.query(
      `SELECT
         msg.id,
         msg.content,
         msg.created_at,
         msg.match_id,
         p.display_name AS sender_name
       FROM messages msg
       JOIN profiles p ON p.user_id = msg.sender_id
       WHERE msg.sender_id != $1
         AND msg.match_id IN (
           SELECT id FROM matches
           WHERE (user_a_id = $1 OR user_b_id = $1) AND status = 'active'
         )
       ORDER BY msg.created_at DESC
       LIMIT 20`,
      [userId]
    )

    const activity = [
      ...matchRows.rows.map((r: any) => ({
        id:        'match_' + r.match_id,
        type:      'new_match',
        title:     'Nuevo match',
        body:      'Vos y ' + r.display_name + ' se gustaron mutuamente',
        createdAt: r.matched_at,
        matchId:   r.match_id,
        photo:     r.photos?.[0]?.url ?? null,
      })),
      ...msgRows.rows.map((r: any) => ({
        id:        'msg_' + r.id,
        type:      'new_message',
        title:     r.sender_name + ' te escribio',
        body:      r.content.length > 80 ? r.content.slice(0, 77) + '...' : r.content,
        createdAt: r.created_at,
        matchId:   r.match_id,
        photo:     null,
      })),
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, 30)

    return res.json({ ok: true, data: { activity } })
  } catch (err) {
    console.error('activity error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

export default router
