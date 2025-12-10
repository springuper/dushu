/**
 * 事件中心 LLM 提取器（MVP 版本）
 * 
 * 核心思想：以事件为原子单元，人物信息内嵌在事件中
 * - 事件 (Event)：包含参与者 (actors)、地点、时间、摘要
 * - 人物 (Person)：从事件中聚合的人物信息
 */
import { LLMService } from './llm'
import { createLogger } from './logger'

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
}

export interface ExtractionResult {
  events: ExtractedEvent[]
  persons: ExtractedPerson[]
  meta: {
    chunks: number
    truncatedEvents: string[]
  }
}

interface ParagraphInput {
  id?: string
  order?: number
  text: string
}

// ============================================
// 常量
// ============================================

const MAX_WINDOW_CHARS = 12000 // 约合 4k-6k tokens
const LONG_WINDOW_CHARS = 20000 // 约合 8k-12k tokens

const normalize = (s: string) => (s || '').trim().toLowerCase()

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
    const { chunks, chunkParagraphIds } = this.chunkParagraphsWithIds(paragraphs, chapterText)
    const chunkSizes = chunks.map(c => c.length)
    logger.info('Step 1/3: Text chunked', {
      chunks: chunks.length,
      avgChunkSize: Math.round(chapterText.length / chunks.length),
      chunkSizes,
      minChunk: Math.min(...chunkSizes),
      maxChunk: Math.max(...chunkSizes),
      paragraphsPerChunk: chunkParagraphIds.map(ids => ids.length),
    })

    // Step 2: 提取事件（带段落关联）
    logger.info('Step 2/3: Extracting events...')
    const eventStartTime = Date.now()
    const { events, truncatedEvents } = await this.extractEvents(chunks, chunkParagraphIds, paragraphs)
    const eventDuration = Date.now() - eventStartTime
    
    logger.info('Step 2/3: Events extraction done', {
      eventCount: events.length,
      truncated: truncatedEvents.length,
      duration: eventDuration,
      eventTypes: this.countByType(events, 'type'),
    })

    // Step 3: 提取人物
    logger.info('Step 3/3: Extracting persons...')
    const personStartTime = Date.now()
    const persons = await this.extractPersons(chapterText, events)
    const personDuration = Date.now() - personStartTime
    
    logger.info('Step 3/3: Persons extraction done', {
      personCount: persons.length,
      duration: personDuration,
      roles: this.countByType(persons, 'role'),
      factions: this.countByType(persons, 'faction'),
    })

    const totalDuration = Date.now() - startTime
    timer.end({
      chapterId,
      eventCount: events.length,
      personCount: persons.length,
      chunks: chunks.length,
    })

    logger.info('========== EXTRACTION COMPLETED ==========', {
      chapterId,
      events: events.length,
      persons: persons.length,
      chunks: chunks.length,
      truncated: truncatedEvents.length,
      totalDuration,
      breakdown: {
        events: eventDuration,
        persons: personDuration,
      },
    })

    return {
      events,
      persons,
      meta: {
        chunks: chunks.length,
        truncatedEvents,
      },
    }
  }

  /**
   * 统计数组中某个字段的分布
   */
  private countByType<T extends Record<string, any>>(items: T[], field: keyof T): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const item of items) {
      const value = String(item[field] || 'UNKNOWN')
      counts[value] = (counts[value] || 0) + 1
    }
    return counts
  }

  /**
   * 分段结果，包含段落ID映射
   */
  private chunkParagraphsWithIds(paragraphs: ParagraphInput[], fallbackText: string): { 
    chunks: string[]
    chunkParagraphIds: string[][] // 每个 chunk 包含的段落 ID 列表
  } {
    if (!paragraphs.length) {
      return { chunks: [fallbackText], chunkParagraphIds: [[]] }
    }
    
    const chunks: string[] = []
    const chunkParagraphIds: string[][] = []
    let buffer = ''
    let currentIds: string[] = []
    
    for (const para of paragraphs) {
      const text = para.text || ''
      const paraId = para.id || `para-${para.order || 0}`
      const candidate = buffer ? `${buffer}\n\n${text}` : text
      const limit = buffer.length > 0 ? LONG_WINDOW_CHARS : MAX_WINDOW_CHARS
      
      if (candidate.length > limit && buffer) {
        chunks.push(buffer)
        chunkParagraphIds.push(currentIds)
        buffer = text
        currentIds = [paraId]
      } else {
        buffer = candidate
        currentIds.push(paraId)
      }
    }
    
    if (buffer) {
      chunks.push(buffer)
      chunkParagraphIds.push(currentIds)
    }
    
    return { chunks, chunkParagraphIds }
  }

  /**
   * 分段：按段落堆叠，尽量保持 4k-6k token 等效大小
   * @deprecated 使用 chunkParagraphsWithIds 代替
   */
  private chunkParagraphs(paragraphs: ParagraphInput[], fallbackText: string): string[] {
    return this.chunkParagraphsWithIds(paragraphs, fallbackText).chunks
  }

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
      
      const prompt = this.buildEventPrompt(chunk, chunkParagraphs)
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
        }>(prompt, this.eventSystemPrompt())

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

  /**
   * 构建事件提取提示词
   */
  private buildEventPrompt(text: string, paragraphs?: { id: string; text: string }[]): string {
    // 如果有段落信息，构建段落参考
    const paragraphSection = paragraphs && paragraphs.length > 0 
      ? `

## 段落ID参考

以下是文本对应的段落ID，请在提取事件时，将事件关联到相关的段落ID：

${paragraphs.map(p => `[${p.id}] ${p.text.substring(0, 80)}${p.text.length > 80 ? '...' : ''}`).join('\n')}
`
      : ''

    const relatedParagraphsField = paragraphs && paragraphs.length > 0
      ? `"relatedParagraphs": ["段落ID1", "段落ID2"],  // 该事件出现在哪些段落中`
      : ''

    const relatedParagraphsExample = paragraphs && paragraphs.length > 0
      ? `"relatedParagraphs": ["para-15", "para-16"],`
      : ''

    const relatedParagraphsRequirement = paragraphs && paragraphs.length > 0
      ? `
8. **段落关联**：将每个事件关联到它出现的段落ID（relatedParagraphs字段），这对于阅读时的定位非常重要`
      : ''

    return `你是历史事件提取专家。请从以下文本中提取重要历史事件。
${paragraphSection}
## 输出格式（JSON）

{
  "events": [
    {
      "name": "事件名称",
      "type": "BATTLE|POLITICAL|PERSONAL|OTHER",
      "timeRangeStart": "开始时间（如：前206年、前206年冬）",
      "timeRangeEnd": "结束时间（可选，如持续多年的战争）",
      "timePrecision": "EXACT_DATE|MONTH|SEASON|YEAR|DECADE|APPROXIMATE",
      "locationName": "历史地名",
      "locationModernName": "现代地名（如知道）",
      "summary": "事件摘要（200-400字，要点式）",
      "impact": "历史影响（100-200字，可选）",
      ${relatedParagraphsField}
      "actors": [
        {
          "name": "人物姓名",
          "roleType": "PROTAGONIST|ALLY|OPPOSING|ADVISOR|EXECUTOR|OBSERVER|OTHER",
          "description": "此人在事件中的具体表现（50-100字）"
        }
      ]
    }
  ],
  "truncated": ["因篇幅限制未能详述的事件名称"]
}

## 示例输出

{
  "events": [
    {
      "name": "鸿门宴",
      "type": "POLITICAL",
      "timeRangeStart": "前206年",
      "timeRangeEnd": null,
      "timePrecision": "YEAR",
      "locationName": "鸿门",
      "locationModernName": "陕西省西安市临潼区",
      "summary": "项羽在鸿门设宴邀请刘邦。范增多次示意项羽杀掉刘邦，但项羽犹豫不决。张良事先得知消息，樊哙闯入护卫。刘邦借如厕之机逃脱，标志着楚汉之争正式开始。",
      "impact": "刘邦成功脱险，保存实力，为日后反败为胜奠定基础。楚汉矛盾公开化，天下进入新的争霸格局。",
      ${relatedParagraphsExample}
      "actors": [
        {
          "name": "刘邦",
          "roleType": "PROTAGONIST",
          "description": "宴会主要当事人，表面恭顺，暗中寻机脱身，展现其灵活圆滑的处事风格"
        },
        {
          "name": "项羽",
          "roleType": "PROTAGONIST",
          "description": "宴会主办者，虽有除掉刘邦之机，但因优柔寡断未能下手"
        },
        {
          "name": "范增",
          "roleType": "ADVISOR",
          "description": "项羽谋士，多次暗示项羽杀刘邦，举玉玦示意，但计谋未被采纳"
        },
        {
          "name": "张良",
          "roleType": "ADVISOR",
          "description": "刘邦谋士，提前获取情报，安排樊哙护驾，帮助刘邦脱身"
        },
        {
          "name": "樊哙",
          "roleType": "EXECUTOR",
          "description": "刘邦部将，持剑闯入宴会护卫刘邦，以豪迈之态震慑项羽"
        }
      ]
    }
  ],
  "truncated": []
}

## 提取要求

1. **事件选择**：提取文本中的重要历史事件，每批最多 20 个事件，按重要性排序
2. **时间精度**：根据文本描述选择合适的时间精度
3. **参与者命名**：
   - actors.name 应使用人物的**本名**（如"刘邦"而非"高祖"或"沛公"）
   - 如果文本中只出现封号/谥号，请推断其本名
   - 这有助于后续的人物去重和关联
4. **参与者角色**：详细描述每个重要人物在事件中的角色和表现
5. **角色类型说明**：
   - PROTAGONIST: 事件主角
   - ALLY: 同盟/支持方
   - OPPOSING: 对立/敌对方
   - ADVISOR: 谋士/顾问
   - EXECUTOR: 执行者/部将
   - OBSERVER: 旁观者/见证者
   - OTHER: 其他
6. **摘要质量**：确保摘要完整叙述事件经过，不遗漏关键细节
7. **只输出 JSON**，不要其他说明文字${relatedParagraphsRequirement}

## 待处理文本

${text}
`
  }

  private eventSystemPrompt(): string {
    return '你是专业的历史文献分析专家，擅长从古文中提取结构化的历史事件信息。请严格按照 JSON 格式输出，不要添加任何解释性文字。'
  }

  /**
   * 从事件中聚合人物名单，然后补全人物详细信息
   */
  private async extractPersons(fullText: string, events: ExtractedEvent[]): Promise<ExtractedPerson[]> {
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

    // 调用 LLM 补全人物详细信息
    const prompt = this.buildPersonPrompt(fullText, namesList)
    try {
      const result = await this.llm.callJSON<{
        persons: ExtractedPerson[]
      }>(prompt, this.personSystemPrompt())

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

  /**
   * 构建人物信息补全提示词
   */
  private buildPersonPrompt(text: string, personNames: string[]): string {
    return `你是历史人物研究专家。请根据以下文本，为这些人物补全详细信息。

## 重要：人物去重与别名识别

**注意**：以下名称列表中可能有多个名称指向同一个人（如"高祖"、"沛公"、"刘邦"都是刘邦）。

**命名规则（必须遵守）**：
- name 字段必须使用人物的**本名**（出生时的姓名），而非封号、谥号或庙号
- 其他所有称呼（字、号、封号、谥号、庙号等）都放入 aliases 数组
- **不要为同一个人创建多条记录**

**示例**：
如果输入名称包含 ["高祖", "沛公", "汉王", "刘邦"]，应该只输出一条记录：
{
  "name": "刘邦",           // ✓ 本名
  "aliases": ["高祖", "沛公", "汉王", "刘季", "高皇帝"],  // 所有其他称呼
  ...
}

**错误示例**（不要这样做）：
- 为"高祖"单独创建一条记录 ✗
- 为"沛公"单独创建一条记录 ✗
- name 使用"高祖"而非"刘邦" ✗

## 需要补全信息的人物列表

${personNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

## 输出格式（JSON）

{
  "persons": [
    {
      "name": "人物本名（不是封号/谥号）",
      "aliases": ["字", "号", "封号", "谥号", "其他称呼"],
      "role": "MONARCH|ADVISOR|GENERAL|CIVIL_OFFICIAL|MILITARY_OFFICIAL|RELATIVE|EUNUCH|OTHER",
      "faction": "HAN|CHU|NEUTRAL|OTHER",
      "biography": "人物简介（200-400字，基于文本内容）",
      "birthYear": "出生年份（如知道）",
      "deathYear": "去世年份（如知道）"
    }
  ]
}

## 示例输出

{
  "persons": [
    {
      "name": "刘邦",
      "aliases": ["高祖", "沛公", "汉王", "刘季", "高皇帝"],
      "role": "MONARCH",
      "faction": "HAN",
      "biography": "汉朝开国皇帝，出身沛县平民，早年任亭长。秦末起义，先入关中，约法三章得民心。楚汉之争中，善用人才，以张良、萧何、韩信为核心，最终击败项羽，统一天下，建立汉朝。",
      "birthYear": "前256年",
      "deathYear": "前195年"
    },
    {
      "name": "项籍",
      "aliases": ["项羽", "西楚霸王"],
      "role": "MONARCH",
      "faction": "CHU",
      "biography": "秦末起义领袖，楚国贵族后裔。力能扛鼎，勇冠三军。巨鹿之战破釜沉舟大败秦军，威震天下。分封诸侯自立为西楚霸王。楚汉之争中因刚愎自用，不善用人，最终败于垓下，乌江自刎。",
      "birthYear": "前232年",
      "deathYear": "前202年"
    }
  ]
}

## 补全要求

1. **人物去重**：识别指向同一人的不同名称，合并为一条记录
2. **本名优先**：name 字段使用本名，其他称呼放入 aliases
3. **角色分类**：
   - MONARCH: 君主/帝王
   - ADVISOR: 谋士/策士
   - GENERAL: 将领/武将
   - CIVIL_OFFICIAL: 文臣
   - MILITARY_OFFICIAL: 武官
   - RELATIVE: 外戚/皇亲
   - EUNUCH: 宦官
   - OTHER: 其他
4. **阵营分类**（根据文本时代背景）：
   - HAN: 汉方/刘邦阵营
   - CHU: 楚方/项羽阵营
   - NEUTRAL: 中立
   - OTHER: 其他
5. **信息来源**：biography 应基于文本内容，不要杜撰
6. **年份格式**：使用"前XXX年"格式
7. **只输出 JSON**，不要其他说明文字

## 参考文本

${text.slice(0, 15000)}
`
  }

  private personSystemPrompt(): string {
    return '你是专业的历史人物研究专家，擅长从古文中提取人物信息。请严格按照 JSON 格式输出，不要添加任何解释性文字。'
  }
}

