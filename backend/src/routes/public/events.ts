/**
 * 公开事件 API（无需认证）
 * 只提供读取功能，用于前端用户阅读页面
 */
import express from 'express'
import { prisma } from '../../lib/prisma'
import { createLogger } from '../../lib/logger'

const router = express.Router()
const logger = createLogger('public-events')

/**
 * 解析中文日期字符串为可排序的数值
 * 公元前用负数表示，公元后用正数
 * 例如："前206年" -> -206, "25年" -> 25, "前206年12月" -> -206.01
 */
function parseChineseDate(dateStr: string): number {
  if (!dateStr) return 0
  
  const isBCE = dateStr.startsWith('前')
  const cleanStr = isBCE ? dateStr.substring(1) : dateStr
  
  // 提取年份
  const yearMatch = cleanStr.match(/(\d+)年/)
  if (!yearMatch) return 0
  
  let year = parseInt(yearMatch[1], 10)
  
  // 提取月份作为小数部分（用于更精确排序）
  const monthMatch = cleanStr.match(/(\d+)月/)
  const month = monthMatch ? parseInt(monthMatch[1], 10) / 100 : 0
  
  // 公元前用负数，但注意：前256年比前206年更早，所以需要取负
  // -256 < -206，正确表示 前256年 早于 前206年
  if (isBCE) {
    return -(year - month) // 月份使得同年内的事件可以正确排序
  }
  
  return year + month
}

/**
 * 按时间排序事件（处理公元前/后的正确顺序）
 */
function sortEventsByTime<T extends { timeRangeStart: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const timeA = parseChineseDate(a.timeRangeStart)
    const timeB = parseChineseDate(b.timeRangeStart)
    return timeA - timeB
  })
}

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
    const rawEvents = await prisma.event.findMany({
      where: {
        chapterId,
        status: 'PUBLISHED',
      },
    })

    // 按时间正确排序（处理公元前日期）
    const events = sortEventsByTime(rawEvents)

    res.json(events)
  } catch (error: any) {
    logger.error('Get events by chapter error', { chapterId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

