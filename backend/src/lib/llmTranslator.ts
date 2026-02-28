/**
 * LLM 段落翻译服务
 * 将文言文段落翻译为现代汉语
 */
import { LLMService } from './llm'
import { createLogger } from './logger'
import {
  buildTranslationPrompt,
  translationSystemPrompt,
} from './prompts'

const logger = createLogger('translator')

const BATCH_SIZE = 25 // 每批翻译的段落数

export interface TranslationResult {
  paragraphId: string
  translation: string
}

export class LLMTranslator {
  private llm: LLMService

  constructor() {
    this.llm = new LLMService()
  }

  /**
   * 翻译多个段落
   * 使用 paragraphIndex 与 LLM 交互，再映射回 paragraphId，避免 UUID 转录错误
   */
  async translate(
    bookName: string,
    chapterTitle: string,
    paragraphs: { id: string; text: string }[]
  ): Promise<TranslationResult[]> {
    const results: TranslationResult[] = []
    const toTranslate = paragraphs
      .filter((p) => p.text.trim().length > 0)
      .map((p, idx) => ({ ...p, index: idx + 1 }))

    if (toTranslate.length === 0) {
      return results
    }

    const indexToParagraph = new Map(toTranslate.map((p) => [p.index, p]))

    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE)
      const prompt = buildTranslationPrompt(bookName, chapterTitle, batch)

      try {
        const response = await this.llm.callJSON<{
          translations: Array<{ paragraphIndex: number; translation: string }>
        }>(prompt, translationSystemPrompt(), 0.2)

        if (response?.translations && Array.isArray(response.translations)) {
          for (const t of response.translations) {
            const idx = typeof t.paragraphIndex === 'number' ? t.paragraphIndex : parseInt(String(t.paragraphIndex), 10)
            const para = indexToParagraph.get(idx)
            if (para && t.translation) {
              results.push({ paragraphId: para.id, translation: t.translation })
            }
          }
        }

        if (i + BATCH_SIZE < toTranslate.length) {
          await new Promise((r) => setTimeout(r, 500))
        }
      } catch (err: any) {
        logger.error('Translation batch failed', {
          batchStart: i,
          error: err.message,
        })
        throw err
      }
    }

    return results
  }
}
