import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// 获取 Review 列表
router.get('/items', requireAuth, async (req, res) => {
  try {
    const { type, status, source, search, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (source) where.source = source

    // 搜索功能（在 originalData 中搜索）
    // 注意：PostgreSQL JSON 搜索需要使用原生查询或 Prisma 的 JSON 操作符
    // 这里简化处理，使用 contains 搜索
    if (search) {
      // 使用 Prisma 的 JSON 过滤（如果支持）
      // 否则在应用层过滤
      where.OR = [
        // 尝试搜索 JSON 字段（需要根据实际数据结构调整）
        { id: { contains: search as string } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.reviewItem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reviewItem.count({ where }),
    ])

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error) {
    console.error('Get review items error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取 Review 详情
router.get('/items/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const item = await prisma.reviewItem.findUnique({
      where: { id },
    })

    if (!item) {
      return res.status(404).json({ error: 'Review item not found' })
    }

    res.json(item)
  } catch (error) {
    console.error('Get review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 通过审核
router.post('/items/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body

    const item = await prisma.reviewItem.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewerNotes: notes,
        reviewedBy: req.session!.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(item)
  } catch (error) {
    console.error('Approve review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 拒绝审核
router.post('/items/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body

    const item = await prisma.reviewItem.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewerNotes: notes,
        reviewedBy: req.session!.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(item)
  } catch (error) {
    console.error('Reject review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 保存修改
router.post('/items/:id/update', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { modifiedData, notes } = req.body

    const item = await prisma.reviewItem.update({
      where: { id },
      data: {
        status: 'MODIFIED',
        modifiedData,
        reviewerNotes: notes,
        reviewedBy: req.session!.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(item)
  } catch (error) {
    console.error('Update review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量操作
router.post('/items/batch', requireAuth, async (req, res) => {
  try {
    const { ids, action, notes } = req.body // action: 'approve' | 'reject' | 'delete'

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    let result
    if (action === 'approve') {
      result = await prisma.reviewItem.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'APPROVED',
          reviewerNotes: notes,
          reviewedBy: req.session!.adminId,
          reviewedAt: new Date(),
        },
      })
    } else if (action === 'reject') {
      result = await prisma.reviewItem.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'REJECTED',
          reviewerNotes: notes,
          reviewedBy: req.session!.adminId,
          reviewedAt: new Date(),
        },
      })
    } else if (action === 'delete') {
      result = await prisma.reviewItem.deleteMany({
        where: { id: { in: ids } },
      })
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }

    res.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Batch operation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

