import { Response } from 'express'
import { db } from '../models/db'
import { AuthRequest } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'

export async function createReport(req: AuthRequest, res: Response) {
  const reporterId = req.userId!
  const { reportedUserId, reason, details } = req.body

  if (reporterId === reportedUserId) {
    return res.status(400).json({ ok: false, error: 'Acción inválida' })
  }

  try {
    // Verificar que el usuario reportado existe
    const userResult = await db.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [reportedUserId]
    )
    if (!userResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }

    await db.query(
      `INSERT INTO reports (id, reporter_id, reported_id, reason, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), reporterId, reportedUserId, reason, details ?? null]
    )

    // Auto-bloquear: si un usuario tiene 3+ reportes recientes, suspender temporalmente
    const recentReports = await db.query(
      `SELECT COUNT(*) FROM reports
       WHERE reported_id = $1
         AND created_at > NOW() - INTERVAL '7 days'
         AND status = 'pending'`,
      [reportedUserId]
    )
    if (parseInt(recentReports.rows[0].count, 10) >= 3) {
      await db.query(
        'UPDATE users SET is_active = false WHERE id = $1',
        [reportedUserId]
      )
    }

    return res.status(201).json({ ok: true, message: 'Reporte enviado. Lo revisaremos pronto.' })
  } catch (err) {
    console.error('createReport error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
