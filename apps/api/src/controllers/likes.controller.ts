import { Response } from 'express'
import { db } from '../models/db'
import { redis } from '../models/redis'
import { AuthRequest } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'
import { sendPushNotification, getPushToken } from '../services/notifications.service'

export async function createLike(req: AuthRequest, res: Response) {
  const fromUserId = req.userId!
  const tier       = req.subscriptionTier ?? 'free'
  const { toUserId, action } = req.body

  if (fromUserId === toUserId) {
    return res.status(400).json({ ok: false, error: 'No podés likearte a vos mismo.' })
  }

  try {
    // Límite diario para free: 10 likes, 3 super likes
    if (tier === 'free') {
      if (action === 'like') {
        const count = await db.query(
          `SELECT COUNT(*) FROM likes
           WHERE from_user_id = $1 AND action = 'like'
             AND created_at > NOW() - INTERVAL '24 hours'`,
          [fromUserId]
        )
        if (parseInt(count.rows[0].count, 10) >= 10) {
          return res.status(403).json({
            ok: false,
            error: 'Límite de 10 likes diarios alcanzado. Actualizá a Plus.',
            upgradeRequired: true,
          })
        }
      }
      if (action === 'super') {
        const superCount = await db.query(
          `SELECT COUNT(*) FROM likes
           WHERE from_user_id = $1 AND action = 'super'
             AND created_at > NOW() - INTERVAL '24 hours'`,
          [fromUserId]
        )
        if (parseInt(superCount.rows[0].count, 10) >= 3) {
          return res.status(403).json({
            ok: false,
            error: 'Límite de 3 super likes diarios alcanzado. Actualizá a Plus para ilimitados.',
            upgradeRequired: true,
          })
        }
      }
    }

    // Insertar like (ON CONFLICT para evitar duplicados)
    await db.query(
      `INSERT INTO likes (id, from_user_id, to_user_id, action, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (from_user_id, to_user_id)
       DO UPDATE SET action = $4`,
      [uuidv4(), fromUserId, toUserId, action]
    )

    // Si es 'pass', terminamos acá
    if (action === 'pass') {
      return res.json({ ok: true, data: { match: false } })
    }

    // Verificar si hay like mutuo → crear match
    const mutual = await db.query(
      `SELECT id FROM likes
       WHERE from_user_id = $1 AND to_user_id = $2 AND action IN ('like', 'super')`,
      [toUserId, fromUserId]
    )

    if (!mutual.rows[0]) {
      return res.json({ ok: true, data: { match: false } })
    }

    // ¡Match! Verificar que no exista ya
    const existing = await db.query(
      `SELECT id FROM matches
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)`,
      [fromUserId, toUserId]
    )
    if (existing.rows[0]) {
      return res.json({ ok: true, data: { match: true, matchId: existing.rows[0].id } })
    }

    // Crear el match
    const matchId = uuidv4()
    await db.query(
      `INSERT INTO matches (id, user_a_id, user_b_id, status, matched_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
      [matchId, fromUserId, toUserId]
    )

    // Notificar a ambos usuarios via Redis pub/sub
    const notification = JSON.stringify({
      type: 'new_match',
      matchId,
      fromUserId,
      toUserId,
      timestamp: new Date().toISOString(),
    })
    await redis.publish('match:new', notification)

    // Obtener nombres para el push
    const namesResult = await db.query(
      `SELECT p.user_id, p.display_name
       FROM profiles p WHERE p.user_id = ANY($1::uuid[])`,
      [[fromUserId, toUserId]]
    )
    const names: Record<string, string> = {}
    for (const row of namesResult.rows) names[row.user_id] = row.display_name

    // Push al usuario que recibió el like (toUserId)
    const toToken = await getPushToken(db, toUserId)
    if (toToken) {
      await sendPushNotification({
        to: toToken,
        title: '¡Es un match! 🪶',
        body: `Vos y ${names[fromUserId] ?? 'alguien'} se gustaron mutuamente`,
        data: { type: 'new_match', matchId },
      })
    }

    // Push a quien dio el like (fromUserId) también
    const fromToken = await getPushToken(db, fromUserId)
    if (fromToken) {
      await sendPushNotification({
        to: fromToken,
        title: '¡Es un match! 🪶',
        body: `Vos y ${names[toUserId] ?? 'alguien'} se gustaron mutuamente`,
        data: { type: 'new_match', matchId },
      })
    }

    return res.status(201).json({
      ok: true,
      data: { match: true, matchId },
    })
  } catch (err) {
    console.error('createLike error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── GET /likes/received ───────────────────────────────────────────────────────
// Solo para usuarios Plus/Pro: ver quién te dio like (sin match aún)

export async function getLikesReceived(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const tier   = req.subscriptionTier ?? 'free'

  if (tier === 'free') {
    return res.status(403).json({
      ok: false,
      error: 'Esta función es exclusiva de Alas Plus.',
      upgradeRequired: true,
    })
  }

  try {
    const result = await db.query(
      `SELECT
         l.id            AS like_id,
         l.action,
         l.created_at,
         p.user_id,
         p.display_name,
         p.bio,
         p.photos,
         p.city,
         p.country_code,
         p.is_profile_verified,
         DATE_PART('year', AGE(p.birthdate::date)) AS age,
         p.gender_identity
       FROM likes l
       JOIN profiles p ON p.user_id = l.from_user_id
       JOIN users u ON u.id = l.from_user_id
       WHERE l.to_user_id = $1
         AND l.action IN ('like', 'super')
         AND u.is_active = true
         -- Excluir quienes ya son matches
         AND l.from_user_id NOT IN (
           SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
           FROM matches WHERE (user_a_id = $1 OR user_b_id = $1) AND status = 'active'
         )
         -- Excluir a quienes ya pasaste
         AND l.from_user_id NOT IN (
           SELECT to_user_id FROM likes WHERE from_user_id = $1
         )
       ORDER BY l.created_at DESC
       LIMIT 50`,
      [userId]
    )

    const likes = result.rows.map(row => ({
      likeId:        row.like_id,
      action:        row.action,
      createdAt:     row.created_at,
      user: {
        userId:        row.user_id,
        displayName:   row.display_name,
        age:           parseInt(row.age, 10),
        bio:           row.bio,
        photos:        row.photos,
        city:          row.city,
        countryCode:   row.country_code,
        isVerified:    row.is_profile_verified,
        genderIdentity: row.gender_identity,
      },
    }))

    return res.json({ ok: true, data: { likes, total: likes.length } })
  } catch (err) {
    console.error('getLikesReceived error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
