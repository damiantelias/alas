import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createLike, getLikesReceived } from '../controllers/likes.controller'
import { LikeSchema } from '@alas/validators'

const router = Router()

router.post('/',          requireAuth, validate(LikeSchema), createLike)
router.get('/received',   requireAuth, getLikesReceived)

export default router
