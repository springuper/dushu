/**
 * LLM 服务
 * 支持 OpenAI 和 Google Gemini API
 */

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
      console.log('===gemini model', this.model, apiKey)
    } else {
      // OpenAI
      const apiKey = config.apiKey || process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('需要设置 OPENAI_API_KEY 环境变量')
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      })
      this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
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
    console.log('===call', this.provider)
    if (this.provider === 'gemini') {
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${prompt}`
        : prompt
      const result = await this.client.generateContent(fullPrompt)
      return result.response.text()
    } else {
      // OpenAI
      const messages: any[] = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature,
      })

      return response.choices[0].message.content || ''
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
    const content = await this.call(prompt, systemPrompt, temperature)
    
    // 尝试提取 JSON（可能包含 markdown 代码块）
    let jsonContent = content.trim()
    if (jsonContent.startsWith('```')) {
      const lines = jsonContent.split('\n')
      jsonContent = lines.slice(1, -1).join('\n')
    }

    try {
      return JSON.parse(jsonContent)
    } catch (error) {
      console.error('JSON 解析错误:', error)
      console.error('原始内容:', content.substring(0, 500))
      throw new Error(`LLM 返回的 JSON 格式错误: ${error}`)
    }
  }
}

