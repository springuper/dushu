import { Request, Response, NextFunction } from 'express'
import { createLogger } from '../lib/logger'

const logger = createLogger('auth')

// 注意：session 类型扩展在 express-session 模块中处理
// 这里使用 (req.session as any) 来访问自定义属性

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = req.session as any
  
  if (!session?.adminId) {
    logger.warn('Unauthorized access attempt', {
      method: req.method,
      path: req.path,
      requestId: req.requestId,
    })
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  logger.debug('Auth check passed', {
    adminId: session.adminId,
    path: req.path,
    requestId: req.requestId,
  })
  next()
}

