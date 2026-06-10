import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { uploadProfilePhoto, deleteProfilePhoto, uploadChatAttachment } from '../controllers/upload.controller'

const router       = Router()
const uploadImg    = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5  * 1024 * 1024 } })
const uploadChat   = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.post('/photo',        requireAuth, uploadImg.single('photo'),  uploadProfilePhoto)
router.delete('/photo',      requireAuth, deleteProfilePhoto)
router.post('/chat',         requireAuth, uploadChat.single('file'),  uploadChatAttachment)

export default router
