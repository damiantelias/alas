import { Response } from 'express'
import { db } from '../models/db'
import { cache } from '../models/redis'
import { AuthRequest } from '../middleware/auth'
import { uploadPhoto } from '../services/storage.service'
import { moderateImage } from '../services/moderation.service'

type VerifyRequest = AuthRequest & { file?: Express.Multer.File }

// ── POST /verify/request ──────────────────────────────────────────────────────

export async function requestVerification(req: VerifyRequest, res: Response) {
  const userId = req.userId!

  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'Se requiere una selfie' })
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ ok: false, error: 'Solo se aceptan imágenes JPG, PNG o WebP' })
  }

  try {
    // Verificar que no tenga ya una verificación aprobada
    const existing = await db.query(
      `SELECT status FROM verification_requests WHERE user_id = $1`,
      [userId]
    )
    if (existing.rows[0]?.status === 'approved') {
      return res.status(409).json({ ok: false, error: 'Tu perfil ya está verificado' })
    }

    // Moderar la selfie
    const mod = await moderateImage(req.file.buffer, req.file.mimetype)
    if (!mod.approved) {
      return res.status(422).json({ ok: false, error: mod.reason })
    }

    // Subir al storage con prefijo verify/
    const url = await uploadPhoto(userId, req.file.buffer, req.file.mimetype, 'verify')

    // Upsert en verification_requests
    await db.query(
      `INSERT INTO verification_requests (user_id, selfie_url, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET selfie_url = $2, status = 'pending', created_at = NOW(), reviewed_at = NULL`,
      [userId, url]
    )

    return res.status(201).json({
      ok: true,
      data: { status: 'pending', message: 'Solicitud enviada. Te notificaremos cuando sea revisada.' },
    })
  } catch (err) {
    console.error('requestVerification error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── GET /verify/status ────────────────────────────────────────────────────────

export async function getVerificationStatus(req: AuthRequest, res: Response) {
  const userId = req.userId!
  try {
    const result = await db.query(
      `SELECT vr.status, vr.created_at, vr.reviewed_at, p.is_profile_verified
       FROM profiles p
       LEFT JOIN verification_requests vr ON vr.user_id = p.user_id
       WHERE p.user_id = $1`,
      [userId]
    )
    const row = result.rows[0]
    if (!row) return res.status(404).json({ ok: false, error: 'Perfil no encontrado' })

    return res.json({
      ok: true,
      data: {
        isVerified:  row.is_profile_verified ?? false,
        requestStatus: row.status ?? null,  // 'pending' | 'approved' | 'rejected' | null
        submittedAt: row.created_at ?? null,
        reviewedAt:  row.reviewed_at ?? null,
      },
    })
  } catch (err) {
    console.error('getVerificationStatus error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
