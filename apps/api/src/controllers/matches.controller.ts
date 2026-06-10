import { Response } from 'express'
import { db } from '../models/db'
import { cache, TTL } from '../models/redis'
import { AuthRequest } from '../middleware/auth'

// ── GET /matches ───────────────────────────────────────────────────────────────
// Lista de matches con último mensaje y contador de no leídos

export async function getMatches(req: AuthRequest, res: Response) {
  const userId = req.userId!

  try {
    const result = await db.query(
      `SELECT
         m.id            AS match_id,
         m.matched_at,
         m.last_message_at,
         m.status,
         -- Perfil del otro usuario
         p.user_id       AS other_user_id,
         p.display_name,
         p.photos,
         p.city,
         p.is_profile_verified,
         DATE_PART('year', AGE(p.birthdate::date)) AS age,
         -- Último mensaje
         msg.id          AS last_message_id,
         msg.content     AS last_message_content,
         msg.type        AS last_message_type,
         msg.sender_id   AS last_message_sender,
         msg.created_at  AS last_message_at_exact,
         -- Mensajes no leídos
         (
           SELECT COUNT(*) FROM messages unread
           WHERE unread.match_id = m.id
             AND unread.sender_id != $1
             AND unread.read_at IS NULL
         ) AS unread_count
       FROM matches m
       JOIN profiles p ON p.user_id = CASE
         WHEN m.user_a_id = $1 THEN m.user_b_id
         ELSE m.user_a_id
       END
       LEFT JOIN LATERAL (
         SELECT * FROM messages
         WHERE match_id = m.id
         ORDER BY created_at DESC
         LIMIT 1
       ) msg ON true
       WHERE (m.user_a_id = $1 OR m.user_b_id = $1)
         AND m.status = 'active'
       ORDER BY COALESCE(m.last_message_at, m.matched_at) DESC`,
      [userId]
    )

    const matches = result.rows.map(row => ({
      matchId:        row.match_id,
      matchedAt:      row.matched_at,
      status:         row.status,
      otherUser: {
        userId:      row.other_user_id,
        displayName: row.display_name,
        age:         parseInt(row.age, 10),
        photo:       row.photos?.[0]?.url ?? null,
        isVerified:  row.is_profile_verified,
        city:        row.city,
      },
      lastMessage: row.last_message_id ? {
        id:        row.last_message_id,
        content:   row.last_message_content,
        type:      row.last_message_type,
        isFromMe:  row.last_message_sender === userId,
        createdAt: row.last_message_at_exact,
      } : null,
      unreadCount: parseInt(row.unread_count as string, 10),
    }))

    return res.json({ ok: true, data: { matches, total: matches.length } })
  } catch (err) {
    console.error('getMatches error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── GET /matches/:id/messages ──────────────────────────────────────────────────

export async function getMessages(req: AuthRequest, res: Response) {
  const userId  = req.userId!
  const matchId = req.params.id
  const page    = parseInt(req.query.page as string ?? '1', 10)
  const limit   = 30

  try {
    // Verificar que el usuario pertenece al match
    const matchResult = await db.query(
      `SELECT id FROM matches
       WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) AND status = 'active'`,
      [matchId, userId]
    )
    if (!matchResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Match no encontrado' })
    }

    // Obtener mensajes paginados (más recientes primero)
    const offset = (page - 1) * limit
    const result = await db.query(
      `SELECT id, sender_id, content, type, read_at, created_at, deleted_at
       FROM messages
       WHERE match_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [matchId, limit, offset]
    )

    // Marcar como leídos los mensajes del otro usuario
    await db.query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE match_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [matchId, userId]
    )

    const messages = result.rows.reverse().map(row => ({
      id:        row.id,
      senderId:  row.sender_id,
      isFromMe:  row.sender_id === userId,
      content:   row.deleted_at ? null : row.content,
      type:      row.deleted_at ? 'deleted' : row.type,
      readAt:    row.read_at,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
    }))

    return res.json({
      ok: true,
      data: {
        messages,
        page,
        hasMore: result.rows.length === limit,
      },
    })
  } catch (err) {
    console.error('getMessages error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}

// ── DELETE /matches/:id ────────────────────────────────────────────────────────
// "Unmatch" — el usuario deshace el match

export async function unmatch(req: AuthRequest, res: Response) {
  const userId  = req.userId!
  const matchId = req.params.id

  try {
    const result = await db.query(
      `UPDATE matches SET status = 'unmatched'
       WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)
       RETURNING id`,
      [matchId, userId]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Match no encontrado' })
    }
    return res.json({ ok: true, message: 'Match deshecho' })
  } catch (err) {
    console.error('unmatch error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
}
