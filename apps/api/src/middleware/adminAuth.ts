import { Request, Response, NextFunction } from 'express'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Alas Admin"')
    return res.status(401).json({ ok: false, error: 'Autenticación requerida' })
  }

  const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':')
  const validUser = process.env.ADMIN_USER ?? 'admin'
  const validPass = process.env.ADMIN_PASS ?? 'changeme'

  if (user !== validUser || pass !== validPass) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Alas Admin"')
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' })
  }

  next()
}
