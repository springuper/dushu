/**
 * 事件路由（事件中心 MVP 版本）
 * Event 包含内嵌的 actors JSON 字段
 */
import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logChange } from '../lib/changeLog'
import { createLogger } from '../lib/logger'
import { sortEventsByTime, sortEventsByParagraphAndTime } from '../lib/utils'

const router = express.Router()
const logger = createLogger('events')

// 事件类型映射
function mapEventType(type: string | undefined | null): 'BATTLE' | 'POLITICAL' | 'PERSONAL' | 'OTHER' {
  const normalized = (type || '').toUpperCase()
  const map: Record<string, 'BATTLE' | 'POLITICAL' | 'PERSONAL' | 'OTHER'> = {
    WAR: 'BATTLE',
    BATTLE: 'BATTLE',
    MILITARY: 'BATTLE',
    POLITICS: 'POLITICAL',
    POLITICAL: 'POLITICAL',
    PERSONAL: 'PERSONAL',
  }
  return map[normalized] || 'OTHER'
}

// 获取事件列表
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      type,
      status,
      chapterId,
      search,
      page = '1',
      pageSize = '20',
    } = req.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (chapterId) where.chapterId = chapterId

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { summary: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        include: {
          chapter: {
            select: {
              id: true,
              title: true,
              book: {
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
  } catch (error: any) {
    logger.error('Get events error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取事件详情
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            book: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    res.json(event)
  } catch (error: any) {
    logger.error('Get event error', { eventId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建事件
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.name || !data.timeRangeStart) {
      return res.status(400).json({ error: 'Name and timeRangeStart are required' })
    }
    if (!data.summary || data.summary.trim() === '') {
      return res.status(400).json({ error: 'Summary is required' })
    }
    if (!data.chapterId) {
      return res.status(400).json({ error: 'ChapterId is required' })
    }

    const event = await prisma.event.create({
      data: {
        name: data.name,
        type: mapEventType(data.type),
        timeRangeStart: data.timeRangeStart,
        timeRangeEnd: data.timeRangeEnd || null,
        timePrecision: data.timePrecision || 'YEAR',
        locationName: data.locationName || null,
        locationModernName: data.locationModernName || null,
        summary: data.summary,
        impact: data.impact || null,
        actors: data.actors || [],
        importance: data.importance || null,
        chapterId: data.chapterId,
        relatedParagraphs: data.relatedParagraphs || [],
        status: data.status || 'DRAFT',
      },
    })

    // 记录变更日志
    await logChange({
      entityType: 'EVENT',
      entityId: event.id,
      action: 'CREATE',
      currentData: event,
      changedBy: (req.session as any)?.adminId,
      changeReason: '手动创建',
    })

    logger.info('Event created', { eventId: event.id, name: event.name, chapterId: event.chapterId })
    res.json(event)
  } catch (error: any) {
    logger.error('Create event error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新事件
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const data = req.body

    const previousEvent = await prisma.event.findUnique({ where: { id } })
    if (!previousEvent) {
      return res.status(404).json({ error: 'Event not found' })
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type ? mapEventType(data.type) : undefined,
        timeRangeStart: data.timeRangeStart,
        timeRangeEnd: data.timeRangeEnd,
        timePrecision: data.timePrecision,
        locationName: data.locationName,
        locationModernName: data.locationModernName,
        summary: data.summary,
        impact: data.impact,
        actors: data.actors,
        importance: data.importance,
        chapterId: data.chapterId,
        relatedParagraphs: data.relatedParagraphs,
        status: data.status,
      },
    })

    // 记录变更日志
    await logChange({
      entityType: 'EVENT',
      entityId: event.id,
      action: 'UPDATE',
      previousData: previousEvent,
      currentData: event,
      changedBy: (req.session as any)?.adminId,
      changeReason: '手动更新',
    })

    logger.info('Event updated', { eventId: id })
    res.json(event)
  } catch (error: any) {
    logger.error('Update event error', { eventId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除事件
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    await prisma.event.delete({
      where: { id },
    })

    // 记录变更日志
    await logChange({
      entityType: 'EVENT',
      entityId: id,
      action: 'DELETE',
      previousData: event,
      currentData: { deleted: true },
      changedBy: (req.session as any)?.adminId,
      changeReason: '手动删除',
    })

    logger.info('Event deleted', { eventId: id })
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Delete event error', { eventId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量更新状态
router.post('/batch/status', requireAuth, async (req, res) => {
  try {
    const { ids, status } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' })
    }

    const result = await prisma.event.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    logger.info('Events batch status updated', { count: result.count, status })
    res.json({ success: true, count: result.count })
  } catch (error: any) {
    logger.error('Batch update status error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 按章节获取事件
router.get('/by-chapter/:chapterId', requireAuth, async (req, res) => {
  const { chapterId } = req.params
  try {
    const [rawEvents, paragraphs] = await Promise.all([
      prisma.event.findMany({
        where: { chapterId },
      }),
      prisma.paragraph.findMany({
        where: { chapterId },
        select: { id: true, order: true },
      }),
    ])

    // 构建段落ID到order的映射
    const paragraphOrderMap: Record<string, number> = {}
    for (const para of paragraphs) {
      paragraphOrderMap[para.id] = para.order
    }

    // 按段落顺序和时间排序
    const events = sortEventsByParagraphAndTime(rawEvents, paragraphOrderMap)

    res.json(events)
  } catch (error: any) {
    logger.error('Get events by chapter error', { chapterId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
