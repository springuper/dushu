import express from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    // 查找管理员
    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.passwordHash)

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // 设置 session
    req.session!.adminId = admin.id
    req.session!.username = admin.username

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    },
    )
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 登出
router.post('/logout', requireAuth, (req, res) => {
  req.session = undefined
  res.json({ success: true })
})

// 获取当前管理员信息
router.get('/me', requireAuth, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.session!.adminId },
      select: {
        id: true,
        username: true,
      },
    })

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' })
    }

    res.json(admin)
  } catch (error) {
    console.error('Get admin error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

