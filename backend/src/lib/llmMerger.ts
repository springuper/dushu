/**
 * LLM 驱动的数据融合服务
 * 使用 LLM 智能判断和合并数据
 */

import { LLMService } from './llm'
import { Person, Place, Event } from '@prisma/client'

export interface MergeResult<T> {
  shouldMerge: boolean // 是否应该合并
  confidence: number // 置信度 0-1
  reason: string // 合并原因
  mergedData: T // 合并后的数据
  changes: Record<string, any> // 变更详情
}

export class LLMMerger {
  private llm: LLMService

  constructor(llmConfig?: { provider?: 'openai' | 'gemini' | 'auto' }) {
    this.llm = new LLMService(llmConfig)
  }

  /**
   * 融合人物数据
   */
  async mergePerson(
    existing: Person,
    newData: any
  ): Promise<MergeResult<Partial<Person>>> {
    const prompt = `你是一个专业的历史数据融合专家。请分析以下两个人物记录，判断它们是否是同一个人，如果是，请合并数据。

已有记录：
${JSON.stringify({
  name: existing.name,
  aliases: existing.aliases,
  role: existing.role,
  faction: existing.faction,
  birthYear: existing.birthYear,
  deathYear: existing.deathYear,
  activePeriodStart: existing.activePeriodStart,
  activePeriodEnd: existing.activePeriodEnd,
  biography: existing.biography,
  keyEvents: existing.keyEvents,
}, null, 2)}

新记录：
${JSON.stringify({
  name: newData.name,
  aliases: newData.aliases || [],
  role: newData.role,
  faction: newData.faction,
  birthYear: newData.birthYear,
  deathYear: newData.deathYear,
  activePeriodStart: newData.activePeriod?.start,
  activePeriodEnd: newData.activePeriod?.end,
  biography: newData.biography,
  keyEvents: newData.keyEvents || [],
}, null, 2)}

请返回 JSON 格式：
{
  "shouldMerge": true/false,  // 是否应该合并（是否是同一个人）
  "confidence": 0.0-1.0,      // 置信度
  "reason": "合并原因说明",    // 为什么合并或不合并
  "mergedData": {             // 合并后的数据（如果 shouldMerge=true）
    "name": "主姓名",
    "aliases": ["别名1", "别名2", ...],  // 合并所有别名，去重
    "role": "更具体的角色",
    "faction": "所属势力",
    "birthYear": "更准确的生年",
    "deathYear": "更准确的卒年",
    "activePeriodStart": "最早开始时间",
    "activePeriodEnd": "最晚结束时间",
    "biography": "合并后的传记（保留更详细的信息，去除重复）",
    "keyEvents": ["事件1", "事件2", ...]  // 合并所有事件，去重
  },
  "changes": {                // 变更详情
    "aliases": {"added": [...], "removed": [...]},
    "biography": "变更说明",
    "keyEvents": {"added": [...], "removed": [...]},
    ...
  }
}

要求：
1. 如果姓名完全相同，或新记录的姓名/别名在已有记录的别名中，很可能是同一人
2. 如果时间范围高度重叠，也可能是同一人
3. 合并时保留最完整、最准确的信息
4. 别名合并去重
5. 传记合并时去除重复内容，保留更详细的描述
6. 关键事件合并去重
7. 如果确认不是同一人，shouldMerge=false，mergedData 可以为空对象`

    const systemPrompt = '你是一个专业的历史数据融合专家，擅长判断历史人物是否是同一个人，并智能合并数据。'

    try {
      const result = await this.llm.callJSON<MergeResult<Partial<Person>>>(
        prompt,
        systemPrompt,
        0.3
      )

      return result
    } catch (error) {
      console.error('LLM 融合错误:', error)
      // 如果 LLM 调用失败，返回保守的结果
      return {
        shouldMerge: false,
        confidence: 0,
        reason: 'LLM 调用失败，无法判断',
        mergedData: {},
        changes: {},
      }
    }
  }

