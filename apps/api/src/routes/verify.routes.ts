import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import multer from 'multer'
import { requestVerification, getVerificationStatus } from '../controllers/verify.controller'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const router = Router()

router.post('/request', requireAuth, upload.single('selfie'), requestVerification)
router.get('/status',   requireAuth, getVerificationStatus)

export default router
