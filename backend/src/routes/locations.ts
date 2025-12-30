/**
 * 地点查询路由
 * 从地点知识库（数据库）查询历史地名坐标
 * 不再使用 CHGIS API，所有地点信息都存储在数据库中
 */
import express from 'express'
import { createLogger } from '../lib/logger'
import { prisma } from '../lib/prisma'

const router = express.Router()
const logger = createLogger('locations')


/**
 * 查询地点坐标
 * GET /api/locations/search?name=鸿门&year=前206
 * 
 * 从地点知识库（数据库）查询，不再使用 CHGIS API
 */
router.get('/search', async (req, res) => {
  try {
    const { name, year } = req.query

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: '地点名称（name）参数必填',
      })
    }

    // 查询地点知识库
    // 支持通过名称或别名查询
    // 不限制 status，因为提取流程创建的地点可能是 DRAFT 状态
    const searchName = (name as string).trim()
    
    logger.debug('Searching location in knowledge base', { 
      searchName, 
      year,
      queryName: name,
    })
    
    // 先尝试精确匹配（大小写敏感）
    let place = await (prisma as any).place.findFirst({
      where: {
        OR: [
          { name: searchName },
          { aliases: { has: searchName } },
        ],
      },
    })
    
    // 如果精确匹配失败，查询所有地点，在代码中做大小写不敏感匹配
    // 这样可以处理名称大小写不一致的情况
    let allPlacesForSearch: any[] = []
    if (!place) {
      allPlacesForSearch = await (prisma as any).place.findMany({
        take: 1000, // 限制数量，避免性能问题（如果地点很多，可能需要优化）
      })
      
      // 在代码中做大小写不敏感的匹配
      place = allPlacesForSearch.find((p: any) => 
        p.name.toLowerCase() === searchName.toLowerCase() ||
        p.aliases?.some((alias: string) => alias.toLowerCase() === searchName.toLowerCase())
      )
      
      if (place) {
        logger.info('Location found with case-insensitive match', {
          searchName,
          foundName: place.name,
        })
      }
    }
    
    if (place) {
      // 如果知识库中有地点，返回信息（即使没有坐标也返回）
      logger.info('Location found in knowledge base', { 
        searchName,
        foundName: place.name,
        placeId: place.id, 
        source: place.source,
        hasCoordinates: !!(place.coordinatesLng && place.coordinatesLat),
        status: place.status,
        aliases: place.aliases,
      })
      
      return res.json({
        success: true,
        data: {
          id: place.id,
          name: place.name,
          transcription: undefined, // 知识库中没有 transcription
          modernName: place.modernLocation,
          parentName: place.adminLevel2, // 使用二级行政隶属
          coordinates: place.coordinatesLng && place.coordinatesLat ? {
            lng: place.coordinatesLng,
            lat: place.coordinatesLat,
          } : undefined, // 如果没有坐标，返回 undefined
          timeRange: place.timeRangeBegin ? {
            begin: place.timeRangeBegin,
            end: place.timeRangeEnd || '',
          } : undefined,
          featureType: place.featureType,
          source: place.source,
        }
      })
    }
    
    // 如果知识库中没有，尝试模糊匹配（用于调试）
    // 使用之前查询的结果，避免重复查询
    if (allPlacesForSearch.length === 0) {
      allPlacesForSearch = await (prisma as any).place.findMany({
        select: {
          name: true,
          aliases: true,
        },
        take: 100, // 只查询前100个，避免性能问题
      })
    }
    
    const similarNames = allPlacesForSearch
      .filter((p: any) => 
        p.name.includes(searchName) || 
        searchName.includes(p.name) ||
        p.aliases?.some((alias: string) => alias.includes(searchName) || searchName.includes(alias))
      )
      .map((p: any) => p.name)
      .slice(0, 5)
    
    logger.warn('Location not found in knowledge base', { 
      searchName, 
      year,
      similarNames: similarNames.length > 0 ? similarNames : undefined,
      totalPlacesChecked: allPlacesForSearch.length,
    })
    
    return res.status(404).json({
      success: false,
      error: `未找到地点"${searchName}"的坐标信息${year ? `（年份：${year}）` : ''}。该地点可能尚未录入知识库。`,
      similarNames: similarNames.length > 0 ? similarNames : undefined, // 提供相似名称建议
    })
  } catch (error) {
    logger.error('地点查询失败', { error })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误',
    })
  }
})

export default router

