import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

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

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        sourceRelationships: {
          include: {
            targetPerson: {
              select: {
                id: true,
                name: true,
                aliases: true,
              },
            },
          },
        },
        targetRelationships: {
          include: {
            sourcePerson: {
              select: {
                id: true,
                name: true,
                aliases: true,
              },
            },
          },
        },
      },
    })

    if (!person) {
      return res.status(404).json({ error: 'Person not found' })
    }

    res.json(person)
  } catch (error) {
    console.error('Get person error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建人物
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    // 验证必填字段
    if (!data.name || !data.biography) {
      return res.status(400).json({ error: 'Name and biography are required' })
    }

    const person = await prisma.person.create({
      data: {
        name: data.name,
        aliases: data.aliases || [],
        role: data.role || 'OTHER',
        faction: data.faction || 'OTHER',
        birthYear: data.birthYear,
        deathYear: data.deathYear,
        activePeriodStart: data.activePeriod?.start,
        activePeriodEnd: data.activePeriod?.end,
        biography: data.biography,
        keyEvents: data.keyEvents || [],
        portraitUrl: data.portraitUrl,
        firstAppearanceChapterId: data.firstAppearance?.chapterId,
        firstAppearanceParagraphId: data.firstAppearance?.paragraphId,
        status: data.status || 'DRAFT',
      },
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

    const person = await prisma.person.update({
      where: { id },
      data: {
        name: data.name,
        aliases: data.aliases,
        role: data.role,
        faction: data.faction,
        birthYear: data.birthYear,
        deathYear: data.deathYear,
        activePeriodStart: data.activePeriod?.start,
        activePeriodEnd: data.activePeriod?.end,
        biography: data.biography,
        keyEvents: data.keyEvents,
        portraitUrl: data.portraitUrl,
        firstAppearanceChapterId: data.firstAppearance?.chapterId,
        firstAppearanceParagraphId: data.firstAppearance?.paragraphId,
        status: data.status,
      },
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

    await prisma.person.delete({
      where: { id },
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

export default router

