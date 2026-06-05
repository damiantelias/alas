import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getMatches, getMessages, unmatch } from '../controllers/matches.controller'

const router = Router()

router.get('/',                 requireAuth, getMatches)
router.get('/:id/messages',     requireAuth, getMessages)
router.delete('/:id',           requireAuth, unmatch)

export default router
