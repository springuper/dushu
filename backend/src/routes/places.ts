import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// 获取地点列表
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      type,
      faction,
      status,
      search,
      page = '1',
      pageSize = '20',
    } = req.query

    const where: any = {}
    if (type) where.type = type
    if (faction) where.faction = faction
    if (status) where.status = status

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { modernName: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.place.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.place.count({ where }),
    ])

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error) {
    console.error('Get places error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取地点详情
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const place = await prisma.place.findUnique({
      where: { id },
    })

    if (!place) {
      return res.status(404).json({ error: 'Place not found' })
    }

    res.json(place)
  } catch (error) {
    console.error('Get place error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建地点
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.name || !data.coordinates) {
      return res.status(400).json({ error: 'Name and coordinates are required' })
    }

    const place = await prisma.place.create({
      data: {
        name: data.name,
        modernName: data.modernName || '',
        coordinatesLng: data.coordinates.lng,
        coordinatesLat: data.coordinates.lat,
        type: data.type || 'OTHER',
        faction: data.faction,
        relatedEvents: data.relatedEvents || [],
        description: data.description || '',
        firstAppearanceChapterId: data.firstAppearance?.chapterId,
        firstAppearanceParagraphId: data.firstAppearance?.paragraphId,
        status: data.status || 'DRAFT',
      },
    })

    res.json(place)
  } catch (error) {
    console.error('Create place error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新地点
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    const place = await prisma.place.update({
      where: { id },
      data: {
        name: data.name,
        modernName: data.modernName,
        coordinatesLng: data.coordinates?.lng,
        coordinatesLat: data.coordinates?.lat,
        type: data.type,
        faction: data.faction,
        relatedEvents: data.relatedEvents,
        description: data.description,
        firstAppearanceChapterId: data.firstAppearance?.chapterId,
        firstAppearanceParagraphId: data.firstAppearance?.paragraphId,
        status: data.status,
      },
    })

    res.json(place)
  } catch (error) {
    console.error('Update place error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除地点
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.place.delete({
      where: { id },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete place error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

