/**
 * LLM 服务
 * 支持 OpenAI 和 Google Gemini API
 */

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createLogger } from './logger'

const logger = createLogger('llm')

export type LLMProvider = 'openai' | 'gemini' | 'auto'

export interface LLMConfig {
  provider?: LLMProvider
  apiKey?: string
  baseUrl?: string
  model?: string
}

export class LLMService {
  private provider: 'openai' | 'gemini'
  private client: any
  private model: string

  constructor(config: LLMConfig = {}) {
    const provider = config.provider || this.detectProvider()
    this.provider = provider === 'auto' ? this.detectProvider() : provider

    if (this.provider === 'gemini') {
      const apiKey = config.apiKey || process.env.GOOGLE_API_KEY
      if (!apiKey) {
        throw new Error('需要设置 GOOGLE_API_KEY 环境变量')
      }
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = config.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
      this.client = genAI.getGenerativeModel({ model: this.model })
      logger.info('LLM service initialized', { provider: 'gemini', model: this.model })
    } else {
      // OpenAI
      const apiKey = config.apiKey || process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('需要设置 OPENAI_API_KEY 环境变量')
      }
      const baseURL = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      this.client = new OpenAI({
        apiKey,
        baseURL,
      })
      this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
      logger.info('LLM service initialized', { provider: 'openai', model: this.model, baseURL })
    }
  }

  private detectProvider(): 'openai' | 'gemini' {
    if (process.env.GOOGLE_API_KEY) {
      return 'gemini'
    }
    if (process.env.OPENAI_API_KEY) {
      return 'openai'
    }
    throw new Error('需要设置 GOOGLE_API_KEY 或 OPENAI_API_KEY 环境变量')
  }

  /**
   * 调用 LLM
   */
  async call(prompt: string, systemPrompt?: string, temperature: number = 0.3): Promise<string> {
    const inputChars = prompt.length + (systemPrompt?.length || 0)
    const timer = logger.startTimer('LLM call')
    
    // 请求前日志
    logger.info('LLM request sending', {
      provider: this.provider,
      model: this.model,
      inputChars,
      promptPreview: prompt.substring(0, 200).replace(/\n/g, ' ') + (prompt.length > 200 ? '...' : ''),
      hasSystemPrompt: !!systemPrompt,
      temperature,
    })

    try {
      if (this.provider === 'gemini') {
        const fullPrompt = systemPrompt
          ? `${systemPrompt}\n\n${prompt}`
          : prompt
        
        logger.debug('Gemini API calling', { promptLength: fullPrompt.length })
        const result = await this.client.generateContent(fullPrompt)
        const text = result.response.text()
        
        // 请求后日志
        logger.info('LLM response received', {
          provider: this.provider,
          inputChars,
          outputChars: text.length,
          responsePreview: text.substring(0, 150).replace(/\n/g, ' ') + (text.length > 150 ? '...' : ''),
        })
        timer.end({ provider: this.provider, inputChars, outputChars: text.length })
        return text
      } else {
        // OpenAI
        const messages: any[] = []
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt })
        }
        messages.push({ role: 'user', content: prompt })

        logger.debug('OpenAI API calling', { messageCount: messages.length })
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature,
        })

        const text = response.choices[0].message.content || ''
        
        // 请求后日志
        logger.info('LLM response received', {
          provider: this.provider,
          inputChars,
          outputChars: text.length,
          responsePreview: text.substring(0, 150).replace(/\n/g, ' ') + (text.length > 150 ? '...' : ''),
          usage: response.usage,
        })
        timer.end({
          provider: this.provider,
          inputChars,
          outputChars: text.length,
          usage: response.usage,
        })
        return text
      }
    } catch (error: any) {
      logger.error('LLM request failed', {
        provider: this.provider,
        model: this.model,
        inputChars,
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code || error.status,
      })
      timer.endWithError(error, { provider: this.provider, inputChars })
      throw error
    }
  }

  /**
   * 调用 LLM 并解析 JSON
   */
  async callJSON<T = any>(
    prompt: string,
    systemPrompt?: string,
    temperature: number = 0.3
  ): Promise<T> {
    logger.debug('LLM JSON call started')
    
    const content = await this.call(prompt, systemPrompt, temperature)
    
    // 尝试提取 JSON（可能包含 markdown 代码块）
    let jsonContent = content.trim()
    const hadCodeBlock = jsonContent.startsWith('```')
    if (hadCodeBlock) {
      const lines = jsonContent.split('\n')
      jsonContent = lines.slice(1, -1).join('\n')
      logger.debug('Stripped markdown code block from response')
    }

    try {
      const parsed = JSON.parse(jsonContent)
      
      // 记录解析成功的关键信息
      const keys = Object.keys(parsed)
      const summary: Record<string, number | string> = {}
      for (const key of keys) {
        if (Array.isArray(parsed[key])) {
          summary[`${key}Count`] = parsed[key].length
        }
      }
      
      logger.info('LLM JSON parsed successfully', {
        keys,
        ...summary,
        hadCodeBlock,
      })
      
      return parsed
    } catch (error: any) {
      logger.error('JSON parse failed', {
        error: error.message,
        contentLength: content.length,
        contentPreview: content.substring(0, 300).replace(/\n/g, ' '),
        hadCodeBlock,
      })
      throw new Error(`LLM 返回的 JSON 格式错误: ${error}`)
    }
  }
}

