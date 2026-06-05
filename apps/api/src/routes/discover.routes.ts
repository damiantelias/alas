import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { getDiscoverFeed } from '../controllers/discover.controller'
import { DiscoverQuerySchema } from '@alas/validators'

const router = Router()

router.get('/', requireAuth, validate(DiscoverQuerySchema, 'query'), getDiscoverFeed)

export default router
