import express from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { createLogger } from '../lib/logger'

const router = express.Router()
const logger = createLogger('admin')

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      logger.warn('Login attempt with missing credentials', { username: username || '(empty)' })
      return res.status(400).json({ error: 'Username and password required' })
    }

    // 查找管理员
    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      logger.warn('Login failed - user not found', { username })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.passwordHash)

    if (!isValid) {
      logger.warn('Login failed - invalid password', { username })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // 设置 session
    const session = req.session as any
    session.adminId = admin.id
    session.username = admin.username

    logger.info('Login success', { username, adminId: admin.id })

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    })
  } catch (error: any) {
    logger.error('Login error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 登出
router.post('/logout', requireAuth, (req, res) => {
  const session = req.session as any
  const adminId = session?.adminId
  
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error', { error: err.message, adminId })
      return res.status(500).json({ error: 'Internal server error' })
    }
    logger.info('Logout success', { adminId })
    res.json({ success: true })
  })
})

// 获取当前管理员信息
router.get('/me', requireAuth, async (req, res) => {
  try {
    const session = req.session as any
    const admin = await prisma.admin.findUnique({
      where: { id: session?.adminId },
      select: {
        id: true,
        username: true,
      },
    })

    if (!admin) {
      logger.warn('Admin not found for session', { adminId: session?.adminId })
      return res.status(404).json({ error: 'Admin not found' })
    }

    res.json(admin)
  } catch (error: any) {
    logger.error('Get admin error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
