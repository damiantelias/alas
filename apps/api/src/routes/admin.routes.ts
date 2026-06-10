import { Router } from 'express'
import { requireAdmin } from '../middleware/adminAuth'
import {
  listVerifications, reviewVerification,
  listReports, resolveReport,
  getStats,
} from '../controllers/admin.controller'

const router = Router()

router.use(requireAdmin)

router.get('/stats',                         getStats)
router.get('/verifications',                 listVerifications)
router.post('/verifications/:userId/review', reviewVerification)
router.get('/reports',                       listReports)
router.post('/reports/:reportId/resolve',    resolveReport)

export default router
