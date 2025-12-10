import { Request, Response, NextFunction } from 'express'

// 注意：session 类型扩展在 express-session 模块中处理
// 这里使用 (req.session as any) 来访问自定义属性

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = req.session as any
  console.log('[auth] checking auth for', req.method, req.path, 'adminId:', session?.adminId)
  if (!session?.adminId) {
    console.log('[auth] unauthorized, returning 401')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  console.log('[auth] authorized, calling next()')
  next()
}
