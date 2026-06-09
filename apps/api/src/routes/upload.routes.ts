import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import { uploadProfilePhoto, deleteProfilePhoto } from '../controllers/upload.controller'

const router  = Router()
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.post('/photo',  authenticate, upload.single('photo'), uploadProfilePhoto)
router.delete('/photo', authenticate, deleteProfilePhoto)

export default router
