/**
 * 地点路由（地点知识库管理）
 */
import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logChange } from '../lib/changeLog'
import { PlaceSource, ContentStatus } from '@prisma/client'
import { createLogger } from '../lib/logger'

const router = express.Router()
const logger = createLogger('places')

// 来源映射
function mapSource(source: string | undefined | null): PlaceSource {
  if (!source) return 'CHGIS'
  const sourceMap: Record<string, PlaceSource> = {
    'CHGIS': 'CHGIS',
    'LLM': 'LLM',
    'HYBRID': 'HYBRID',
    'MANUAL': 'MANUAL',
  }
  return sourceMap[source.toUpperCase()] || 'CHGIS'
}

// 获取地点列表
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      status,
      source,
      search,
      page = '1',
      pageSize = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const where: any = {}
    if (status) where.status = status
    if (source) where.source = source

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { aliases: { has: search as string } },
        { modernLocation: { contains: search as string, mode: 'insensitive' } },
        { geographicContext: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const orderBy: any = {}
    orderBy[sortBy as string] = sortOrder

    const [items, total] = await Promise.all([
      prisma.place.findMany({
        where,
        skip,
        take,
        orderBy,
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
  } catch (error: any) {
    logger.error('Get places error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取单个地点
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
  } catch (error: any) {
    logger.error('Get place error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建地点
router.post('/', requireAuth, async (req, res) => {
  try {
    const adminId = (req.session as any)?.adminId
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const {
      name,
      aliases = [],
      coordinatesLng,
      coordinatesLat,
      modernLocation,
      modernAddress,
      adminLevel1,
      adminLevel2,
      adminLevel3,
      geographicContext,
      featureType,
      source = 'MANUAL',
      chgisId,
      timeRangeBegin,
      timeRangeEnd,
      status = 'DRAFT',
      sourceChapterIds = [],
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const place = await prisma.place.create({
      data: {
        name,
        aliases: Array.isArray(aliases) ? aliases : [],
        coordinatesLng: coordinatesLng ? Number(coordinatesLng) : null,
        coordinatesLat: coordinatesLat ? Number(coordinatesLat) : null,
        modernLocation,
        modernAddress,
        adminLevel1,
        adminLevel2,
        adminLevel3,
        geographicContext,
        featureType,
        source: mapSource(source),
        chgisId,
        timeRangeBegin,
        timeRangeEnd,
        status: status as ContentStatus,
        sourceChapterIds: Array.isArray(sourceChapterIds) ? sourceChapterIds : [],
      },
    })

    await logChange({
      entityType: 'PLACE',
      entityId: place.id,
      action: 'CREATE',
      currentData: place as any,
      changedBy: adminId,
    })

    res.json(place)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Place with this name already exists' })
    }
    logger.error('Create place error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新地点
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const adminId = (req.session as any)?.adminId
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const existingPlace = await prisma.place.findUnique({
      where: { id },
    })

    if (!existingPlace) {
      return res.status(404).json({ error: 'Place not found' })
    }

    const {
      name,
      aliases,
      coordinatesLng,
      coordinatesLat,
      modernLocation,
      modernAddress,
      adminLevel1,
      adminLevel2,
      adminLevel3,
      geographicContext,
      featureType,
      source,
      chgisId,
      timeRangeBegin,
      timeRangeEnd,
      status,
      sourceChapterIds,
    } = req.body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (aliases !== undefined) updateData.aliases = Array.isArray(aliases) ? aliases : []
    if (coordinatesLng !== undefined) updateData.coordinatesLng = coordinatesLng ? Number(coordinatesLng) : null
    if (coordinatesLat !== undefined) updateData.coordinatesLat = coordinatesLat ? Number(coordinatesLat) : null
    if (modernLocation !== undefined) updateData.modernLocation = modernLocation
    if (modernAddress !== undefined) updateData.modernAddress = modernAddress
    if (adminLevel1 !== undefined) updateData.adminLevel1 = adminLevel1
    if (adminLevel2 !== undefined) updateData.adminLevel2 = adminLevel2
    if (adminLevel3 !== undefined) updateData.adminLevel3 = adminLevel3
    if (geographicContext !== undefined) updateData.geographicContext = geographicContext
    if (featureType !== undefined) updateData.featureType = featureType
    if (source !== undefined) updateData.source = mapSource(source)
    if (chgisId !== undefined) updateData.chgisId = chgisId
    if (timeRangeBegin !== undefined) updateData.timeRangeBegin = timeRangeBegin
    if (timeRangeEnd !== undefined) updateData.timeRangeEnd = timeRangeEnd
    if (status !== undefined) updateData.status = status as ContentStatus
    if (sourceChapterIds !== undefined) updateData.sourceChapterIds = Array.isArray(sourceChapterIds) ? sourceChapterIds : []

    const updatedPlace = await prisma.place.update({
      where: { id },
      data: updateData,
    })

    await logChange({
      entityType: 'PLACE',
      entityId: id,
      action: 'UPDATE',
      previousData: existingPlace as any,
      currentData: updatedPlace as any,
      changedBy: adminId,
    })

    res.json(updatedPlace)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Place with this name already exists' })
    }
    logger.error('Update place error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除地点
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const adminId = (req.session as any)?.adminId
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const existingPlace = await prisma.place.findUnique({
      where: { id },
    })

    if (!existingPlace) {
      return res.status(404).json({ error: 'Place not found' })
    }

    await prisma.place.delete({
      where: { id },
    })

    await logChange({
      entityType: 'PLACE',
      entityId: id,
      action: 'DELETE',
      previousData: existingPlace as any,
      currentData: {} as any,
      changedBy: adminId,
    })

    res.json({ success: true })
  } catch (error: any) {
    logger.error('Delete place error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

