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
  if (!req.session?.adminId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

