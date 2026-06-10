import { Request, Response } from 'express'
import { db } from '../models/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Verificaciones ─────────────────────────────────────────────────────────

export async function listVerifications(req: Request, res: Response) {
  const status = (req.query.status as string) ?? 'pending'
  try {
    const result = await db.query(`
      SELECT
        vr.user_id,
        vr.status,
        vr.selfie_url,
        vr.submitted_at,
        vr.reviewed_at,
        vr.reviewer_notes,
        p.display_name,
        p.photos,
        u.email
      FROM verification_requests vr
      JOIN profiles p ON p.user_id = vr.user_id
      JOIN users    u ON u.id      = vr.user_id
      WHERE vr.status = $1
      ORDER BY vr.submitted_at ASC
      LIMIT 50
    `, [status])
    return res.json({ ok: true, data: result.rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Error al listar verificaciones' })
  }
}

export async function reviewVerification(req: Request, res: Response) {
  const { userId } = req.params
  const { action, notes } = req.body  // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'Acción inválida' })
  }

  try {
    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    await db.query(`
      UPDATE verification_requests
      SET status = $1, reviewed_at = NOW(), reviewer_notes = $2
      WHERE user_id = $3
    `, [newStatus, notes ?? null, userId])

    if (action === 'approve') {
      await db.query(`UPDATE profiles SET is_verified = true WHERE user_id = $1`, [userId])
    }

    // Notificar al usuario por email
    const userResult = await db.query(`
      SELECT u.email, p.display_name
      FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
    `, [userId])

    if (userResult.rows[0]) {
      const { email, display_name } = userResult.rows[0]
      const subject = action === 'approve'
        ? '✅ Tu perfil fue verificado en Alas'
        : '❌ Tu solicitud de verificación fue rechazada'
      const body = action === 'approve'
        ? `<p>Hola ${display_name}, tu perfil fue verificado exitosamente. Ahora aparecerá el badge ✓ en tu perfil.</p>`
        : `<p>Hola ${display_name}, tu solicitud de verificación fue rechazada${notes ? `: <em>${notes}</em>` : '. Podés intentarlo de nuevo con una foto más clara'}.</p>`

      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'Alas <noreply@alas.app>',
        to: email,
        subject,
        html: `<div style="font-family:sans-serif;max-width:480px">${body}<p style="color:#888;font-size:12px">El equipo de Alas</p></div>`,
      }).catch(() => {})
    }

    return res.json({ ok: true, data: { status: newStatus } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Error al revisar verificación' })
  }
}

// ─── Reportes ───────────────────────────────────────────────────────────────

export async function listReports(req: Request, res: Response) {
  const status = (req.query.status as string) ?? 'pending'
  try {
    const result = await db.query(`
      SELECT
        r.id,
        r.reporter_id,
        r.reported_id AS reported_user_id,
        r.reason,
        r.details,
        r.status,
        r.created_at,
        r.resolved_at,
        r.resolver_notes,
        rp.display_name   AS reporter_name,
        rp.email          AS reporter_email,
        tp.display_name   AS target_name,
        tp.photos         AS target_photos,
        tu.email          AS target_email
      FROM reports r
      JOIN profiles rp ON rp.user_id = r.reporter_id
      JOIN users    ru ON ru.id      = r.reporter_id
      JOIN profiles tp ON tp.user_id = r.reported_id
      JOIN users    tu ON tu.id      = r.reported_id
      WHERE r.status = $1
      ORDER BY r.created_at ASC
      LIMIT 100
    `, [status])
    return res.json({ ok: true, data: result.rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Error al listar reportes' })
  }
}

export async function resolveReport(req: Request, res: Response) {
  const { reportId } = req.params
  const { action, notes } = req.body  // action: 'dismiss' | 'warn' | 'ban'

  if (!['dismiss', 'warn', 'ban'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'Acción inválida' })
  }

  try {
    await db.query(`
      UPDATE reports
      SET status = 'resolved', resolved_at = NOW(), resolver_notes = $1
      WHERE id = $2
    `, [notes ?? action, reportId])

    if (action === 'ban') {
      const rep = await db.query(`SELECT reported_id AS reported_user_id FROM reports WHERE id = $1`, [reportId])
      if (rep.rows[0]) {
        await db.query(`UPDATE users SET is_banned = true WHERE id = $1`, [rep.rows[0].reported_user_id])
      }
    }

    return res.json({ ok: true, data: { action } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Error al resolver reporte' })
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response) {
  try {
    const [users, matches, reports, verifications] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7d FROM users`),
      db.query(`SELECT COUNT(*) AS total FROM matches WHERE status = 'active'`),
      db.query(`SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending, COUNT(*) AS total FROM reports`),
      db.query(`SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending, COUNT(*) AS total FROM verification_requests`),
    ])
    return res.json({
      ok: true,
      data: {
        users:         { total: +users.rows[0].total,         last7d: +users.rows[0].last_7d },
        matches:       { total: +matches.rows[0].total },
        reports:       { pending: +reports.rows[0].pending,       total: +reports.rows[0].total },
        verifications: { pending: +verifications.rows[0].pending, total: +verifications.rows[0].total },
      },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Error al obtener stats' })
  }
}
