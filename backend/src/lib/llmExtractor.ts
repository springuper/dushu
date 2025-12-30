/**
 * 事件中心 LLM 提取器（MVP 版本）
 * 
 * 核心思想：以事件为原子单元，人物信息内嵌在事件中
 * - 事件 (Event)：包含参与者 (actors)、地点、时间、摘要
 * - 人物 (Person)：从事件中聚合的人物信息
 */
import { LLMService } from './llm'
import { createLogger } from './logger'
import { prisma } from './prisma'
import {
  MAX_WINDOW_CHARS,
  LONG_WINDOW_CHARS,
  type ParagraphInput,
  countByType,
  chunkParagraphsWithIds,
  cleanLocationName,
  extractLocationAlias,
  convertPlaceToExtracted,
} from './utils'
import {
  buildEventPrompt,
  eventSystemPrompt,
  buildPersonPrompt,
  personSystemPrompt,
  buildLocationPrompt,
  buildBatchLocationPrompt,
  locationSystemPrompt,
} from './prompts'

const logger = createLogger('extractor')

// ============================================
// 类型定义
// ============================================

export interface EventActor {
  personId?: string | null  // 关联的 Person ID（可选）
  name: string              // 人物名称
  roleType: 'PROTAGONIST' | 'ALLY' | 'OPPOSING' | 'ADVISOR' | 'EXECUTOR' | 'OBSERVER' | 'OTHER'
  description?: string      // 在此事件中的表现
}

export interface ExtractedEvent {
  name: string
  type: 'BATTLE' | 'POLITICAL' | 'PERSONAL' | 'OTHER'
  timeRangeStart: string
  timeRangeEnd?: string | null
  timePrecision: 'EXACT_DATE' | 'MONTH' | 'SEASON' | 'YEAR' | 'DECADE' | 'APPROXIMATE'
  locationName?: string
  locationModernName?: string
  summary: string
  impact?: string
  actors: EventActor[]
  relatedParagraphs?: string[]
}

export interface ExtractedPerson {
  name: string
  aliases: string[]
  role: 'MONARCH' | 'ADVISOR' | 'GENERAL' | 'CIVIL_OFFICIAL' | 'MILITARY_OFFICIAL' | 'RELATIVE' | 'EUNUCH' | 'OTHER'
  faction: 'HAN' | 'CHU' | 'NEUTRAL' | 'OTHER'
  biography: string
  birthYear?: string
  deathYear?: string
  existingId?: string  // 如果匹配到已有记录，记录其 ID
}

export interface ExtractedPlace {
  name: string
  aliases?: string[]
  coordinates?: { lng: number; lat: number }
  modernLocation: string
  modernAddress?: string
  adminLevel1?: string
  adminLevel2?: string
  adminLevel3?: string
  geographicContext?: string
  featureType?: string
  timeRangeBegin?: string
  timeRangeEnd?: string
  chgisId?: string
  source?: 'CHGIS' | 'LLM' | 'HYBRID'
  existingId?: string  // 如果匹配到已有记录，记录其 ID
}

export interface ExtractionResult {
  events: ExtractedEvent[]
  persons: ExtractedPerson[]
  places: ExtractedPlace[]
  meta: {
    chunks: number
    truncatedEvents: string[]
  }
}

// ParagraphInput 类型已移至 utils.ts

// ============================================
// 提取器类
// ============================================

export class LLMExtractor {
  private llm: LLMService

  constructor() {
    this.llm = new LLMService()
  }

