import { Response } from 'express'
import { db } from '../models/db'
import { cache, TTL } from '../models/redis'
import { AuthRequest } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(birthdate: string): number {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function formatProfile(row: Record<string, unknown>) {
  return {
    id:                 row.id,
    userId:             row.user_id,
    displayName:        row.display_name,
    bio:                row.bio,
    age:                calcAge(row.birthdate as string),
    birthdate:          row.birthdate,
    genderIdentity:     row.gender_identity,
    sexualOrientation:  row.sexual_orientation,
    lookingFor:         row.looking_for,
    city:               row.city,
    countryCode:        row.country_code,
    photos:             row.photos,
    isIncognito:        row.is_incognito,
    isVerified:         row.is_profile_verified,
  }
}

// ── GET /profiles/me ──────────────────────────────────────────────────────────

export async function getMyProfile(req: AuthRequest, res: Response) {
  const userId = req.userId!
  try {
    const cacheKey = `profile:${userId}`
    const cached = await cache.get(cacheKey)
    if (cached) return res.json({ ok: true, data: cached })

    const result = await db.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [userId]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Perfil no encontrado. Completá tu registro.' })
    }
    const profile = formatProfile(result.rows[0])
    await cache.set(cacheKey, profile, TTL.PROFILE)
    return res.json({ ok: true, data: profile })
  } catch (err) {
    console.error('getMyProfile error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── PUT /profiles/me ──────────────────────────────────────────────────────────

export async function updateMyProfile(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const { displayName, bio, birthdate, genderIdentity, sexualOrientation,
          lookingFor, city, countryCode, latitude, longitude } = req.body
  try {
    // Validar edad mínima 18
    if (birthdate && calcAge(birthdate) < 18) {
      return res.status(400).json({ ok: false, error: 'Tenés que tener al menos 18 años.' })
    }

    const existing = await db.query('SELECT id FROM profiles WHERE user_id = $1', [userId])

    let profile
    if (existing.rows.length === 0) {
      // Crear perfil nuevo
      const profileId = uuidv4()
      const result = await db.query(
        `INSERT INTO profiles
          (id, user_id, display_name, bio, birthdate, gender_identity, sexual_orientation,
           looking_for, location, city, country_code, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
           ST_SetSRID(ST_MakePoint($9,$10),4326),$11,$12,NOW())
         RETURNING *`,
        [profileId, userId, displayName, bio ?? null, birthdate,
         genderIdentity, sexualOrientation, lookingFor ?? [],
         longitude, latitude, city, countryCode]
      )
      profile = result.rows[0]
    } else {
      // Actualizar perfil existente
      const fields: string[] = []
      const values: unknown[] = []
      let idx = 1

      const map: Record<string, unknown> = {
        display_name: displayName, bio, birthdate,
        gender_identity: genderIdentity,
        sexual_orientation: sexualOrientation,
        looking_for: lookingFor, city,
        country_code: countryCode,
      }

      for (const [col, val] of Object.entries(map)) {
        if (val !== undefined) {
          fields.push(`${col} = $${idx++}`)
          values.push(val)
        }
      }

      if (latitude !== undefined && longitude !== undefined) {
        fields.push(`location = ST_SetSRID(ST_MakePoint($${idx++},$${idx++}),4326)`)
        values.push(longitude, latitude)
      }

      if (fields.length === 0) {
        return res.status(400).json({ ok: false, error: 'No hay campos para actualizar' })
      }

      values.push(userId)
      const result = await db.query(
        `UPDATE profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
        values
      )
      profile = result.rows[0]
    }

    const formatted = formatProfile(profile)
    await cache.set(`profile:${userId}`, formatted, TTL.PROFILE)
    return res.json({ ok: true, data: formatted })
  } catch (err) {
    console.error('updateMyProfile error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── GET /profiles/:id ─────────────────────────────────────────────────────────

export async function getProfileById(req: AuthRequest, res: Response) {
  const { id } = req.params
  const viewerId = req.userId!
  try {
    const result = await db.query(
      `SELECT p.*, u.is_verified
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
         AND u.is_active = true
         AND p.is_incognito = false`,
      [id]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Perfil no encontrado' })
    }

    // Verificar si ya hay match entre ellos
    const matchResult = await db.query(
      `SELECT id FROM matches
       WHERE ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1))
         AND status = 'active'`,
      [viewerId, id]
    )

    const profile = {
      ...formatProfile(result.rows[0]),
      hasMatch: matchResult.rows.length > 0,
    }

    return res.json({ ok: true, data: profile })
  } catch (err) {
    console.error('getProfileById error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── POST /profiles/me/photos ──────────────────────────────────────────────────

export async function updatePhotos(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const { photos } = req.body // [{ url, isPrivate, order }]

  if (!Array.isArray(photos) || photos.length > 6) {
    return res.status(400).json({ ok: false, error: 'Máximo 6 fotos permitidas' })
  }

  try {
    await db.query(
      'UPDATE profiles SET photos = $1 WHERE user_id = $2',
      [JSON.stringify(photos), userId]
    )
    await cache.del(`profile:${userId}`)
    return res.json({ ok: true, data: { photos } })
  } catch (err) {
    console.error('updatePhotos error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── PUT /profiles/me/incognito ────────────────────────────────────────────────

export async function toggleIncognito(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const { enabled } = req.body

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'El campo enabled debe ser boolean' })
  }

  try {
    await db.query(
      'UPDATE profiles SET is_incognito = $1 WHERE user_id = $2',
      [enabled, userId]
    )
    await cache.del(`profile:${userId}`)
    return res.json({ ok: true, data: { isIncognito: enabled } })
  } catch (err) {
    console.error('toggleIncognito error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
