import { Response } from 'express'
import { db } from '../models/db'
import { AuthRequest } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'

export async function blockUser(req: AuthRequest, res: Response) {
  const blockerId = req.userId!
  const blockedId = req.params.userId

  if (blockerId === blockedId) {
    return res.status(400).json({ ok: false, error: 'No podés bloquearte a vos mismo.' })
  }

  try {
    await db.query(
      `INSERT INTO blocked_users (id, blocker_id, blocked_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [uuidv4(), blockerId, blockedId]
    )
    // Marcar matches existentes como bloqueados
    await db.query(
      `UPDATE matches SET status = 'blocked'
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)`,
      [blockerId, blockedId]
    )
    return res.json({ ok: true, message: 'Usuario bloqueado' })
  } catch (err) {
    console.error('blockUser error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

export async function unblockUser(req: AuthRequest, res: Response) {
  const blockerId = req.userId!
  const blockedId = req.params.userId
  try {
    await db.query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    )
    return res.json({ ok: true, message: 'Usuario desbloqueado' })
  } catch (err) {
    console.error('unblockUser error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

export async function getBlockedUsers(req: AuthRequest, res: Response) {
  const userId = req.userId!
  try {
    const result = await db.query(
      `SELECT b.blocked_id, p.display_name, p.photos
       FROM blocked_users b
       LEFT JOIN profiles p ON p.user_id = b.blocked_id
       WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
      [userId]
    )
    return res.json({ ok: true, data: { blocked: result.rows } })
  } catch (err) {
    console.error('getBlockedUsers error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