  /**
   * 主流程：提取事件和人物
   * @param chapterText 章节全文
   * @param paragraphs 段落列表
   * @param chapterId 章节 ID
   */
  async extract(
    chapterText: string,
    paragraphs: ParagraphInput[] = [],
    chapterId?: string
  ): Promise<ExtractionResult> {
    const timer = logger.startTimer('Extract')
    const startTime = Date.now()
    
    logger.info('========== EXTRACTION STARTED ==========', {
      chapterId,
      paragraphCount: paragraphs.length,
      textLength: chapterText.length,
      textPreview: chapterText.substring(0, 150).replace(/\n/g, ' ') + '...',
    })

    // Step 1: 分块（带段落ID）
    const { chunks, chunkParagraphIds } = chunkParagraphsWithIds(paragraphs, chapterText)
    const chunkSizes = chunks.map(c => c.length)
    logger.info('Step 1/4: Text chunked', {
      chunks: chunks.length,
      avgChunkSize: Math.round(chapterText.length / chunks.length),
      chunkSizes,
      minChunk: Math.min(...chunkSizes),
      maxChunk: Math.max(...chunkSizes),
      paragraphsPerChunk: chunkParagraphIds.map(ids => ids.length),
    })

    // Step 2: 提取事件（带段落关联）
    logger.info('Step 2/4: Extracting events...')
    const eventStartTime = Date.now()
    const { events, truncatedEvents } = await this.extractEvents(chunks, chunkParagraphIds, paragraphs)
    const eventDuration = Date.now() - eventStartTime
    
    logger.info('Step 2/4: Events extraction done', {
      eventCount: events.length,
      truncated: truncatedEvents.length,
      duration: eventDuration,
      eventTypes: countByType(events, 'type'),
    })

    // Step 3: 提取人物（传入已有 Person 数据用于融合）
    logger.info('Step 3/4: Extracting persons...')
    const personStartTime = Date.now()
    const existingPersons = await this.getExistingPersons(events)
    logger.info('Found existing persons for fusion', { count: existingPersons.length })
    const persons = await this.extractPersons(chapterText, events, existingPersons)
    const personDuration = Date.now() - personStartTime
    
    logger.info('Step 3/4: Persons extraction done', {
      personCount: persons.length,
      duration: personDuration,
      roles: countByType(persons, 'role'),
      factions: countByType(persons, 'faction'),
    })

    // Step 4: 提取和增强地点信息（传入已有 Place 数据用于融合）
    logger.info('Step 4/4: Extracting and enhancing locations...')
    const placeStartTime = Date.now()
    const existingPlaces = await this.getExistingPlaces(events)
    logger.info('Found existing places for fusion', { count: existingPlaces.length })
    const places = await this.extractAndEnhanceLocations(events, chapterText, chapterId, existingPlaces)
    const placeDuration = Date.now() - placeStartTime
    
    logger.info('Step 4/4: Locations extraction done', {
      placeCount: places.length,
      duration: placeDuration,
      sources: countByType(places, 'source'),
    })

    const totalDuration = Date.now() - startTime
    timer.end({
      chapterId,
      eventCount: events.length,
      personCount: persons.length,
      placeCount: places.length,
      chunks: chunks.length,
    })

    logger.info('========== EXTRACTION COMPLETED ==========', {
      chapterId,
      events: events.length,
      persons: persons.length,
      places: places.length,
      chunks: chunks.length,
      truncated: truncatedEvents.length,
      totalDuration,
      breakdown: {
        events: eventDuration,
        persons: personDuration,
        places: placeDuration,
      },
    })

    return {
      events,
      persons,
      places,
      meta: {
        chunks: chunks.length,
        truncatedEvents,
      },
    }
  }

  // countByType, chunkParagraphsWithIds 已移至 utils.ts