  /**
   * 融合地点数据
   */
  async mergePlace(
    existing: Place,
    newData: any
  ): Promise<MergeResult<Partial<Place>>> {
    const prompt = `你是一个专业的历史地理数据融合专家。请分析以下两个地点记录，判断它们是否是同一个地点，如果是，请合并数据。

已有记录：
${JSON.stringify({
  name: existing.name,
  modernName: existing.modernName,
  coordinatesLng: existing.coordinatesLng,
  coordinatesLat: existing.coordinatesLat,
  type: existing.type,
  faction: existing.faction,
  description: existing.description,
  relatedEvents: existing.relatedEvents,
}, null, 2)}

新记录：
${JSON.stringify({
  name: newData.name,
  modernName: newData.modernName,
  coordinates: newData.coordinates,
  type: newData.type,
  faction: newData.faction,
  description: newData.description,
  relatedEvents: newData.relatedEvents || [],
}, null, 2)}

请返回 JSON 格式（格式同人物融合）：
{
  "shouldMerge": true/false,
  "confidence": 0.0-1.0,
  "reason": "合并原因",
  "mergedData": {
    "name": "历史名称",
    "modernName": "现代名称",
    "coordinatesLng": 经度,
    "coordinatesLat": 纬度,
    "type": "地点类型",
    "faction": "所属势力",
    "description": "合并后的描述",
    "relatedEvents": ["事件ID1", ...]
  },
  "changes": {...}
}

要求：
1. 如果名称相同或相近，且坐标接近，很可能是同一地点
2. 合并时保留更准确的坐标
3. 描述合并时去除重复内容`

    const systemPrompt = '你是一个专业的历史地理数据融合专家，擅长判断历史地点是否是同一个，并智能合并数据。'

    try {
      const result = await this.llm.callJSON<MergeResult<Partial<Place>>>(
        prompt,
        systemPrompt,
        0.3
      )

      // 转换坐标格式
      if (result.mergedData.coordinates) {
        result.mergedData.coordinatesLng = result.mergedData.coordinates.lng
        result.mergedData.coordinatesLat = result.mergedData.coordinates.lat
        delete result.mergedData.coordinates
      }

      return result
    } catch (error) {
      console.error('LLM 融合错误:', error)
      return {
        shouldMerge: false,
        confidence: 0,
        reason: 'LLM 调用失败，无法判断',
        mergedData: {},
        changes: {},
      }
    }
  }

  /**
   * 融合事件数据
   */
  async mergeEvent(
    existing: Event,
    newData: any
  ): Promise<MergeResult<Partial<Event>>> {
    const prompt = `你是一个专业的历史事件数据融合专家。请分析以下两个事件记录，判断它们是否是同一个事件，如果是，请合并数据。

已有记录：
${JSON.stringify({
  name: existing.name,
  timeRangeStart: existing.timeRangeStart,
  timeRangeEnd: existing.timeRangeEnd,
  locationId: existing.locationId,
  summary: existing.summary,
  type: existing.type,
  impact: existing.impact,
  relatedParagraphs: existing.relatedParagraphs,
}, null, 2)}

新记录：
${JSON.stringify({
  name: newData.name,
  timeRange: newData.timeRange,
  locationId: newData.locationId,
  summary: newData.summary,
  type: newData.type,
  impact: newData.impact,
  relatedParagraphs: newData.relatedParagraphs || [],
}, null, 2)}

请返回 JSON 格式（格式同人物融合）：
{
  "shouldMerge": true/false,
  "confidence": 0.0-1.0,
  "reason": "合并原因",
  "mergedData": {
    "name": "事件名称",
    "timeRangeStart": "开始时间",
    "timeRangeEnd": "结束时间",
    "locationId": "地点ID",
    "summary": "合并后的摘要",
    "type": "事件类型",
    "impact": "影响描述",
    "relatedParagraphs": ["段落ID1", ...]
  },
  "changes": {...}
}

要求：
1. 如果事件名称相同或相近，且时间范围重叠，很可能是同一事件
2. 合并时保留更准确的时间信息
3. 摘要合并时去除重复内容，保留更详细的描述`

    const systemPrompt = '你是一个专业的历史事件数据融合专家，擅长判断历史事件是否是同一个，并智能合并数据。'

    try {
      const result = await this.llm.callJSON<MergeResult<Partial<Event>>>(
        prompt,
        systemPrompt,
        0.3
      )

      // 转换时间格式
      if (result.mergedData.timeRange) {
        result.mergedData.timeRangeStart = result.mergedData.timeRange.start
        result.mergedData.timeRangeEnd = result.mergedData.timeRange.end
        delete result.mergedData.timeRange
      }

      return result
    } catch (error) {
      console.error('LLM 融合错误:', error)
      return {
        shouldMerge: false,
        confidence: 0,
        reason: 'LLM 调用失败，无法判断',
        mergedData: {},
        changes: {},
      }
    }
  }
}

