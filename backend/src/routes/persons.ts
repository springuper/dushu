/**
 * 人物路由（事件中心 MVP 版本）
 * 
 * Person 不再有独立的关系表，关系通过事件推断
 */
import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logChange } from '../lib/changeLog'
import { PersonRole, Faction } from '@prisma/client'

const router = express.Router()

// 角色映射
function mapRole(role: string | undefined | null): PersonRole {
  if (!role) return 'OTHER'
  const roleMap: Record<string, PersonRole> = {
    EMPEROR: 'MONARCH',
    EMPRESS: 'MONARCH',
    KING: 'MONARCH',
    WARLORD: 'GENERAL',
    MINISTER: 'ADVISOR',
    GENERAL: 'GENERAL',
    SCHOLAR: 'CIVIL_OFFICIAL',
    MONARCH: 'MONARCH',
    ADVISOR: 'ADVISOR',
    CIVIL_OFFICIAL: 'CIVIL_OFFICIAL',
    MILITARY_OFFICIAL: 'MILITARY_OFFICIAL',
    RELATIVE: 'RELATIVE',
    EUNUCH: 'EUNUCH',
    OTHER: 'OTHER',
  }
  return roleMap[role.toUpperCase()] || 'OTHER'
}

// 阵营映射
function mapFaction(faction: string | undefined | null): Faction {
  if (!faction) return 'OTHER'
  const factionMap: Record<string, Faction> = {
    '汉': 'HAN',
    'HAN': 'HAN',
    '楚': 'CHU',
    'CHU': 'CHU',
    'NEUTRAL': 'NEUTRAL',
    'OTHER': 'OTHER',
  }
  return factionMap[faction] || 'OTHER'
}

// 获取人物列表
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      status,
      faction,
      role,
      search,
      page = '1',
      pageSize = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const where: any = {}
    if (status) where.status = status
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

    const orderBy: any = {}
    orderBy[sortBy as string] = sortOrder

    const [items, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip,
        take,
        orderBy,
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
  } catch (error) {
    console.error('Get persons error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取人物详情
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { chapterId } = req.query

    const person = await prisma.person.findUnique({
      where: { id },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    // 如果提供了 chapterId，返回章节视角的信息
    if (chapterId) {
      // 获取该章节中此人物参与的事件
      const events = await prisma.event.findMany({
        where: {
          chapterId: chapterId as string,
          status: 'PUBLISHED',
        },
        orderBy: { timeRangeStart: 'asc' },
      })

      // 筛选此人物参与的事件
      const participatedEvents = events.filter(event => {
        const actors = event.actors as any[]
        return actors?.some(actor => 
          actor.personId === id || 
          actor.name === person.name ||
          person.aliases.includes(actor.name)
        )
      })

      return res.json({
        ...person,
        chapterEvents: participatedEvents,
      })
    }

    res.json(person)
  } catch (error) {
    console.error('Get person error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取人物参与的事件
router.get('/:id/events', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { status = 'PUBLISHED' } = req.query

    const person = await prisma.person.findUnique({
      where: { id },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    // 获取所有发布的事件
    const events = await prisma.event.findMany({
      where: { status: status as any },
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
      orderBy: { timeRangeStart: 'asc' },
    })

    // 筛选此人物参与的事件
    const participatedEvents = events.filter(event => {
      const actors = event.actors as any[]
      return actors?.some(actor => 
        actor.personId === id || 
        actor.name === person.name ||
        person.aliases.includes(actor.name)
      )
    })

    res.json(participatedEvents)
  } catch (error) {
    console.error('Get person events error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建人物
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.name || !data.biography) {
      return res.status(400).json({ error: 'Name and biography are required' })
    }

    const person = await prisma.person.create({
      data: {
        name: data.name,
        aliases: data.aliases || [],
        role: mapRole(data.role),
        faction: mapFaction(data.faction),
        birthYear: data.birthYear || null,
        deathYear: data.deathYear || null,
        biography: data.biography,
        portraitUrl: data.portraitUrl || null,
        sourceChapterIds: data.sourceChapterIds || [],
        status: data.status || 'DRAFT',
      },
    })

    // 记录变更日志
    await logChange({
      entityType: 'PERSON',
      entityId: person.id,
      action: 'CREATE',
      currentData: person,
      changedBy: (req.session as any)?.adminId,
      changeReason: '手动创建',
    })

    res.json(person)
  } catch (error) {
    console.error('Create person error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新人物
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    const previousPerson = await prisma.person.findUnique({ where: { id } })
    if (!previousPerson) {
      return res.status(404).json({ error: 'Person not found' })
    }

    const person = await prisma.person.update({
      where: { id },
      data: {
        name: data.name,
        aliases: data.aliases,
        role: data.role ? mapRole(data.role) : undefined,
        faction: data.faction ? mapFaction(data.faction) : undefined,
        birthYear: data.birthYear,
        deathYear: data.deathYear,
        biography: data.biography,
        portraitUrl: data.portraitUrl,
        sourceChapterIds: data.sourceChapterIds,
        status: data.status,
      },
    })

    // 记录变更日志
    await logChange({
      entityType: 'PERSON',
      entityId: person.id,
      action: 'UPDATE',
      previousData: previousPerson,
      currentData: person,
      changedBy: (req.session as any)?.adminId,
      changeReason: '手动更新',
    })

    res.json(person)
  } catch (error) {
    console.error('Update person error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除人物
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const person = await prisma.person.findUnique({ where: { id } })
    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    await prisma.person.delete({
      where: { id },
    })

    // 记录变更日志
    await logChange({
      entityType: 'PERSON',
      entityId: id,
      action: 'DELETE',
      previousData: person,
      currentData: { deleted: true },
      changedBy: (req.session as any)?.adminId,
      changeReason: '手动删除',
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete person error:', error)
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

    const result = await prisma.person.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    res.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Batch update status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 关系推断 API - 获取两人之间的关系时间线
router.get('/relationships', requireAuth, async (req, res) => {
  try {
    const { personA, personB } = req.query

    if (!personA || !personB) {
      return res.status(400).json({ error: 'personA and personB are required' })
    }

    // 获取两个人物
    const [personAData, personBData] = await Promise.all([
      prisma.person.findUnique({ where: { id: personA as string } }),
      prisma.person.findUnique({ where: { id: personB as string } }),
    ])

    if (!personAData || !personBData) {
      return res.status(404).json({ error: 'One or both persons not found' })
    }

    // 获取所有已发布的事件
    const events = await prisma.event.findMany({
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
      orderBy: { timeRangeStart: 'asc' },
    })

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
  } catch (error) {
    console.error('Get relationships error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
