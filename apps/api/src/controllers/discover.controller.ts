import { Response } from 'express'
import { db } from '../models/db'
import { cache, TTL } from '../models/redis'
import { AuthRequest } from '../middleware/auth'
import { buildCompatibilityFilters, buildDiscoverWhereClause } from '../services/compatibility.service'

const FREE_DAILY_LIKES  = 10
const PAGE_SIZE         = 15

export async function getDiscoverFeed(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const tier   = req.subscriptionTier ?? 'free'

  const {
    radiusKm = 25,
    minAge   = 18,
    maxAge   = 99,
    page     = 1,
    showMe,        // géneros que el usuario quiere ver (manual)
  } = req.query as Record<string, string>

  try {
    // 1. Obtener perfil del viewer
    const viewerResult = await db.query(
      'SELECT gender_identity, sexual_orientation, location, show_me FROM profiles WHERE user_id = $1',
      [userId]
    )
    const viewer = viewerResult.rows[0]
    if (!viewer) {
      return res.status(400).json({ ok: false, error: 'Completá tu perfil antes de descubrir personas.' })
    }
    if (!viewer.location) {
      return res.status(400).json({ ok: false, error: 'Necesitamos tu ubicación para mostrarte perfiles cercanos.' })
    }

    // 2. Chequear límite de likes diarios (plan free)
    if (tier === 'free') {
      const todayLikes = await db.query(
        `SELECT COUNT(*) FROM likes
         WHERE from_user_id = $1
           AND action = 'like'
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
      )
      const count = parseInt(todayLikes.rows[0].count, 10)
      if (count >= FREE_DAILY_LIKES) {
        return res.status(403).json({
          ok: false,
          error: `Llegaste al límite de ${FREE_DAILY_LIKES} likes diarios. Actualizá a Plus para likes ilimitados.`,
          upgradeRequired: true,
        })
      }
    }

    // 3. Construir filtros de compatibilidad
    const showMeArray = showMe ? showMe.split(',') : viewer.show_me ?? []
    const compatFilters = buildCompatibilityFilters(
      viewer.sexual_orientation,
      viewer.gender_identity,
      showMeArray
    )
    const { sql: compatSql, params: compatParams } = buildDiscoverWhereClause(compatFilters, 8)

    // 4. Calcular rango de fechas para edad
    const today    = new Date()
    const minBirth = new Date(today.getFullYear() - Number(maxAge) - 1, today.getMonth(), today.getDate())
    const maxBirth = new Date(today.getFullYear() - Number(minAge),     today.getMonth(), today.getDate())

    // 5. Query principal con PostGIS
    // Excluye: el propio usuario, perfiles ya vistos, perfiles en incógnito,
    // perfiles bloqueados/reportados, usuarios inactivos
    const offset = (Number(page) - 1) * PAGE_SIZE

    const allParams: unknown[] = [
      userId,                         // $1 — excluir propio usuario
      viewer.location,                // $2 — punto de referencia
      Number(radiusKm) * 1000,        // $3 — radio en metros
      minBirth.toISOString(),         // $4 — fecha mínima de nacimiento
      maxBirth.toISOString(),         // $5 — fecha máxima de nacimiento
      PAGE_SIZE,                      // $6 — límite
      offset,                         // $7 — offset paginación
      ...compatParams,                // $8+ — filtros de compatibilidad
    ]

    const query = `
      SELECT
        p.user_id,
        p.display_name,
        p.bio,
        p.gender_identity,
        p.sexual_orientation,
        p.looking_for,
        p.photos,
        p.city,
        p.country_code,
        p.is_profile_verified,
        p.birthdate,
        DATE_PART('year', AGE(p.birthdate::date)) AS age,
        ROUND(
          ST_Distance(p.location, $2::geography) / 1000.0
        ) AS distance_km
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id != $1
        AND u.is_active = true
        AND COALESCE(u.is_banned, false) = false
        AND p.is_incognito = false
        AND p.location IS NOT NULL
        AND p.photos != '[]'::jsonb
        AND ST_DWithin(p.location, $2::geography, $3)
        AND p.birthdate BETWEEN $4 AND $5
        -- Excluir perfiles ya likeados/pasados
        AND p.user_id NOT IN (
          SELECT to_user_id FROM likes WHERE from_user_id = $1
        )
        -- Excluir bloqueados (en ambas direcciones)
        AND p.user_id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = $1
        )
        -- Excluir matches existentes
        AND p.user_id NOT IN (
          SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
          FROM matches WHERE (user_a_id = $1 OR user_b_id = $1)
        )
        ${compatSql}
      ORDER BY
        -- Boost para perfiles verificados
        p.is_profile_verified DESC,
        -- Más cercanos primero
        ST_Distance(p.location, $2::geography) ASC,
        -- Últimos activos primero
        u.last_seen_at DESC
      LIMIT $6 OFFSET $7
    `

    const result = await db.query(query, allParams)

    // 6. Enriquecer con info de quién te likeó (solo plus/pro)
    const profiles = await Promise.all(
      result.rows.map(async (row) => {
        const base = {
          userId:            row.user_id,
          displayName:       row.display_name,
          bio:               row.bio,
          age:               parseInt(row.age, 10),
          genderIdentity:    row.gender_identity,
          sexualOrientation: row.sexual_orientation,
          lookingFor:        row.looking_for,
          photos:            row.photos,
          city:              row.city,
          countryCode:       row.country_code,
          isVerified:        row.is_profile_verified,
          distanceKm:        parseFloat(row.distance_km),
          likedYou:          false,
        }

        // Si es plus/pro: mostrar si ya te likearon
        if (tier !== 'free') {
          const likedResult = await db.query(
            `SELECT id FROM likes
             WHERE from_user_id = $1 AND to_user_id = $2 AND action = 'like'`,
            [row.user_id, userId]
          )
          base.likedYou = likedResult.rows.length > 0
        }

        return base
      })
    )

    return res.json({
      ok: true,
      data: {
        profiles,
        page:     Number(page),
        pageSize: PAGE_SIZE,
        hasMore:  profiles.length === PAGE_SIZE,
        filters: {
          radiusKm:       Number(radiusKm),
          minAge:         Number(minAge),
          maxAge:         Number(maxAge),
          compatibility:  compatFilters,
        },
      },
    })
  } catch (err) {
    console.error('getDiscoverFeed error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
