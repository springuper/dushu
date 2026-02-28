/**
 * LLM 实体提及提取服务
 * 从段落中精确标注人物、地点的提及位置（span）
 */
import { LLMService } from './llm'
import { createLogger } from './logger'
import {
  buildMentionExtractPrompt,
  mentionExtractSystemPrompt,
} from './prompts'

const logger = createLogger('mention-extractor')

export interface MentionResult {
  paragraphId: string
  entityType: 'PERSON' | 'PLACE'
  entityId: string
  startIndex: number
  endIndex: number
}

export class LLMMentionExtractor {
  private llm: LLMService

  constructor() {
    this.llm = new LLMService()
  }

  /**
   * 逐段提取 mentions，返回合并结果
   */
  async extractMentions(
    paragraphs: { id: string; text: string }[],
    persons: { id: string; name: string; aliases: string[] }[],
    places: { id: string; name: string; aliases: string[] }[]
  ): Promise<MentionResult[]> {
    const allMentions: MentionResult[] = []
    const personIds = new Set(persons.map((p) => p.id))
    const placeIds = new Set(places.map((p) => p.id))

    // 每段单独调用，保证上下文清晰
    for (const para of paragraphs) {
      if (para.text.trim().length === 0) continue

      const prompt = buildMentionExtractPrompt([para], persons, places)

      try {
        const response = await this.llm.callJSON<{ mentions: MentionResult[] }>(
          prompt,
          mentionExtractSystemPrompt(),
          0.1
        )

        if (response?.mentions && Array.isArray(response.mentions)) {
          for (const m of response.mentions) {
            if (m.paragraphId !== para.id) continue
            if (m.entityType === 'PERSON' && !personIds.has(m.entityId)) continue
            if (m.entityType === 'PLACE' && !placeIds.has(m.entityId)) continue
            if (
              m.startIndex >= 0 &&
              m.endIndex > m.startIndex &&
              m.endIndex <= para.text.length
            ) {
              const spanText = para.text.substring(m.startIndex, m.endIndex)
              if (spanText.length > 0) {
                allMentions.push({
                  paragraphId: m.paragraphId,
                  entityType: m.entityType,
                  entityId: m.entityId,
                  startIndex: m.startIndex,
                  endIndex: m.endIndex,
                })
              }
            }
          }
        }

        await new Promise((r) => setTimeout(r, 300))
      } catch (err: any) {
        logger.error('Mention extract failed for paragraph', {
          paragraphId: para.id,
          error: err.message,
        })
        // 单段失败不阻塞整体，继续下一段
      }
    }

    return allMentions
  }
}
