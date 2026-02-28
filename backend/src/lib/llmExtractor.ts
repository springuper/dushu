/**
 * 事件中心 LLM 提取器（MVP 版本）
 * 
 * 核心思想：以事件为原子单元，人物信息内嵌在事件中
 * - 事件 (Event)：包含参与者 (actors)、地点、时间、摘要
 * - 人物 (Person)：从事件中聚合的人物信息
 */
import { LLMService } from './llm'
import { createLogger } from './logger'
import {
  MAX_WINDOW_CHARS,
  LONG_WINDOW_CHARS,
  type ParagraphInput,
  countByType,
  chunkParagraphsWithIds,
  cleanLocationName,
  extractLocationAlias,
} from './utils'
import {
  buildEventPrompt,
  buildEventOverviewPrompt,
  buildEventDetailsPrompt,
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

// 事件重要程度级别
export type EventImportance = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

// 第一阶段：事件概览（用于快速提取和排序）
export interface EventOverview {
  name: string
  timeRangeStart: string
  timeRangeEnd?: string | null
  importance: EventImportance
  relatedParagraphs?: string[]  // 用于定位
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
  importance: EventImportance  // 新增：事件重要程度
}

export interface ExtractedPerson {
  name: string
  aliases: string[]
  zi?: string
  role: 'MONARCH' | 'ADVISOR' | 'GENERAL' | 'CIVIL_OFFICIAL' | 'MILITARY_OFFICIAL' | 'RELATIVE' | 'EUNUCH' | 'OTHER'
  faction: 'HAN' | 'CHU' | 'NEUTRAL' | 'OTHER'
  biography: string
  birthYear?: string
  birthDate?: string
  birthPlace?: string
  deathYear?: string
  deathPlace?: string
  nativePlace?: string
  relatedParagraphIds?: string[]
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
  relatedParagraphIds?: string[]
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

    // Step 3: 提取人物（章节绑定，不做融合）
    logger.info('Step 3/4: Extracting persons...')
    const personStartTime = Date.now()
    const persons = await this.extractPersons(chapterText, events)
    const personDuration = Date.now() - personStartTime
    
    logger.info('Step 3/4: Persons extraction done', {
      personCount: persons.length,
      duration: personDuration,
      roles: countByType(persons, 'role'),
      factions: countByType(persons, 'faction'),
    })

    // Step 4: 提取和增强地点信息（章节绑定，不做融合）
    logger.info('Step 4/4: Extracting and enhancing locations...')
    const placeStartTime = Date.now()
    const places = await this.extractAndEnhanceLocations(events, chapterText, chapterId)
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
   * 提取事件（两阶段提取：先提取概览，再提取详情）
   * 第一阶段：提取所有事件的概览信息（名称、时间、重要程度）
   * 第二阶段：按重要程度排序，分页提取详细信息
   */
  private async extractEvents(
    chunks: string[], 
    chunkParagraphIds: string[][],
    paragraphs: ParagraphInput[]
  ): Promise<{ events: ExtractedEvent[]; truncatedEvents: string[] }> {
    const startTime = Date.now()
    const PAGE_SIZE = 25 // 每页返回的事件数量
    const MAX_RETRIES = 0

    logger.info('Starting two-phase event extraction', { 
      totalChunks: chunks.length,
      pageSize: PAGE_SIZE,
    })

    // ============================================
    // 第一阶段：提取所有事件的概览信息
    // ============================================
    logger.info('Phase 1: Extracting event overviews...')
    const allOverviews: EventOverview[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const paragraphIds = chunkParagraphIds[i] || []
      
      const chunkParagraphs = paragraphIds.map(id => {
        const para = paragraphs.find(p => p.id === id)
        return para ? { id, text: para.text } : null
      }).filter(Boolean) as { id: string; text: string }[]
      
      try {
        const prompt = buildEventOverviewPrompt(chunk, chunkParagraphs)
        
        logger.debug(`Extracting overviews for chunk ${i + 1}/${chunks.length}`)

        let retries = 0
        let success = false
        let result: { eventOverviews: EventOverview[] } | null = null

        while (retries <= MAX_RETRIES && !success) {
          try {
            result = await this.llm.callJSON<{ eventOverviews: EventOverview[] }>(
              prompt,
              eventSystemPrompt()
            )
            success = true
          } catch (err: any) {
            retries++
            if (retries > MAX_RETRIES) {
              throw err
            }
            logger.warn(`Overview extraction failed, retrying`, {
              chunkIndex: i + 1,
              retry: retries,
              error: err.message,
            })
            await new Promise(resolve => setTimeout(resolve, 1000 * retries))
          }
        }

        if (result && result.eventOverviews) {
          allOverviews.push(...result.eventOverviews)
          logger.info(`Chunk ${i + 1} overviews extracted`, {
            chunkIndex: i + 1,
            overviewsCount: result.eventOverviews.length,
            importanceBreakdown: this.countByImportance(result.eventOverviews),
          })
        }
      } catch (err: any) {
        logger.error('Event overview extraction failed for chunk', {
          chunkIndex: i + 1,
          error: err.message,
        })
      }
    }

    // 去重和合并（按名称和时间）
    const uniqueOverviews = this.deduplicateOverviews(allOverviews)
    logger.info('Phase 1 completed: Event overviews extracted', {
      totalOverviews: uniqueOverviews.length,
      importanceBreakdown: this.countByImportance(uniqueOverviews),
    })

    // 按重要程度和时间排序
    const sortedOverviews = this.sortOverviewsByImportance(uniqueOverviews)

    // ============================================
    // 第二阶段：分页提取详细信息
    // ============================================
    logger.info('Phase 2: Extracting event details...')
    const allEvents: ExtractedEvent[] = []
    const allTruncated: string[] = []

    // 优先提取L1事件，然后L2，最后L3
    // 数量上限：L1 无上限，L2≤25，L3≤30，总计≤80
    const L2_MAX = 25
    const L3_MAX = 30
    const TOTAL_MAX = 80

    const l1Events = sortedOverviews.filter(o => o.importance === 'L1')
    const l2Events = sortedOverviews.filter(o => o.importance === 'L2').slice(0, L2_MAX)
    const l3Events = sortedOverviews.filter(o => o.importance === 'L3').slice(0, L3_MAX)
    const l4Events = sortedOverviews.filter(o => o.importance === 'L4')

    const combined = [...l1Events, ...l2Events, ...l3Events]
    const eventsToExtract = combined.slice(0, TOTAL_MAX)
    const truncatedOverviews = combined.slice(TOTAL_MAX)
    for (const o of truncatedOverviews) {
      allTruncated.push(o.name)
    }
    if (truncatedOverviews.length > 0) {
      logger.info('Events truncated by limit', {
        truncatedCount: truncatedOverviews.length,
        totalBeforeTruncate: combined.length,
        truncatedNames: truncatedOverviews.slice(0, 5).map(o => o.name),
      })
    }

    logger.info('Phase 2: Events to extract', {
      l1Count: l1Events.length,
      l2Count: l2Events.length,
      l3Count: l3Events.length,
      l4Count: l4Events.length,
      totalToExtract: eventsToExtract.length,
      truncatedCount: truncatedOverviews.length,
    })

    // 分页提取详细信息
    let offset = 0
    let pageNumber = 1

    while (offset < eventsToExtract.length) {
      const endIndex = Math.min(offset + PAGE_SIZE, eventsToExtract.length)
      const pageOverviews = eventsToExtract.slice(offset, endIndex)

      // 获取这些事件所在的所有chunks的文本
      const relevantChunks: string[] = []
      const relevantChunkParagraphs: { id: string; text: string }[][] = []

      for (let i = 0; i < chunks.length; i++) {
        const paragraphIds = chunkParagraphIds[i] || []
        const chunkParagraphs = paragraphIds.map(id => {
          const para = paragraphs.find(p => p.id === id)
          return para ? { id, text: para.text } : null
        }).filter(Boolean) as { id: string; text: string }[]

        // 检查这个chunk是否包含当前页的事件
        const hasRelevantEvent = pageOverviews.some(overview =>
          overview.relatedParagraphs?.some(paraId =>
            paragraphIds.includes(paraId)
          )
        )

        if (hasRelevantEvent) {
          relevantChunks.push(chunks[i])
          relevantChunkParagraphs.push(chunkParagraphs)
        }
      }

      // 合并所有相关chunks的文本
      const combinedText = relevantChunks.join('\n\n')
      const combinedParagraphs = relevantChunkParagraphs.flat()

      try {
        const prompt = buildEventDetailsPrompt(
          pageOverviews,
          combinedText,
          combinedParagraphs
        )

        logger.debug(`Fetching event details page`, {
          pageNumber,
          offset,
          limit: PAGE_SIZE,
          eventsInPage: pageOverviews.length,
        })

        let retries = 0
        let success = false
        let result: {
          eventDetails: ExtractedEvent[]
        } | null = null

        while (retries <= MAX_RETRIES && !success) {
          try {
            result = await this.llm.callJSON<{
              eventDetails: ExtractedEvent[]
            }>(prompt, eventSystemPrompt())

            success = true
          } catch (err: any) {
            retries++
            if (retries > MAX_RETRIES) {
              throw err
            }
            logger.warn(`Details extraction failed, retrying`, {
              pageNumber,
              retry: retries,
              error: err.message,
            })
            await new Promise(resolve => setTimeout(resolve, 1000 * retries))
          }
        }

        if (result && result.eventDetails) {
          allEvents.push(...result.eventDetails)
          logger.info(`Page ${pageNumber} completed`, {
            pageNumber,
            offset,
            eventsInPage: result.eventDetails.length,
            totalEventsSoFar: allEvents.length,
          })
        }

        offset = endIndex
        pageNumber++

        // 添加短暂延迟，避免 API 限流
        if (offset < eventsToExtract.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (err: any) {
        logger.error('Event details extraction failed for page', {
          pageNumber,
          offset,
          error: err.message,
        })
        // 继续处理下一页
        offset = endIndex
        pageNumber++
      }
    }

    const totalDuration = Date.now() - startTime
    logger.info('Event extraction completed', {
      totalChunks: chunks.length,
      totalOverviews: uniqueOverviews.length,
      totalEvents: allEvents.length,
      truncatedCount: allTruncated.length,
      totalDuration,
      avgTimePerChunk: Math.round(totalDuration / chunks.length),
      importanceBreakdown: this.countByImportance(allEvents),
    })

    return { events: allEvents, truncatedEvents: allTruncated }
  }

  /**
   * 按重要程度统计事件数量
   */
  private countByImportance(
    items: Array<{ importance: EventImportance }>
  ): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const item of items) {
      const level = item.importance || 'UNKNOWN'
      counts[level] = (counts[level] || 0) + 1
    }
    return counts
  }

  /**
   * 去重事件概览（按名称和时间）
   */
  private deduplicateOverviews(overviews: EventOverview[]): EventOverview[] {
    const seen = new Map<string, EventOverview>()
    
    for (const overview of overviews) {
      const key = `${overview.name}|${overview.timeRangeStart}`
      if (!seen.has(key)) {
        seen.set(key, overview)
      } else {
        // 如果已存在，合并段落ID
        const existing = seen.get(key)!
        if (overview.relatedParagraphs) {
          const merged = new Set([
            ...(existing.relatedParagraphs || []),
            ...overview.relatedParagraphs,
          ])
          existing.relatedParagraphs = Array.from(merged)
        }
        // 保留更高的重要程度
        if (this.compareImportance(overview.importance, existing.importance) > 0) {
          existing.importance = overview.importance
        }
      }
    }
    
    return Array.from(seen.values())
  }

  /**
   * 按重要程度和时间排序事件概览
   */
  private sortOverviewsByImportance(overviews: EventOverview[]): EventOverview[] {
    return [...overviews].sort((a, b) => {
      // 首先按重要程度排序（L1 > L2 > L3 > L4 > L5）
      const importanceDiff = this.compareImportance(a.importance, b.importance)
      if (importanceDiff !== 0) {
        return -importanceDiff // 降序
      }
      
      // 同级别内按时间排序
      return a.timeRangeStart.localeCompare(b.timeRangeStart)
    })
  }

  /**
   * 比较重要程度（返回正数表示 a > b）
   */
  private compareImportance(a: EventImportance, b: EventImportance): number {
    const levels: Record<EventImportance, number> = {
      L1: 5,
      L2: 4,
      L3: 3,
      L4: 2,
      L5: 1,
    }
    return (levels[a] || 0) - (levels[b] || 0)
  }

  // buildEventPrompt 和 eventSystemPrompt 已移至 prompts.ts

  /**
   * 从事件中聚合人物名单，然后补全人物详细信息
   */
  private async extractPersons(
    fullText: string,
    events: ExtractedEvent[]
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
      names: namesList.slice(0, 10),
      moreNames: namesList.length > 10 ? `...+${namesList.length - 10} more` : undefined,
      textLengthForPrompt: Math.min(fullText.length, 15000),
    })

    // 调用 LLM 补全人物详细信息（章节绑定，不做融合）
    const prompt = buildPersonPrompt(fullText, namesList)
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
   * 从事件中提取和增强地点信息（章节绑定，不做融合）
   */
  private async extractAndEnhanceLocations(
    events: ExtractedEvent[],
    chapterText: string,
    chapterId?: string
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
    
    // 2. 对地点逐个查询 CHGIS API（章节绑定：每章都提取，不跳过已有）
    const chgisResults = new Map<string, ExtractedPlace>()
    for (const locationName of namesList) {
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
      total: namesList.length,
      succeeded: chgisResults.size,
      failed: namesList.length - chgisResults.size,
    })
    
    // 3. 批量调用 LLM 增强所有地点
    const llmPlaces = await this.enhanceLocationsBatchWithLLM(
      namesList,
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
          chgisId: chgisData.chgisId,
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
    }
    
    // 4. 返回提取的地点（通过 ReviewItem 审核后持久化）
    const allPlaces = mergedPlaces
    
    const duration = Date.now() - startTime
    logger.info('Location extraction completed', {
      inputNames: namesList.length,
      total: allPlaces.length,
      duration,
      sources: countByType(allPlaces, 'source'),
    })
    
    return allPlaces
  }

  /**
   * 从 timeRangeStart 解析年份，用于 CHGIS yr 参数
   * 支持：前207年、约前209年、公元前206年、-206、-206-12
   */
  private parseYearForCHGIS(timeStr: string | undefined): number | null {
    if (!timeStr || typeof timeStr !== 'string') return null
    let s = timeStr.trim()
    if (s.startsWith('约')) s = s.slice(1).trim()
    let isBCE = false
    if (s.startsWith('前')) {
      isBCE = true
      s = s.slice(1).trim()
    } else if (s.startsWith('公元前')) {
      isBCE = true
      s = s.slice(3).trim()
    } else if (s.startsWith('-')) {
      isBCE = true
      s = s.slice(1).trim()
    }
    if (s.endsWith('年')) s = s.slice(0, -1).trim()
    const match = s.match(/^(-?\d+)/) || s.match(/^(\d+)/)
    if (!match) return null
    const n = parseInt(match[1], 10)
    if (isNaN(n)) return null
    return isBCE ? -Math.abs(n) : n
  }

  /**
   * 解析 CHGIS result 的 years 字段，如 "-379 ~ 445"
   */
  private parseChgisYears(years: string | undefined): { begin: number; end: number } | null {
    if (!years || typeof years !== 'string') return null
    const m = years.match(/^(-?\d+)\s*~\s*(-?\d+)$/)
    if (!m) return null
    const begin = parseInt(m[1], 10)
    const end = parseInt(m[2], 10)
    return isNaN(begin) || isNaN(end) ? null : { begin, end }
  }

  /**
   * 当 CHGIS 返回多条结果时，选择最匹配的一条
   * - 优先：年份在范围内、县/郡级别、京兆/关中/内史等中原地区
   */
  private selectBestChgisResult(
    results: any[],
    targetYear: number | null,
    locationName: string
  ): any {
    if (results.length === 0) return null
    if (results.length === 1) return results[0]

    const preferFeatureTypes = ['县', '郡', '府', '州']
    const preferParentKeywords = ['京兆', '内史', '西安', '关中', '三辅', '咸阳', '长安']

    const score = (r: any): number => {
      let s = 0
      const ft = (r['feature type'] || '').toString()
      const parent = (r['parent name'] || '').toString()

      if (targetYear != null && r.years) {
        const range = this.parseChgisYears(r.years)
        if (range && targetYear >= range.begin && targetYear <= range.end) {
          s += 100
        }
      }
      const ftMatch = preferFeatureTypes.find(k => ft.includes(k))
      if (ftMatch) s += 50 - preferFeatureTypes.indexOf(ftMatch)
      const parentMatch = preferParentKeywords.find(k => parent.includes(k))
      if (parentMatch) s += 30
      return s
    }

    const sorted = [...results].sort((a, b) => score(b) - score(a))
    const best = sorted[0]
    if (results.length > 1 && targetYear != null) {
      logger.debug('CHGIS multi-result selection', {
        locationName,
        targetYear,
        total: results.length,
        selected: best.name,
        parent: best['parent name'],
        years: best.years,
      })
    }
    return best
  }

  /**
   * 查询 CHGIS API
   */
  private async queryCHGIS(
    locationName: string,
    events: ExtractedEvent[]
  ): Promise<ExtractedPlace | null> {
    const relatedEvent = events.find(e =>
      e.locationName?.includes(locationName) ||
      e.locationName?.split(/[,，]/).some(loc => cleanLocationName(loc.trim()) === locationName)
    )
    const yearStr = relatedEvent?.timeRangeStart
    const targetYear = this.parseYearForCHGIS(yearStr)

    const CHGIS_API_BASE = 'https://chgis.hudci.org/tgaz/placename'
    const params = new URLSearchParams({
      n: locationName,
      fmt: 'json',
    })
    if (targetYear != null) {
      params.append('yr', String(targetYear))
      logger.debug('CHGIS query with year', { locationName, targetYear })
    } else {
      logger.debug('CHGIS query without year (no event match or parse failed)', {
        locationName,
        yearStr: yearStr ?? undefined,
      })
    }

    const chgisUrl = `${CHGIS_API_BASE}?${params.toString()}`
    const response = await fetch(chgisUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`CHGIS API returned ${response.status}`)
    }

    const data = await response.json() as any
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

    const result = this.selectBestChgisResult(results, targetYear, locationName)
    
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

}

