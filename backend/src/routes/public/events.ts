/**
 * 公开事件 API（无需认证）
 * 只提供读取功能，用于前端用户阅读页面
 */
import express from 'express'
import { prisma } from '../../lib/prisma'
import { createLogger } from '../../lib/logger'
import { sortEventsByTime, sortEventsByParagraphAndTime } from '../../lib/utils'

const router = express.Router()
const logger = createLogger('public-events')

// 获取事件列表（公开，只返回已发布的事件）
router.get('/', async (req, res) => {
  try {
    const {
      chapterId,
      type,
      search,
      page = '1',
      pageSize = '50',
    } = req.query

    const where: any = {
      status: 'PUBLISHED', // 只返回已发布的事件
    }
    
    if (chapterId) where.chapterId = chapterId
    if (type) where.type = type

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { summary: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [rawItems, total] = await Promise.all([
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
      }),
      prisma.event.count({ where }),
    ])

    // 按时间正确排序（处理公元前日期）
    const items = sortEventsByTime(rawItems)

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error: any) {
    logger.error('Get public events error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取事件详情（公开）
router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const event = await prisma.event.findFirst({
      where: {
        id,
        status: 'PUBLISHED', // 只返回已发布的事件
      },
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
    logger.error('Get public event error', { eventId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 按章节获取事件（公开）
router.get('/by-chapter/:chapterId', async (req, res) => {
  const { chapterId } = req.params
  try {
    const [rawEvents, paragraphs] = await Promise.all([
      prisma.event.findMany({
        where: {
          chapterId,
          status: 'PUBLISHED',
        },
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

