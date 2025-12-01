import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// 获取事件列表
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      type,
      status,
      locationId,
      personId,
      page = '1',
      pageSize = '20',
    } = req.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (locationId) where.locationId = locationId

    if (personId) {
      where.participants = {
        some: {
          personId: personId as string,
        },
      }
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          participants: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.event.count({ where }),
    ])

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error) {
    console.error('Get events error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取事件详情
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        location: true,
        participants: {
          include: {
            person: true,
          },
        },
      },
    })

    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    res.json(event)
  } catch (error) {
    console.error('Get event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建事件
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.name || !data.timeRange?.start) {
      return res.status(400).json({ error: 'Name and timeRange.start are required' })
    }

    const event = await prisma.event.create({
      data: {
        name: data.name,
        timeRangeStart: data.timeRange.start,
        timeRangeEnd: data.timeRange.end,
        timeRangeLunar: data.timeRange.lunarCalendar,
        locationId: data.locationId,
        chapterId: data.chapterId,
        summary: data.summary || '',
        type: data.type || 'OTHER',
        impact: data.impact,
        relatedParagraphs: data.relatedParagraphs || [],
        status: data.status || 'DRAFT',
        participants: {
          create: (data.participants || []).map((personId: string) => ({
            personId,
          })),
        },
      },
    })

    res.json(event)
  } catch (error) {
    console.error('Create event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新事件
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    // 先删除旧的参与者关系
    await prisma.eventParticipant.deleteMany({
      where: { eventId: id },
    })

    const event = await prisma.event.update({
      where: { id },
      data: {
        name: data.name,
        timeRangeStart: data.timeRange?.start,
        timeRangeEnd: data.timeRange?.end,
        timeRangeLunar: data.timeRange?.lunarCalendar,
        locationId: data.locationId,
        chapterId: data.chapterId,
        summary: data.summary,
        type: data.type,
        impact: data.impact,
        relatedParagraphs: data.relatedParagraphs,
        status: data.status,
        participants: {
          create: (data.participants || []).map((personId: string) => ({
            personId,
          })),
        },
      },
    })

    res.json(event)
  } catch (error) {
    console.error('Update event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除事件
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.event.delete({
      where: { id },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

