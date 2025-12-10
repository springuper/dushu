/**
 * 公开人物 API（无需认证）
 * 只提供读取功能，用于前端用户阅读页面
 */
import express from 'express'
import { prisma } from '../../lib/prisma'
import { createLogger } from '../../lib/logger'

const router = express.Router()
const logger = createLogger('public-persons')

/**
 * 解析中文日期字符串为可排序的数值
 * 公元前用负数表示，公元后用正数
 */
function parseChineseDate(dateStr: string): number {
  if (!dateStr) return 0
  
  const isBCE = dateStr.startsWith('前')
  const cleanStr = isBCE ? dateStr.substring(1) : dateStr
  
  const yearMatch = cleanStr.match(/(\d+)年/)
  if (!yearMatch) return 0
  
  let year = parseInt(yearMatch[1], 10)
  const monthMatch = cleanStr.match(/(\d+)月/)
  const month = monthMatch ? parseInt(monthMatch[1], 10) / 100 : 0
  
  if (isBCE) {
    return -(year - month)
  }
  return year + month
}

/**
 * 按时间排序事件
 */
function sortEventsByTime<T extends { timeRangeStart: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => parseChineseDate(a.timeRangeStart) - parseChineseDate(b.timeRangeStart))
}

// 获取人物列表（公开，只返回已发布的人物）
router.get('/', async (req, res) => {
  try {
    const {
      faction,
      role,
      search,
      page = '1',
      pageSize = '50',
    } = req.query

    const where: any = {
      status: 'PUBLISHED', // 只返回已发布的人物
    }
    
    if (faction) where.faction = faction
    if (role) where.role = role

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { aliases: { has: search as string } },
        { biography: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.person.count({ where }),
    ])

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error: any) {
    logger.error('Get public persons error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取人物详情（公开）
router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { chapterId } = req.query

    const person = await prisma.person.findFirst({
      where: {
        id,
        status: 'PUBLISHED',
      },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    // 如果提供了 chapterId，返回章节视角的信息
    if (chapterId) {
      const rawEvents = await prisma.event.findMany({
        where: {
          chapterId: chapterId as string,
          status: 'PUBLISHED',
        },
      })

      // 筛选此人物参与的事件
      const participatedEvents = rawEvents.filter(event => {
        const actors = event.actors as any[]
        return actors?.some(actor =>
          actor.personId === id ||
          actor.name === person.name ||
          person.aliases.includes(actor.name)
        )
      })

      return res.json({
        ...person,
        chapterEvents: sortEventsByTime(participatedEvents),
      })
    }

    res.json(person)
  } catch (error: any) {
    logger.error('Get public person error', { personId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取人物参与的事件（公开）
router.get('/:id/events', async (req, res) => {
  const { id } = req.params
  try {
    const person = await prisma.person.findFirst({
      where: {
        id,
        status: 'PUBLISHED',
      },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    // 获取所有发布的事件
    const rawEvents = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
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

    // 筛选此人物参与的事件
    const participatedEvents = rawEvents.filter(event => {
      const actors = event.actors as any[]
      return actors?.some(actor =>
        actor.personId === id ||
        actor.name === person.name ||
        person.aliases.includes(actor.name)
      )
    })

    res.json(sortEventsByTime(participatedEvents))
  } catch (error: any) {
    logger.error('Get person events error', { personId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 关系推断 API - 获取两人之间的关系时间线（公开）
router.get('/relationships/between', async (req, res) => {
  try {
    const { personA, personB } = req.query

    if (!personA || !personB) {
      return res.status(400).json({ error: 'personA and personB are required' })
    }

    // 获取两个人物
    const [personAData, personBData] = await Promise.all([
      prisma.person.findFirst({
        where: { id: personA as string, status: 'PUBLISHED' },
      }),
      prisma.person.findFirst({
        where: { id: personB as string, status: 'PUBLISHED' },
      }),
    ])

    if (!personAData || !personBData) {
      return res.status(404).json({ error: 'One or both persons not found' })
    }

    // 获取所有已发布的事件
    const rawEvents = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
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

    // 按时间排序
    const events = sortEventsByTime(rawEvents)

    // 筛选两人共同参与的事件
    const sharedEvents = events.filter(event => {
      const actors = event.actors as any[]
      if (!actors) return false

      const hasPersonA = actors.some(actor =>
        actor.personId === personA ||
        actor.name === personAData.name ||
        personAData.aliases.includes(actor.name)
      )
      const hasPersonB = actors.some(actor =>
        actor.personId === personB ||
        actor.name === personBData.name ||
        personBData.aliases.includes(actor.name)
      )

      return hasPersonA && hasPersonB
    })

    // 构建关系时间线
    const timeline = sharedEvents.map(event => {
      const actors = event.actors as any[]
      const personARole = actors.find(a =>
        a.personId === personA ||
        a.name === personAData.name ||
        personAData.aliases.includes(a.name)
      )
      const personBRole = actors.find(a =>
        a.personId === personB ||
        a.name === personBData.name ||
        personBData.aliases.includes(a.name)
      )

      return {
        eventId: event.id,
        eventName: event.name,
        eventType: event.type,
        time: event.timeRangeStart,
        summary: event.summary,
        chapter: event.chapter,
        personARole: personARole?.roleType,
        personADescription: personARole?.description,
        personBRole: personBRole?.roleType,
        personBDescription: personBRole?.description,
      }
    })

    res.json({
      personA: personAData,
      personB: personBData,
      sharedEventsCount: sharedEvents.length,
      timeline,
    })
  } catch (error: any) {
    logger.error('Get relationships error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取某人的所有关系（公开）
router.get('/:id/relationships', async (req, res) => {
  const { id } = req.params
  const { limit = '10' } = req.query
  
  try {
    const person = await prisma.person.findFirst({
      where: { id, status: 'PUBLISHED' },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    // 获取所有已发布的事件
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
    })

    // 统计与此人共同参与事件的其他人物
    const relatedPersonIds = new Map<string, number>()

    for (const event of events) {
      const actors = event.actors as any[]
      if (!actors) continue

      const hasPerson = actors.some(actor =>
        actor.personId === id ||
        actor.name === person.name ||
        person.aliases.includes(actor.name)
      )

      if (hasPerson) {
        for (const actor of actors) {
          if (actor.personId && actor.personId !== id) {
            relatedPersonIds.set(
              actor.personId,
              (relatedPersonIds.get(actor.personId) || 0) + 1
            )
          }
        }
      }
    }

    // 按共同事件数排序
    const sortedRelations = Array.from(relatedPersonIds.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Number(limit))

    // 获取相关人物信息
    const relatedPersons = await prisma.person.findMany({
      where: {
        id: { in: sortedRelations.map(r => r[0]) },
        status: 'PUBLISHED',
      },
    })

    const result = sortedRelations.map(([personId, eventCount]) => ({
      person: relatedPersons.find(p => p.id === personId),
      sharedEventCount: eventCount,
    })).filter(r => r.person)

    res.json(result)
  } catch (error: any) {
    logger.error('Get person relationships error', { personId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

