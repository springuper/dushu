import { Request, Response, NextFunction } from 'express'

// 扩展 Request 类型以包含 session
declare global {
  namespace Express {
    interface Request {
      session?: {
        adminId?: string
        username?: string
      }
    }
  }
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('[auth] checking auth for', req.method, req.path, 'adminId:', req.session?.adminId)
  if (!req.session?.adminId) {
    console.log('[auth] unauthorized, returning 401')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  console.log('[auth] authorized, calling next()')
  next()
}

