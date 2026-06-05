import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createReport } from '../controllers/reports.controller'
import { ReportSchema } from '@alas/validators'

const router = Router()

router.post('/', requireAuth, validate(ReportSchema), createReport)

export default router
