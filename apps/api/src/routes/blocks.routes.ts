import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/blocks.controller'

const router = Router()

router.post('/:userId',   requireAuth, blockUser)
router.delete('/:userId', requireAuth, unblockUser)
router.get('/',           requireAuth, getBlockedUsers)

export default router
