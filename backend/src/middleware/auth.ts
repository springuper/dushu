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

/**
 * 可选认证中间件
 * - GET 请求：允许通过（用于公开只读 API）
 * - 其他请求（POST/PUT/DELETE）：需要认证
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // GET 请求不需要认证
  if (req.method === 'GET') {
    return next()
  }
  
  // 其他请求需要认证
  return requireAuth(req, res, next)
}
