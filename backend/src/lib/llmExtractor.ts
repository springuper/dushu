/**
 * 事件中心 LLM 提取器（MVP 版本）
 * 
 * 核心思想：以事件为原子单元，人物信息内嵌在事件中
 * - 事件 (Event)：包含参与者 (actors)、地点、时间、摘要
 * - 人物 (Person)：从事件中聚合的人物信息
 */
import { LLMService } from './llm'

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
    const chunks = this.chunkParagraphs(paragraphs, chapterText)

    // 分段提取事件（包含内嵌的 actors）
    const { events, truncatedEvents } = await this.extractEvents(chunks)

    // 从事件中聚合人物信息，然后补全人物详细信息
    const persons = await this.extractPersons(chapterText, events)

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
   * 分段：按段落堆叠，尽量保持 4k-6k token 等效大小
   */
  private chunkParagraphs(paragraphs: ParagraphInput[], fallbackText: string): string[] {
    if (!paragraphs.length) {
      return [fallbackText]
    }
    const chunks: string[] = []
    let buffer = ''
    for (const para of paragraphs) {
      const text = para.text || ''
      const candidate = buffer ? `${buffer}\n\n${text}` : text
      const limit = buffer.length > 0 ? LONG_WINDOW_CHARS : MAX_WINDOW_CHARS
      if (candidate.length > limit && buffer) {
        chunks.push(buffer)
        buffer = text
      } else {
        buffer = candidate
      }
    }
    if (buffer) chunks.push(buffer)
    return chunks
  }

  /**
   * 提取事件（包含内嵌的 actors 和地点信息）
   */
  private async extractEvents(chunks: string[]): Promise<{ events: ExtractedEvent[]; truncatedEvents: string[] }> {
    const allEvents: ExtractedEvent[] = []
    const allTruncated: string[] = []

    for (const chunk of chunks) {
      const prompt = this.buildEventPrompt(chunk)
      try {
        const result = await this.llm.callJSON<{
          events: ExtractedEvent[]
          truncated?: string[]
        }>(prompt, this.eventSystemPrompt())

        if (result.events) {
          allEvents.push(...result.events)
        }
        if (result.truncated) {
          allTruncated.push(...result.truncated)
        }
      } catch (err) {
        console.error('[LLMExtractor] 事件提取错误:', err)
      }
    }

    return { events: allEvents, truncatedEvents: allTruncated }
  }

  /**
   * 构建事件提取提示词
   */
  private buildEventPrompt(text: string): string {
    return `你是历史事件提取专家。请从以下文本中提取重要历史事件。

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
3. **参与者**：详细描述每个重要人物在事件中的角色和表现
4. **角色类型说明**：
   - PROTAGONIST: 事件主角
   - ALLY: 同盟/支持方
   - OPPOSING: 对立/敌对方
   - ADVISOR: 谋士/顾问
   - EXECUTOR: 执行者/部将
   - OBSERVER: 旁观者/见证者
   - OTHER: 其他
5. **摘要质量**：确保摘要完整叙述事件经过，不遗漏关键细节
6. **只输出 JSON**，不要其他说明文字

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

    // 调用 LLM 补全人物详细信息
    const prompt = this.buildPersonPrompt(fullText, Array.from(personNames))
    try {
      const result = await this.llm.callJSON<{
        persons: ExtractedPerson[]
      }>(prompt, this.personSystemPrompt())

      return result.persons || []
    } catch (err) {
      console.error('[LLMExtractor] 人物信息提取错误:', err)
      // 如果失败，返回基础信息
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

## 需要补全信息的人物列表

${personNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

## 输出格式（JSON）

{
  "persons": [
    {
      "name": "人物姓名",
      "aliases": ["别名/字号/封号"],
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
      "aliases": ["高祖", "沛公", "汉王"],
      "role": "MONARCH",
      "faction": "HAN",
      "biography": "汉朝开国皇帝，出身沛县平民，早年任亭长。秦末起义，先入关中，约法三章得民心。楚汉之争中，善用人才，以张良、萧何、韩信为核心，最终击败项羽，统一天下，建立汉朝。",
      "birthYear": "前256年",
      "deathYear": "前195年"
    },
    {
      "name": "项羽",
      "aliases": ["西楚霸王", "项籍"],
      "role": "MONARCH",
      "faction": "CHU",
      "biography": "秦末起义领袖，楚国贵族后裔。力能扛鼎，勇冠三军。巨鹿之战破釜沉舟大败秦军，威震天下。分封诸侯自立为西楚霸王。楚汉之争中因刚愎自用，不善用人，最终败于垓下，乌江自刎。",
      "birthYear": "前232年",
      "deathYear": "前202年"
    }
  ]
}

## 补全要求

1. **角色分类**：
   - MONARCH: 君主/帝王
   - ADVISOR: 谋士/策士
   - GENERAL: 将领/武将
   - CIVIL_OFFICIAL: 文臣
   - MILITARY_OFFICIAL: 武官
   - RELATIVE: 外戚/皇亲
   - EUNUCH: 宦官
   - OTHER: 其他

2. **阵营分类**（根据文本时代背景）：
   - HAN: 汉方/刘邦阵营
   - CHU: 楚方/项羽阵营
   - NEUTRAL: 中立
   - OTHER: 其他

3. **信息来源**：biography 应基于文本内容，不要杜撰
4. **年份格式**：使用"前XXX年"格式
5. **只输出 JSON**，不要其他说明文字

## 参考文本

${text.slice(0, 15000)}
`
  }

  private personSystemPrompt(): string {
    return '你是专业的历史人物研究专家，擅长从古文中提取人物信息。请严格按照 JSON 格式输出，不要添加任何解释性文字。'
  }
}
