import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db } from '../models/db'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /community/posts — feed de posts
router.get('/posts', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const page   = parseInt(req.query.page as string ?? '1', 10)
  const limit  = 20
  const offset = (page - 1) * limit

  try {
    const result = await db.query(
      `SELECT
         cp.id, cp.content, cp.type, cp.likes_count, cp.created_at,
         p.display_name, p.photos, p.city,
         EXISTS(
           SELECT 1 FROM community_post_likes l
           WHERE l.post_id = cp.id AND l.user_id = $1
         ) AS liked_by_me
       FROM community_posts cp
       JOIN profiles p ON p.user_id = cp.user_id
       WHERE cp.is_deleted = false
       ORDER BY cp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    const posts = result.rows.map((r: any) => ({
      id:          r.id,
      content:     r.content,
      type:        r.type,
      likesCount:  r.likes_count,
      likedByMe:   r.liked_by_me,
      createdAt:   r.created_at,
      author: {
        displayName: r.display_name,
        photo:       r.photos?.[0]?.url ?? null,
        city:        r.city,
      },
    }))

    return res.json({ ok: true, data: { posts, page, hasMore: posts.length === limit } })
  } catch (err) {
    console.error('community posts error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /community/posts — crear post
router.post('/posts', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { content, type = 'text' } = req.body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'El contenido es requerido' })
  }
  if (content.length > 500) {
    return res.status(400).json({ ok: false, error: 'Maximo 500 caracteres' })
  }

  try {
    const id = uuidv4()
    await db.query(
      `INSERT INTO community_posts (id, user_id, content, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, userId, content.trim(), type]
    )
    return res.status(201).json({ ok: true, data: { id } })
  } catch (err) {
    console.error('create post error:', err)
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /community/posts/:id/like — dar/quitar like
router.post('/posts/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const postId = req.params.id

  try {
    const existing = await db.query(
      'SELECT id FROM community_post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    )

    if (existing.rows[0]) {
      await db.query('DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId])
      await db.query('UPDATE community_posts SET likes_count = likes_count - 1 WHERE id = $1', [postId])
      return res.json({ ok: true, data: { liked: false } })
    } else {
      await db.query(
        'INSERT INTO community_post_likes (id, post_id, user_id) VALUES ($1, $2, $3)',
        [uuidv4(), postId, userId]
      )
      await db.query('UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = $1', [postId])
      return res.json({ ok: true, data: { liked: true } })
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

export default router
