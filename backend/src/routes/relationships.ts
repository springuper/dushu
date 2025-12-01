import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// 获取关系列表
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      type,
      status,
      personId,
      page = '1',
      pageSize = '20',
    } = req.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (personId) {
      where.OR = [
        { sourceId: personId as string },
        { targetId: personId as string },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.relationship.findMany({
        where,
        skip,
        take,
        include: {
          sourcePerson: {
            select: {
              id: true,
              name: true,
              aliases: true,
            },
          },
          targetPerson: {
            select: {
              id: true,
              name: true,
              aliases: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.relationship.count({ where }),
    ])

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error) {
    console.error('Get relationships error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取关系详情
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const relationship = await prisma.relationship.findUnique({
      where: { id },
      include: {
        sourcePerson: true,
        targetPerson: true,
      },
    })

    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' })
    }

    res.json(relationship)
  } catch (error) {
    console.error('Get relationship error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建关系
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.sourceId || !data.targetId || !data.type) {
      return res.status(400).json({ error: 'sourceId, targetId, and type are required' })
    }

    const relationship = await prisma.relationship.create({
      data: {
        sourceId: data.sourceId,
        targetId: data.targetId,
        type: data.type,
        description: data.description || '',
        referenceChapters: data.referenceChapters || [],
        confidence: data.confidence || 3,
        timeRangeStart: data.timeRange?.start,
        timeRangeEnd: data.timeRange?.end,
        status: data.status || 'DRAFT',
      },
    })

    res.json(relationship)
  } catch (error) {
    console.error('Create relationship error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新关系
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    const relationship = await prisma.relationship.update({
      where: { id },
      data: {
        type: data.type,
        description: data.description,
        referenceChapters: data.referenceChapters,
        confidence: data.confidence,
        timeRangeStart: data.timeRange?.start,
        timeRangeEnd: data.timeRange?.end,
        status: data.status,
      },
    })

    res.json(relationship)
  } catch (error) {
    console.error('Update relationship error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除关系
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.relationship.delete({
      where: { id },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete relationship error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

