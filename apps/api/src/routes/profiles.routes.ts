import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { getMyProfile, updateMyProfile, getProfileById, updatePhotos, toggleIncognito } from '../controllers/profiles.controller'
import { CreateProfileSchema } from '@alas/validators'

const router = Router()

router.get('/me',               requireAuth, getMyProfile)
router.put('/me',               requireAuth, validate(CreateProfileSchema.partial()), updateMyProfile)
router.put('/me/photos',        requireAuth, updatePhotos)
router.put('/me/incognito',     requireAuth, toggleIncognito)
router.get('/:id',              requireAuth, getProfileById)

export default router
