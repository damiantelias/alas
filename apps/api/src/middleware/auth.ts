import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
  subscriptionTier?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' })
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; subscriptionTier: string }
    req.userId = payload.userId
    req.subscriptionTier = payload.subscriptionTier
    next()
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' })
  }
}

export function requirePro(req: AuthRequest, res: Response, next: NextFunction) {
  if (!['plus', 'pro'].includes(req.subscriptionTier ?? '')) {
    return res.status(403).json({ ok: false, error: 'Requiere plan Plus o Pro' })
  }
  next()
}
