/**
 * 混合模式 LLM 提取（事件为中心 + 人物/地点补全 + 对齐）
 */
import { LLMService } from './llm'

type EventActor = { name: string; role?: string; id?: string }
type EventRelationship = { sourceName: string; targetName: string; type?: string; description?: string; sourceId?: string; targetId?: string }

export interface MixedExtractResult {
  events: any[]
  persons: any[]
  places: any[]
  relationships: any[]
  meta: {
    chunks: number
    truncatedEvents: string[]
    truncatedEntities: string[]
  }
}

interface ParagraphInput {
  id?: string
  order?: number
  text: string
}

const MAX_WINDOW_CHARS = 12000 // 约合 4k-6k tokens
const LONG_WINDOW_CHARS = 20000 // 约合 8k-12k tokens

const normalize = (s: string) => (s || '').trim().toLowerCase()
const slugify = (s: string) =>
  normalize(s)
    .replace(/[\s·._]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export class LLMExtractor {
  private llm: LLMService

  constructor() {
    this.llm = new LLMService()
  }

  /**
   * 主流程：分段事件联合抽取 + 人物/地点补全 + 对齐
   * @param existingPersons 已有的人物列表（用于对齐），格式：{ id, name, aliases }
   * @param existingPlaces 已有的地点列表（用于对齐），格式：{ id, name }
   */
  async extractMixed(
    chapterText: string,
    paragraphs: ParagraphInput[] = [],
    existingPersons: Array<{ id: string; name: string; aliases?: string[] }> = [],
    existingPlaces: Array<{ id: string; name: string }> = []
  ): Promise<MixedExtractResult> {
    const chunks = this.chunkParagraphs(paragraphs, chapterText)

    // 第一步：分段事件抽取（单趟），传入已有实体以便模型尽量匹配
    const events = await this.runEventJoint(chunks, existingPersons, existingPlaces)

    // 第二步：单趟实体补全（人物+地点长尾补全），减少额外调用
    const completion = await this.runEntityCompletion(chapterText, events)

    const { canonicalPersons, canonicalPlaces } = this.buildCanonicalEntities(
      events,
      completion.persons,
      completion.places,
      existingPersons,
      existingPlaces
    )
    const alignedEvents = this.alignEvents(events, canonicalPersons, canonicalPlaces)

    // 关系仅从事件内抽取，减少额外调用；如需补充可在后处理再跑批量消歧
    const relationships = this.deriveRelationships(alignedEvents, canonicalPersons)

    return {
      events: alignedEvents,
      persons: Array.from(canonicalPersons.values()),
      places: Array.from(canonicalPlaces.values()),
      relationships,
      meta: {
        chunks: chunks.length,
        truncatedEvents: events.filter((e: any) => e.__truncated).map((e: any) => e.name).filter(Boolean),
        truncatedEntities: completion.truncatedEntities,
      },
    }
  }

  /**
   * 分段：按段落堆叠，尽量保持 4k-6k token 等效大小
   */
  private chunkParagraphs(paragraphs: ParagraphInput[], fallbackText: string) {
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

  private async runEventJoint(
    chunks: string[],
    existingPersons: Array<{ id: string; name: string; aliases?: string[] }> = [],
    existingPlaces: Array<{ id: string; name: string }> = []
  ) {
    const results: any[] = []
    for (const chunk of chunks) {
      const prompt = this.buildEventJointPrompt(chunk, existingPersons, existingPlaces)
      try {
        const { data = [], truncated = [] } = await this.llm.callJSON<{ data: any[]; truncated?: string[] }>(prompt, this.eventSystemPrompt())
        const tagged = data.map((e) => ({ ...e, __truncated: false }))
        const truncatedTagged = (truncated || []).map((name) => ({ name, __truncated: true }))
        results.push(...tagged, ...truncatedTagged)
      } catch (err) {
        console.error('[llmExtractor] event joint parse error', err)
      }
    }
    return results
  }

  private buildEventJointPrompt(
    text: string,
    existingPersons: Array<{ id: string; name: string; aliases?: string[] }> = [],
    existingPlaces: Array<{ id: string; name: string }> = []
  ) {
    const personList =
      existingPersons.length > 0
        ? `\n\n已知人物列表（优先匹配，匹配时使用 id 字段）：
${existingPersons
  .slice(0, 100)
  .map((p) => `- id: "${p.id}", name: "${p.name}"${p.aliases?.length ? `, aliases: [${p.aliases.map((a) => `"${a}"`).join(', ')}]` : ''}`)
  .join('\n')}`
        : ''

    const placeList =
      existingPlaces.length > 0
        ? `\n\n已知地点列表（优先匹配，匹配时使用 id 字段）：
${existingPlaces
  .slice(0, 50)
  .map((p) => `- id: "${p.id}", name: "${p.name}"`)
  .join('\n')}`
        : ''

    return `你是历史事件抽取助手。请按以下要求输出 JSON：
{
  "data": [
    {
      "name": "...",
      "type": "MILITARY|POLITICS|ECONOMY|CULTURE|OTHER",
      "timeRangeStart": "...",
      "timeRangeEnd": null,
      "location": { "name": "...", "id": "已有地点ID（如匹配到）" },
      "actors": [
        { "name": "...", "role": "PROTAGONIST|ALLY|OPPOSING|ADVISOR|OTHER", "id": "已有人物ID（如匹配到）" }
      ],
      "relationships": [
        { "sourceName": "...", "targetName": "...", "type": "ALLY|HOSTILE|KINSHIP|HIERARCHY|OTHER", "description": "≤200字要点", "sourceId": "已有ID（如匹配）", "targetId": "已有ID（如匹配）" }
      ],
      "summary": "≤400字要点式摘要",
      "impact": "≤300字",
      "relatedParagraphs": ["para_1", "para_2"]
    }
  ],
  "truncated": ["被截断的事件名称（如有）"]
}

示例输出：
{
  "data": [
    {
      "name": "鸿门宴",
      "type": "POLITICS",
      "timeRangeStart": "前206年",
      "timeRangeEnd": null,
      "location": { "name": "鸿门", "id": "place_hongmen" },
      "actors": [
        { "name": "刘邦", "role": "PROTAGONIST", "id": "person_liubang" },
        { "name": "项羽", "role": "OPPOSING", "id": "person_xiangyu" },
        { "name": "范增", "role": "ADVISOR", "id": "person_fanzeng" }
      ],
      "relationships": [
        {
          "sourceName": "项羽",
          "targetName": "刘邦",
          "type": "HOSTILE",
          "description": "项羽设宴试探刘邦，范增示意要杀，但项羽未采纳，刘邦得以脱身。",
          "sourceId": "person_xiangyu",
          "targetId": "person_liubang"
        }
      ],
      "summary": "项羽在鸿门设宴邀请刘邦，范增多次示意要杀刘邦，但项羽犹豫不决。张良和樊哙协助刘邦脱身，标志着楚汉之争的开始。",
      "impact": "刘邦成功脱险，为日后反败为胜奠定基础；楚汉矛盾公开化。",
      "relatedParagraphs": ["para_12", "para_13"]
    },
    {
      "name": "约法三章",
      "type": "POLITICS",
      "timeRangeStart": "前206年",
      "timeRangeEnd": null,
      "location": { "name": "咸阳", "id": "place_xianyang" },
      "actors": [
        { "name": "刘邦", "role": "PROTAGONIST", "id": "person_liubang" }
      ],
      "relationships": [],
      "summary": "刘邦攻入咸阳后，与关中父老约法三章：杀人者死，伤人及盗抵罪，废除秦朝严苛法律，深得民心。",
      "impact": "赢得关中民心，为建立汉朝奠定基础。",
      "relatedParagraphs": ["para_8"]
    }
  ],
  "truncated": []
}

约束：
- 每批最多 30 个事件，按重要性排序；超出写入 truncated 数组。
- summary 和 impact 保持要点式，控制在字数限制内。
- 如果 actors/location 匹配到已知实体列表中的实体，请填写对应的 id 字段；未匹配则 id 留空。
- relationships 中的 sourceId/targetId 同样优先匹配已知实体。
- 保持简短要点式；不杜撰，不确定则留空。
- 只输出 JSON，不要其他说明文字。${personList}${placeList}

文本：
${text}
`
  }

  private eventSystemPrompt() {
    return '你是事件为中心的抽取助手，输出 JSON，字段遵守约束，不要解释。'
  }

  /**
   * 单趟实体补全（人物+地点），减少额外调用
   */
  private async runEntityCompletion(text: string, events: any[]) {
    const knownNames = Array.from(
      new Set(
        events
          .flatMap((e: any) => (e.actors || []).map((a: any) => a.name).concat(e.location?.name || []))
          .filter(Boolean)
      )
    ).slice(0, 80)

    const prompt = this.buildEntityCompletionPrompt(text, knownNames)
    try {
      const { persons = [], places = [], truncatedPersons = [], truncatedPlaces = [] } = await this.llm.callJSON<{
        persons?: any[]
        places?: any[]
        truncatedPersons?: string[]
        truncatedPlaces?: string[]
      }>(prompt, this.entitySystemPrompt())

      return {
        persons: persons.map((p: any) => ({ ...p, __truncated: truncatedPersons?.includes(p.name) })),
        places: places.map((p: any) => ({ ...p, __truncated: truncatedPlaces?.includes(p.name) })),
        truncatedEntities: [...(truncatedPersons || []), ...(truncatedPlaces || [])],
      }
    } catch (err) {
      console.error('[llmExtractor] entity completion error', err)
      return { persons: [], places: [], truncatedEntities: [] }
    }
  }

  private buildEntityCompletionPrompt(text: string, knownNames: string[]) {
    const knownList = knownNames.length > 0 ? `\n\n已知名称列表（优先补充这些实体的详细信息）：${knownNames.slice(0, 50).join(', ')}` : ''

    return `你是实体补全助手。输出 JSON:
{
  "persons": [
    { "name": "...", "aliases": ["..."], "role": "EMPEROR|GENERAL|MINISTER|SCHOLAR|OTHER", "biography": "≤400字要点" }
  ],
  "places": [
    { "name": "...", "modernName": "...", "type": "CITY|BATTLEFIELD|REGION|RIVER|MOUNTAIN|OTHER", "description": "≤300字" }
  ],
  "truncatedPersons": ["被截断的人物（如有）"],
  "truncatedPlaces": ["被截断的地点（如有）"]
}

示例输出：
{
  "persons": [
    {
      "name": "张良",
      "aliases": ["子房", "留侯"],
      "role": "MINISTER",
      "biography": "汉初重要谋士，辅佐刘邦建立汉朝。出身韩国贵族，精通兵法，曾为刘邦出谋划策，在楚汉之争中发挥重要作用。"
    },
    {
      "name": "韩信",
      "aliases": ["淮阴侯"],
      "role": "GENERAL",
      "biography": "汉初名将，擅长用兵，为刘邦统一天下立下大功。后因谋反被诛。"
    }
  ],
  "places": [
    {
      "name": "鸿门",
      "modernName": "陕西省西安市临潼区",
      "type": "BATTLEFIELD",
      "description": "楚汉相争时期的重要地点，项羽在此设宴试探刘邦，史称鸿门宴。"
    },
    {
      "name": "咸阳",
      "modernName": "陕西省咸阳市",
      "type": "CITY",
      "description": "秦朝都城，刘邦攻入后约法三章，后成为汉朝重要城市。"
    }
  ],
  "truncatedPersons": [],
  "truncatedPlaces": []
}

约束：
- 人物总数≤40，地点总数≤40，按重要性排序；超出放入 truncatedPersons/Places。
- 如能匹配已知名称，请优先补充已有名字的详细信息；${knownList}
- biography 和 description 保持要点式，控制在字数限制内。
- 不确定的字段留空，不要杜撰。
- 只输出 JSON，不要其他说明文字。

文本：
${text}
`
  }

  private entitySystemPrompt() {
    return '你是历史文本的实体补全助手（人物+地点），只输出 JSON 数据结构，不要额外解释。'
  }

  /**
   * 构建 canonical 实体表，合并事件中的 actors/location 与补全结果
   * 优先使用已有实体的 ID，避免重复创建
   */
  private buildCanonicalEntities(
    events: any[],
    persons: any[],
    places: any[],
    existingPersons: Array<{ id: string; name: string; aliases?: string[] }> = [],
    existingPlaces: Array<{ id: string; name: string }> = []
  ) {
    const personMap = new Map<string, any>()
    const placeMap = new Map<string, any>()

    // 先加载已有实体（优先使用已有 ID）
    existingPersons.forEach((p) => {
      const key = normalize(p.name)
      personMap.set(key, { id: p.id, name: p.name, aliases: p.aliases || [], __existing: true })
      // 别名也建立映射
      p.aliases?.forEach((alias) => {
        const aliasKey = normalize(alias)
        if (!personMap.has(aliasKey)) {
          personMap.set(aliasKey, { id: p.id, name: p.name, aliases: p.aliases || [], __existing: true })
        }
      })
    })

    existingPlaces.forEach((p) => {
      const key = normalize(p.name)
      placeMap.set(key, { id: p.id, name: p.name, __existing: true })
    })

    const upsertPerson = (name: string, payload: any = {}) => {
      if (!name) return
      const key = normalize(name)
      if (!personMap.has(key)) {
        const id = payload.id || `person_${slugify(name) || key}`
        personMap.set(key, { id, name, aliases: [], ...payload })
      } else {
        const existing = personMap.get(key)
        // 如果已有实体，保留原有 ID
        const finalId = existing.__existing ? existing.id : payload.id || existing.id
        personMap.set(key, {
          ...existing,
          ...payload,
          id: finalId,
          aliases: Array.from(new Set([...(existing.aliases || []), ...(payload.aliases || [])])),
        })
      }
    }

    const upsertPlace = (name: string, payload: any = {}) => {
      if (!name) return
      const key = normalize(name)
      if (!placeMap.has(key)) {
        const id = payload.id || `place_${slugify(name) || key}`
        placeMap.set(key, { id, name, ...payload })
      } else {
        const existing = placeMap.get(key)
        // 如果已有实体，保留原有 ID
        const finalId = existing.__existing ? existing.id : payload.id || existing.id
        placeMap.set(key, { ...existing, ...payload, id: finalId })
      }
    }

    // from completion
    persons.forEach((p) => upsertPerson(p.name, p))
    places.forEach((p) => upsertPlace(p.name, p))

    // from event actors/locations（如果事件中已有 id，优先使用）
    events.forEach((ev: any) => {
      ev.actors?.forEach((actor: EventActor) => {
        upsertPerson(actor.name, actor.id ? { id: actor.id } : {})
      })
      if (ev.location?.name) {
        upsertPlace(ev.location.name, ev.location.id ? { id: ev.location.id } : {})
      }
    })

    return { canonicalPersons: personMap, canonicalPlaces: placeMap }
  }

  /**
   * 将事件的 actors/location 映射到 canonical IDs
   */
  private alignEvents(events: any[], personMap: Map<string, any>, placeMap: Map<string, any>) {
    return events
      .filter((e) => e && e.name)
      .map((ev: any) => {
        const alignedActors = (ev.actors || []).map((actor: EventActor) => {
          const key = normalize(actor.name)
          const person = personMap.get(key)
          return { ...actor, id: person?.id }
        })
        const locationName = ev.location?.name
        const locationId = locationName ? placeMap.get(normalize(locationName))?.id : undefined
        return {
          ...ev,
          actors: alignedActors,
          locationId,
          location: ev.location,
        }
      })
  }

  /**
   * 从事件 relationships 字段派生关系记录
   */
  private deriveRelationships(events: any[], personMap: Map<string, any>) {
    const rels: any[] = []
    events.forEach((ev: any) => {
      (ev.relationships || []).forEach((rel: EventRelationship) => {
        const source = personMap.get(normalize(rel.sourceName))
        const target = personMap.get(normalize(rel.targetName))
        rels.push({
          sourceId: source?.id,
          targetId: target?.id,
          sourceName: rel.sourceName,
          targetName: rel.targetName,
          type: rel.type || 'OTHER',
          description: rel.description,
          relatedEvent: ev.name,
        })
      })
    })
    return rels
  }

  /**
   * 合并关系：按 sourceId/sourceName + targetId/targetName + type 去重
   */
  private mergeRelationships(rels: any[], personMap: Map<string, any>) {
    const keyOf = (r: any) => {
      const sid = r.sourceId || personMap.get(normalize(r.sourceName))?.id || slugify(r.sourceName || '')
      const tid = r.targetId || personMap.get(normalize(r.targetName))?.id || slugify(r.targetName || '')
      return `${sid}__${tid}__${r.type || 'OTHER'}`
    }
    const merged = new Map<string, any>()
    for (const r of rels) {
      const k = keyOf(r)
      if (!merged.has(k)) {
        merged.set(k, {
          ...r,
          sourceId: r.sourceId || personMap.get(normalize(r.sourceName))?.id,
          targetId: r.targetId || personMap.get(normalize(r.targetName))?.id,
        })
      } else {
        const prev = merged.get(k)
        merged.set(k, {
          ...prev,
          description: prev.description || r.description,
          relatedEvent: prev.relatedEvent || r.relatedEvent,
          relatedEvents: Array.from(
            new Set(
              ([] as string[])
                .concat(prev.relatedEvents || [])
                .concat(prev.relatedEvent ? [prev.relatedEvent] : [])
                .concat(r.relatedEvents || [])
                .concat(r.relatedEvent ? [r.relatedEvent] : [])
            )
          ),
        })
      }
    }
    return Array.from(merged.values())
  }
}

