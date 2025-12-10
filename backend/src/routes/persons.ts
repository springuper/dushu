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
import { createLogger } from '../lib/logger'

const router = express.Router()
const logger = createLogger('persons')

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
  } catch (error: any) {
    logger.error('Get persons error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取人物详情
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
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
  } catch (error: any) {
    logger.error('Get person error', { personId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取人物参与的事件
router.get('/:id/events', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
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
  } catch (error: any) {
    logger.error('Get person events error', { personId: id, error: error.message })
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

    logger.info('Person created', { personId: person.id, name: person.name })
    res.json(person)
  } catch (error: any) {
    logger.error('Create person error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新人物
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
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

    logger.info('Person updated', { personId: id })
    res.json(person)
  } catch (error: any) {
    logger.error('Update person error', { personId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除人物
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
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

    logger.info('Person deleted', { personId: id })
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Delete person error', { personId: id, error: error.message })
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

    logger.info('Persons batch status updated', { count: result.count, status })
    res.json({ success: true, count: result.count })
  } catch (error: any) {
    logger.error('Batch update status error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 检测潜在重复人物
router.get('/duplicates', requireAuth, async (req, res) => {
  try {
    // 获取所有人物
    const persons = await prisma.person.findMany({
      orderBy: { name: 'asc' },
    })

    // 构建名称到人物的映射
    const nameMap = new Map<string, typeof persons>()
    
    for (const person of persons) {
      // 添加主名称
      const normalizedName = person.name.toLowerCase().trim()
      if (!nameMap.has(normalizedName)) {
        nameMap.set(normalizedName, [])
      }
      nameMap.get(normalizedName)!.push(person)
      
      // 添加别名
      for (const alias of person.aliases) {
        const normalizedAlias = alias.toLowerCase().trim()
        if (!nameMap.has(normalizedAlias)) {
          nameMap.set(normalizedAlias, [])
        }
        const existing = nameMap.get(normalizedAlias)!
        if (!existing.some(p => p.id === person.id)) {
          existing.push(person)
        }
      }
    }

    // 找出有重复的名称（多个人物共享同一名称或别名）
    const duplicateGroups: Array<{
      matchedName: string
      persons: typeof persons
    }> = []
    
    const processedPairs = new Set<string>()
    
    for (const [name, matchedPersons] of nameMap.entries()) {
      if (matchedPersons.length > 1) {
        // 生成配对 ID 以避免重复
        const sortedIds = matchedPersons.map(p => p.id).sort().join(',')
        if (!processedPairs.has(sortedIds)) {
          processedPairs.add(sortedIds)
          duplicateGroups.push({
            matchedName: name,
            persons: matchedPersons,
          })
        }
      }
    }

    // 额外检查：名称在别名中出现
    for (const person of persons) {
      for (const otherPerson of persons) {
        if (person.id === otherPerson.id) continue
        
        // 检查 person.name 是否在 otherPerson.aliases 中
        if (otherPerson.aliases.some(a => a.toLowerCase() === person.name.toLowerCase())) {
          const sortedIds = [person.id, otherPerson.id].sort().join(',')
          if (!processedPairs.has(sortedIds)) {
            processedPairs.add(sortedIds)
            duplicateGroups.push({
              matchedName: person.name,
              persons: [person, otherPerson],
            })
          }
        }
      }
    }

    logger.info('Duplicate detection completed', { groupCount: duplicateGroups.length })
    res.json({
      count: duplicateGroups.length,
      groups: duplicateGroups,
    })
  } catch (error: any) {
    logger.error('Get duplicates error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 合并人物
router.post('/merge', requireAuth, async (req, res) => {
  try {
    const { sourceIds, targetId } = req.body

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ error: '请提供要合并的人物 ID 列表' })
    }

    if (!targetId) {
      return res.status(400).json({ error: '请提供目标人物 ID' })
    }

    if (sourceIds.includes(targetId)) {
      return res.status(400).json({ error: '目标人物不能在源人物列表中' })
    }

    // 获取目标人物
    const targetPerson = await prisma.person.findUnique({
      where: { id: targetId },
    })

    if (!targetPerson) {
      return res.status(404).json({ error: '目标人物不存在' })
    }

    // 获取源人物
    const sourcePersons = await prisma.person.findMany({
      where: { id: { in: sourceIds } },
    })

    if (sourcePersons.length === 0) {
      return res.status(404).json({ error: '源人物不存在' })
    }

    const adminId = (req.session as any)?.adminId
    const previousData = { ...targetPerson }

    // 合并别名
    const allAliases = new Set(targetPerson.aliases)
    for (const sourcePerson of sourcePersons) {
      // 添加源人物的名称作为别名
      allAliases.add(sourcePerson.name)
      // 添加源人物的所有别名
      for (const alias of sourcePerson.aliases) {
        allAliases.add(alias)
      }
    }
    // 移除目标人物的主名称（不应作为别名）
    allAliases.delete(targetPerson.name)
    const mergedAliases = Array.from(allAliases).filter(Boolean)

    // 合并来源章节 ID
    const allSourceChapterIds = new Set(targetPerson.sourceChapterIds)
    for (const sourcePerson of sourcePersons) {
      for (const chapterId of sourcePerson.sourceChapterIds) {
        allSourceChapterIds.add(chapterId)
      }
    }
    const mergedSourceChapterIds = Array.from(allSourceChapterIds)

    // 选择最长的简介
    let bestBiography = targetPerson.biography
    for (const sourcePerson of sourcePersons) {
      if (sourcePerson.biography && 
          !sourcePerson.biography.startsWith('（') &&
          sourcePerson.biography.length > bestBiography.length) {
        bestBiography = sourcePerson.biography
      }
    }

    // 更新目标人物
    const updatedPerson = await prisma.person.update({
      where: { id: targetId },
      data: {
        aliases: mergedAliases,
        sourceChapterIds: mergedSourceChapterIds,
        biography: bestBiography,
        // 如果目标人物没有生卒年，使用源人物的
        birthYear: targetPerson.birthYear || sourcePersons.find(p => p.birthYear)?.birthYear || null,
        deathYear: targetPerson.deathYear || sourcePersons.find(p => p.deathYear)?.deathYear || null,
      },
    })

    // 更新事件中的 actors.personId
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
    })

    let updatedEventCount = 0
    for (const event of events) {
      const actors = event.actors as any[]
      if (!actors) continue

      let needsUpdate = false
      const updatedActors = actors.map(actor => {
        // 如果 actor 指向源人物，更新为目标人物
        if (sourceIds.includes(actor.personId)) {
          needsUpdate = true
          return { ...actor, personId: targetId }
        }
        // 如果 actor 名称匹配源人物的名称或别名
        for (const sourcePerson of sourcePersons) {
          if (actor.name === sourcePerson.name || sourcePerson.aliases.includes(actor.name)) {
            needsUpdate = true
            return { ...actor, personId: targetId }
          }
        }
        return actor
      })

      if (needsUpdate) {
        await prisma.event.update({
          where: { id: event.id },
          data: { actors: updatedActors },
        })
        updatedEventCount++
      }
    }

    // 删除源人物
    await prisma.person.deleteMany({
      where: { id: { in: sourceIds } },
    })

    // 记录变更日志
    await logChange({
      entityType: 'PERSON',
      entityId: targetId,
      action: 'MERGE',
      previousData,
      currentData: updatedPerson,
      changedBy: adminId,
      changeReason: `合并自: ${sourcePersons.map(p => p.name).join(', ')}`,
      mergedFrom: sourceIds,
    })

    logger.info('Persons merged', {
      targetId,
      sourceIds,
      mergedAliasCount: mergedAliases.length,
      updatedEventCount,
    })

    res.json({
      success: true,
      mergedPerson: updatedPerson,
      deletedCount: sourcePersons.length,
      updatedEventCount,
    })
  } catch (error: any) {
    logger.error('Merge persons error', { error: error.message })
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
  } catch (error: any) {
    logger.error('Get relationships error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
