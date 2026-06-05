import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

type Target = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, target: Target = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req[target] = schema.parse(req[target])
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: 'Datos inválidos',
          details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        })
      }
      next(err)
    }
  }
}
