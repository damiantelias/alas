import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createLike } from '../controllers/likes.controller'
import { LikeSchema } from '@alas/validators'

const router = Router()

router.post('/', requireAuth, validate(LikeSchema), createLike)

export default router