  /**
   * 提取事件（包含内嵌的 actors 和地点信息，以及段落关联）
   */
  private async extractEvents(
    chunks: string[], 
    chunkParagraphIds: string[][],
    paragraphs: ParagraphInput[]
  ): Promise<{ events: ExtractedEvent[]; truncatedEvents: string[] }> {
    const allEvents: ExtractedEvent[] = []
    const allTruncated: string[] = []
    const startTime = Date.now()

    logger.info('Starting event extraction', { totalChunks: chunks.length })

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const paragraphIds = chunkParagraphIds[i] || []
      
      // 获取该 chunk 中的段落（带ID）用于提示词
      const chunkParagraphs = paragraphIds.map(id => {
        const para = paragraphs.find(p => p.id === id)
        return para ? { id, text: para.text } : null
      }).filter(Boolean) as { id: string; text: string }[]
      
      const prompt = buildEventPrompt(chunk, chunkParagraphs)
      const chunkStartTime = Date.now()
      
      logger.info(`Processing chunk ${i + 1}/${chunks.length} for events`, {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        chunkLength: chunk.length,
        paragraphCount: paragraphIds.length,
        chunkPreview: chunk.substring(0, 100).replace(/\n/g, ' ') + '...',
      })
      
      try {
        const result = await this.llm.callJSON<{
          events: ExtractedEvent[]
          truncated?: string[]
        }>(prompt, eventSystemPrompt())

        const chunkDuration = Date.now() - chunkStartTime
        
        if (result.events) {
          allEvents.push(...result.events)
          // 记录提取到的事件名称
          const eventNames = result.events.map(e => e.name).slice(0, 5)
          const eventsWithParagraphs = result.events.filter(e => e.relatedParagraphs && e.relatedParagraphs.length > 0).length
          logger.info(`Chunk ${i + 1} events extracted`, {
            chunkIndex: i + 1,
            eventsFound: result.events.length,
            eventsWithParagraphs,
            eventNames: eventNames.length < result.events.length 
              ? [...eventNames, `...+${result.events.length - 5} more`] 
              : eventNames,
            actorsCount: result.events.reduce((sum, e) => sum + (e.actors?.length || 0), 0),
            duration: chunkDuration,
          })
        }
        if (result.truncated && result.truncated.length > 0) {
          allTruncated.push(...result.truncated)
          logger.warn('Some events were truncated', { truncated: result.truncated })
        }
      } catch (err: any) {
        logger.error('Event extraction failed for chunk', {
          chunkIndex: i + 1,
          chunkLength: chunk.length,
          error: err.message,
          stack: err.stack?.split('\n').slice(0, 3).join(' '),
        })
      }
    }

    const totalDuration = Date.now() - startTime
    logger.info('Event extraction completed', {
      totalChunks: chunks.length,
      totalEvents: allEvents.length,
      truncatedCount: allTruncated.length,
      totalDuration,
      avgTimePerChunk: Math.round(totalDuration / chunks.length),
    })

