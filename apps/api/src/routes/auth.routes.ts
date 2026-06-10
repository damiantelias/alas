import { Router } from 'express'
import { register, login, refreshToken, logout, forgotPassword, resetPassword, deleteAccount } from '../controllers/auth.controller'
import { validate } from '../middleware/validate'
import { requireAuth } from '../middleware/auth'
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@alas/validators'

const router = Router()

router.post('/register',        validate(RegisterSchema),      register)
router.post('/login',           validate(LoginSchema),         login)
router.post('/refresh',         validate(RefreshTokenSchema),  refreshToken)
router.post('/logout',          requireAuth,                   logout)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password',  resetPassword)
router.delete('/account',       requireAuth,                   deleteAccount)

export default router