    return { events: allEvents, truncatedEvents: allTruncated }
  }

  // buildEventPrompt 和 eventSystemPrompt 已移至 prompts.ts

  /**
   * 从事件中聚合人物名单，然后补全人物详细信息
   */
  /**
   * 获取已有的人物数据（用于融合）
   */
  private async getExistingPersons(events: ExtractedEvent[]): Promise<any[]> {
    // 从事件中收集所有人物名称
    const personNames = new Set<string>()
    events.forEach(event => {
      event.actors?.forEach(actor => {
        if (actor.name) {
          personNames.add(actor.name)
        }
      })
    })

    if (personNames.size === 0) {
      return []
    }

    const namesList = Array.from(personNames)
    
    // 查询已有的人物（通过名称或别名匹配）
    const existingPersons = await prisma.person.findMany({
      where: {
        OR: [
          { name: { in: namesList } },
          { aliases: { hasSome: namesList } },
        ],
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        name: true,
        aliases: true,
        role: true,
        faction: true,
        biography: true,
        birthYear: true,
        deathYear: true,
        sourceChapterIds: true,
      },
    })

    return existingPersons
  }

  private async extractPersons(
    fullText: string, 
    events: ExtractedEvent[], 
    existingPersons: any[] = []
  ): Promise<ExtractedPerson[]> {
    const startTime = Date.now()
    
    // 从事件中收集所有人物名称
    const personNames = new Set<string>()
    events.forEach(event => {
      event.actors?.forEach(actor => {
        if (actor.name) {
          personNames.add(actor.name)
        }
      })
    })

    if (personNames.size === 0) {
      logger.info('No persons found in events, skipping person extraction')
      return []
    }

    const namesList = Array.from(personNames)
    logger.info('Starting person extraction', {
      personCount: personNames.size,
      existingPersonsCount: existingPersons.length,
      names: namesList.slice(0, 10),
      moreNames: namesList.length > 10 ? `...+${namesList.length - 10} more` : undefined,
      textLengthForPrompt: Math.min(fullText.length, 15000),
    })

    // 调用 LLM 补全人物详细信息（传入已有数据用于融合）
    const prompt = buildPersonPrompt(fullText, namesList, existingPersons)
    try {
      const result = await this.llm.callJSON<{
        persons: ExtractedPerson[]
      }>(prompt, personSystemPrompt())

      const duration = Date.now() - startTime
      const persons = result.persons || []
      
      // 记录提取结果
      logger.info('Person extraction completed', {
        inputNames: namesList.length,
        outputPersons: persons.length,
        personNames: persons.map(p => p.name).slice(0, 10),
        aliasesTotal: persons.reduce((sum, p) => sum + (p.aliases?.length || 0), 0),
        duration,
      })
      
      // 检查是否有去重（输出人数少于输入人名数）
      if (persons.length < namesList.length) {
        logger.info('Person deduplication detected', {
          inputCount: namesList.length,
          outputCount: persons.length,
          deduplicated: namesList.length - persons.length,
        })
      }

      return persons
    } catch (err: any) {
      const duration = Date.now() - startTime
      logger.error('Person extraction failed', {
        error: err.message,
        personCount: personNames.size,
        duration,
        stack: err.stack?.split('\n').slice(0, 3).join(' '),
      })
      // 如果失败，返回基础信息
      logger.warn('Returning basic person info as fallback', { count: personNames.size })
      return Array.from(personNames).map(name => ({
        name,
        aliases: [],
        role: 'OTHER' as const,
        faction: 'OTHER' as const,
        biography: '',
      }))
    }
  }

  // buildPersonPrompt 和 personSystemPrompt 已移至 prompts.ts

  // cleanLocationName 和 extractLocationAlias 已移至 utils.ts

  /**
   * 获取已有的地点数据（用于融合）
   */
  private async getExistingPlaces(events: ExtractedEvent[]): Promise<any[]> {
    // 从事件中收集所有地点名称
    const locationNames = new Set<string>()
    events.forEach(event => {
      if (event.locationName) {
        event.locationName.split(/[,，]/).forEach(loc => {
          const cleaned = cleanLocationName(loc.trim())
          if (cleaned) locationNames.add(cleaned)
        })
      }
    })

    if (locationNames.size === 0) {
      return []
    }

    const namesList = Array.from(locationNames)
    
    // 查询已有的地点（通过名称或别名匹配）
    const existingPlaces = await (prisma as any).place.findMany({
      where: {
        OR: [
          { name: { in: namesList } },
          { aliases: { hasSome: namesList } },
        ],
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        name: true,
        aliases: true,
        coordinatesLng: true,
        coordinatesLat: true,
        modernLocation: true,
        modernAddress: true,
        adminLevel1: true,
        adminLevel2: true,
        adminLevel3: true,
        geographicContext: true,
        featureType: true,
        timeRangeBegin: true,
        timeRangeEnd: true,
        sourceChapterIds: true,
      },
    })

    return existingPlaces
  }

  /**
   * 从事件中提取和增强地点信息
   */
  private async extractAndEnhanceLocations(
    events: ExtractedEvent[],
    chapterText: string,
    chapterId?: string,
    existingPlaces: any[] = []
  ): Promise<ExtractedPlace[]> {
    const startTime = Date.now()
    
    // 1. 从事件中收集所有地点名称和别名（去重）
    const locationNames = new Set<string>()
    const locationAliasesMap = new Map<string, Set<string>>() // 主地名 -> 别名集合
    
    events.forEach(event => {
      if (event.locationName) {
        // 处理多个地点（逗号分隔）
        event.locationName.split(/[,，]/).forEach(loc => {
          const originalLoc = loc.trim()
          const cleaned = cleanLocationName(originalLoc)
          if (cleaned) {
            locationNames.add(cleaned)
            // 提取别名并存储
            const alias = extractLocationAlias(originalLoc)
            if (alias) {
              if (!locationAliasesMap.has(cleaned)) {
                locationAliasesMap.set(cleaned, new Set<string>())
              }
              locationAliasesMap.get(cleaned)!.add(alias)
            }
          }
        })
      }
    })
    
    if (locationNames.size === 0) {
      logger.info('No locations found in events, skipping location extraction')
      return []
    }
    
    const namesList = Array.from(locationNames)
    logger.info('Starting location extraction and enhancement', {
      locationCount: locationNames.size,
      names: namesList.slice(0, 10),
      moreNames: namesList.length > 10 ? `...+${namesList.length - 10} more` : undefined,
    })
    
    // 2. 批量查询数据库，找出已存在的地点（MVP 阶段：已存在的地点直接跳过）
    const existingPlacesMap = new Map<string, any>()
    const existingPlacesList = await (prisma as any).place.findMany({
      where: {
        name: { in: namesList },
        status: 'PUBLISHED',
      },
    })
    
    existingPlacesList.forEach((place: any) => {
      existingPlacesMap.set(place.name, place)
    })
    
    // 3. 过滤出不存在的地点
    const newLocationNames = namesList.filter(name => !existingPlacesMap.has(name))
    const existingPlacesResult: ExtractedPlace[] = existingPlacesList.map((place: any) =>
      convertPlaceToExtracted(place)
    )
    
    logger.info('Filtered existing places', {
      total: namesList.length,
      existing: existingPlacesList.length,
      new: newLocationNames.length,
    })
    
    // 如果所有地点都已存在，直接返回
    if (newLocationNames.length === 0) {
      logger.info('All locations already exist, skipping extraction')
      return existingPlacesResult
    }
    
    // 4. 对不存在的地点逐个查询 CHGIS API
    const chgisResults = new Map<string, ExtractedPlace>()
    for (const locationName of newLocationNames) {
      try {
        const chgisData = await this.queryCHGIS(locationName, events)
        if (chgisData) {
          chgisData.source = 'CHGIS'
          chgisResults.set(locationName, chgisData)
          logger.debug('CHGIS query succeeded', { locationName })
        }
      } catch (chgisError: any) {
        logger.debug('CHGIS query failed', { 
          locationName, 
          error: chgisError?.message || String(chgisError)
        })
      }
    }
    
    logger.info('CHGIS queries completed', {
      total: newLocationNames.length,
      succeeded: chgisResults.size,
      failed: newLocationNames.length - chgisResults.size,
    })
    
    // 5. 批量调用 LLM 增强所有新地点（即使有 CHGIS 数据，也调用 LLM 获取更丰富的信息）
    const llmPlaces = await this.enhanceLocationsBatchWithLLM(
      newLocationNames,
      chapterText,
      events,
      chgisResults
    )
    
    // 6. 合并 CHGIS 坐标和 LLM 信息，并添加从事件中提取的别名
    const mergedPlaces: ExtractedPlace[] = []
    for (const llmPlace of llmPlaces) {
      const chgisData = chgisResults.get(llmPlace.name)
      
      // 合并从事件中提取的别名
      const extractedAliases = locationAliasesMap.get(llmPlace.name) || new Set<string>()
      const allAliases = new Set<string>([
        ...(llmPlace.aliases || []),
        ...Array.from(extractedAliases)
      ])
      
      let mergedPlace: ExtractedPlace
      if (chgisData && chgisData.coordinates) {
        // 合并：优先使用 CHGIS 的坐标，保留 LLM 的其他信息
        mergedPlace = {
          ...llmPlace,
          aliases: Array.from(allAliases),
          coordinates: chgisData.coordinates,
          modernLocation: chgisData.modernLocation || llmPlace.modernLocation,
          modernAddress: chgisData.modernAddress || llmPlace.modernAddress,
          source: 'HYBRID' as const, // 标记为混合来源
        }
      } else {
        // 没有 CHGIS 数据，直接使用 LLM 结果，但添加提取的别名
        mergedPlace = {
          ...llmPlace,
          aliases: Array.from(allAliases),
        }
      }
      
      mergedPlaces.push(mergedPlace)
      
      // 7. 保存到地点知识库
      try {
        await this.savePlaceToKnowledgeBase(mergedPlace, undefined, chapterId)
      } catch (error: any) {
        logger.error('Failed to save place to knowledge base', {
          locationName: llmPlace.name,
          error: error?.message || String(error),
        })
      }
    }
    
    // 8. 合并已有地点和新地点返回
    const allPlaces = [...existingPlacesResult, ...mergedPlaces]
    
    const duration = Date.now() - startTime
    logger.info('Location extraction completed', {
      inputNames: namesList.length,
      existing: existingPlacesResult.length,
      new: mergedPlaces.length,
      total: allPlaces.length,
      duration,
      sources: countByType(allPlaces, 'source'),
    })
    
    return allPlaces
  }

  /**
   * 查询 CHGIS API
   */
  private async queryCHGIS(
    locationName: string,
    events: ExtractedEvent[]
  ): Promise<ExtractedPlace | null> {
    // 从相关事件中获取年份
    const relatedEvent = events.find(e => 
      e.locationName?.includes(locationName) || 
      e.locationName?.split(/[,，]/).some(loc => cleanLocationName(loc.trim()) === locationName)
    )
    const year = relatedEvent?.timeRangeStart
    
    // 调用 CHGIS API（直接调用，不通过后端路由）
    const CHGIS_API_BASE = 'https://chgis.hudci.org/tgaz/placename'
    const params = new URLSearchParams({
      n: locationName,
      fmt: 'json',
    })
    
    // 年份格式转换
    if (year) {
      let normalizedYear: string | undefined
      // 处理"约前209年"格式
      let workingStr = year.trim()
      if (workingStr.startsWith('约')) {
        workingStr = workingStr.slice(1).trim()
      }
      let isBCE = false
      if (workingStr.startsWith('前')) {
        isBCE = true
        workingStr = workingStr.slice(1).trim()
      } else if (workingStr.startsWith('公元前')) {
        isBCE = true
        workingStr = workingStr.slice(3).trim()
      }
      if (workingStr.endsWith('年')) {
        workingStr = workingStr.slice(0, -1).trim()
      }
      const yearMatch = workingStr.match(/^(\d+)/)
      if (yearMatch) {
        const yearNum = parseInt(yearMatch[1], 10)
        if (!isNaN(yearNum)) {
          normalizedYear = isBCE ? `-${yearNum}` : `${yearNum}`
          params.append('yr', normalizedYear)
        }
      }
    }
    
    const chgisUrl = `${CHGIS_API_BASE}?${params.toString()}`
    
    const response = await fetch(chgisUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`CHGIS API returned ${response.status}`)
    }
    
    const data = await response.json() as any
    
    // 解析 CHGIS 响应
    let results: any[] = []
    if (data.placenames && Array.isArray(data.placenames)) {
      results = data.placenames
    } else if (Array.isArray(data)) {
      results = data
    } else if (data.results && Array.isArray(data.results)) {
      results = data.results
    }
    
    if (results.length === 0) {
      throw new Error('CHGIS no result')
    }
    
    const result = results[0]
    
    // 提取坐标
    let coordinates: { lng: number; lat: number } | null = null
    if (result['xy coordinates']) {
      const coordsStr = result['xy coordinates'].trim()
      const coordsParts = coordsStr.split(',').map((s: string) => s.trim())
      if (coordsParts.length >= 2) {
        const lng = parseFloat(coordsParts[0])
        const lat = parseFloat(coordsParts[1])
        if (!isNaN(lng) && !isNaN(lat)) {
          coordinates = { lng, lat }
        }
      }
    }
    
    if (!coordinates) {
      throw new Error('CHGIS coordinates not found')
    }
    
    // 解析年份范围
    let timeRangeBegin: string | undefined
    let timeRangeEnd: string | undefined
    if (result.years) {
      const yearsMatch = result.years.match(/^(-?\d+)\s*~\s*(-?\d+)$/)
      if (yearsMatch) {
        timeRangeBegin = yearsMatch[1]
        timeRangeEnd = yearsMatch[2]
      }
    }
    
    return {
      name: result.name || locationName,
      coordinates,
      modernLocation: result['parent name'] || result.transcription || locationName,
      adminLevel2: result['parent name'],
      featureType: result['feature type'],
      timeRangeBegin,
      timeRangeEnd,
      chgisId: result.sys_id,
    }
  }

  /**
   * 使用 LLM 批量增强地点信息
   */
  private async enhanceLocationsBatchWithLLM(
    locationNames: string[],
    chapterText: string,
    events: ExtractedEvent[],
    chgisResults: Map<string, ExtractedPlace>
  ): Promise<ExtractedPlace[]> {
    if (locationNames.length === 0) {
      return []
    }
    
    // 为每个地点获取相关年份
    const locationYears = new Map<string, string>()
    locationNames.forEach(locationName => {
      const relatedEvent = events.find(e =>
        e.locationName?.includes(locationName) ||
        e.locationName?.split(/[,，]/).some(loc => cleanLocationName(loc.trim()) === locationName)
      )
      locationYears.set(locationName, relatedEvent?.timeRangeStart || '前209年')
    })
    
    const prompt = buildBatchLocationPrompt(locationNames, locationYears, chapterText, chgisResults)
    
    try {
      const result = await this.llm.callJSON<{
        places: ExtractedPlace[]
      }>(prompt, locationSystemPrompt())
      
      if (!result.places || !Array.isArray(result.places)) {
        throw new Error('LLM returned invalid places data')
      }
      
      // 为所有地点设置 source 字段
      const placesWithSource = result.places.map(place => ({
        ...place,
        source: (place.source || 'LLM') as 'CHGIS' | 'LLM' | 'HYBRID',
      }))
      
      logger.info('Batch LLM location enhancement succeeded', {
        inputCount: locationNames.length,
        outputCount: placesWithSource.length,
      })
      
      return placesWithSource
    } catch (error: any) {
      logger.error('Batch LLM location enhancement failed', { 
        locationCount: locationNames.length,
        error: error?.message || String(error)
      })
      // 如果批量失败，返回空数组（可以考虑回退到逐个处理，但暂时简化）
      return []
    }
  }

  // buildLocationPrompt, buildBatchLocationPrompt, locationSystemPrompt 已移至 prompts.ts
  // convertPlaceToExtracted 已移至 utils.ts

  /**
   * 保存地点到知识库
   */
  private async savePlaceToKnowledgeBase(
    placeData: ExtractedPlace,
    existingPlace: any,
    chapterId?: string
  ): Promise<void> {
    const { prisma } = await import('./prisma')
    
    const data: any = {
      name: placeData.name,
      aliases: placeData.aliases || [],
      coordinatesLng: placeData.coordinates?.lng,
      coordinatesLat: placeData.coordinates?.lat,
      modernLocation: placeData.modernLocation,
      modernAddress: placeData.modernAddress,
      adminLevel1: placeData.adminLevel1,
      adminLevel2: placeData.adminLevel2,
      adminLevel3: placeData.adminLevel3,
      geographicContext: placeData.geographicContext,
      featureType: placeData.featureType,
      source: placeData.source === 'CHGIS' ? 'CHGIS' : placeData.source === 'LLM' ? 'LLM' : 'HYBRID',
      chgisId: placeData.chgisId,
      timeRangeBegin: placeData.timeRangeBegin,
      timeRangeEnd: placeData.timeRangeEnd,
      verified: false, // 默认未验证，需要人工审核
    }
    
    if (existingPlace) {
      // 更新现有记录
      const updatedSourceChapterIds = existingPlace.sourceChapterIds || []
      if (chapterId && !updatedSourceChapterIds.includes(chapterId)) {
        updatedSourceChapterIds.push(chapterId)
      }
      
      // 合并别名：保留已有别名，添加新别名
      const existingAliases = existingPlace.aliases || []
      const newAliases = placeData.aliases || []
      const mergedAliases = Array.from(new Set([...existingAliases, ...newAliases]))
      
      await (prisma as any).place.update({
        where: { id: existingPlace.id },
        data: {
          ...data,
          aliases: mergedAliases,
          sourceChapterIds: updatedSourceChapterIds,
        },
      })
      logger.debug('Place updated in knowledge base', { name: placeData.name })
    } else {
      // 创建新记录
      await (prisma as any).place.create({
        data: {
          ...data,
          sourceChapterIds: chapterId ? [chapterId] : [],
        },
      })
      logger.debug('Place saved to knowledge base', { name: placeData.name })
    }
  }
}

