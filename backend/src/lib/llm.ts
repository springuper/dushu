/**
 * LLM 服务
 * 支持 OpenAI 和 Google Gemini API
 */

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createLogger } from './logger'
import * as fs from 'fs'
import * as path from 'path'

const logger = createLogger('llm')

// 调试文件保存目录
const DEBUG_DIR = path.join(process.cwd(), 'debug', 'llm-calls')

// 确保调试目录存在
function ensureDebugDir() {
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true })
  }
}

// 保存调试文件
function saveDebugFile(filename: string, content: string) {
  try {
    ensureDebugDir()
    const filePath = path.join(DEBUG_DIR, filename)
    fs.writeFileSync(filePath, content, 'utf-8')
    logger.debug('Debug file saved', { file: filename })
  } catch (error: any) {
    logger.warn('Failed to save debug file', { filename, error: error.message })
  }
}

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
    const envProvider = (process.env.LLM_PROVIDER as LLMProvider | undefined)?.toLowerCase() as
      | LLMProvider
      | undefined
    const provider = config.provider || envProvider || this.detectProvider()
    this.provider = provider === 'auto' ? this.detectProvider() : provider

    if (this.provider === 'gemini') {
      const apiKey = config.apiKey || process.env.GOOGLE_API_KEY
      if (!apiKey) {
        throw new Error('需要设置 GOOGLE_API_KEY 环境变量')
      }
      const genAI = new GoogleGenerativeAI(apiKey)
      const envModel = process.env.LLM_MODEL || process.env.GEMINI_MODEL
      this.model = config.model || envModel || 'gemini-2.5-flash'
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
      const envModel = process.env.LLM_MODEL || process.env.OPENAI_MODEL
      this.model = config.model || envModel || 'gpt-4o-mini'
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
  async call(
    prompt: string, 
    systemPrompt?: string, 
    temperature: number = 0.1,
    callId?: string
  ): Promise<string> {
    const inputChars = prompt.length + (systemPrompt?.length || 0)
    const timer = logger.startTimer('LLM call')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const finalCallId = callId || `${timestamp}_${this.provider}_${Date.now()}`
    
    // 请求前日志
    logger.info('LLM request sending', {
      provider: this.provider,
      model: this.model,
      inputChars,
      promptPreview: prompt.substring(0, 200).replace(/\n/g, ' ') + (prompt.length > 200 ? '...' : ''),
      hasSystemPrompt: !!systemPrompt,
      temperature,
      callId: finalCallId,
    })

    // 保存 prompt 到文件
    const promptContent = systemPrompt 
      ? `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${prompt}`
      : `=== PROMPT ===\n${prompt}`
    saveDebugFile(`${finalCallId}_prompt.txt`, promptContent)

    try {
      if (this.provider === 'gemini') {
        logger.debug('Gemini API calling', { 
          promptLength: prompt.length,
          systemPromptLength: systemPrompt?.length || 0,
        })
        
        const requestConfig: any = {
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
          },
        }
        const result = await this.client.generateContent(requestConfig)
        
        // 检查 response 是否存在
        if (!result.response) {
          throw new Error('Gemini API returned no response')
        }
        
        let text: string
        try {
          text = result.response.text()
        } catch (textError: any) {
          // 如果 text() 方法失败，保存原始 response 用于调试
          saveDebugFile(`${finalCallId}_response_error.txt`, JSON.stringify({
            error: textError.message,
            response: result.response,
            candidates: result.response.candidates,
          }, null, 2))
          throw new Error(`Failed to extract text from Gemini response: ${textError.message}`)
        }
        
        // 保存 response 到文件
        saveDebugFile(`${finalCallId}_response.txt`, text)
        
        // 请求后日志
        logger.info('LLM response received', {
          provider: this.provider,
          inputChars,
          outputChars: text.length,
          responsePreview: text.substring(0, 150).replace(/\n/g, ' ') + (text.length > 150 ? '...' : ''),
          callId: finalCallId,
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
        
        // 保存 response 到文件
        saveDebugFile(`${finalCallId}_response.txt`, text)
        
        // 请求后日志
        logger.info('LLM response received', {
          provider: this.provider,
          inputChars,
          outputChars: text.length,
          responsePreview: text.substring(0, 150).replace(/\n/g, ' ') + (text.length > 150 ? '...' : ''),
          usage: response.usage,
          callId: finalCallId,
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
      // 保存错误信息到文件
      const errorInfo = {
        error: error.message,
        errorName: error.name,
        errorCode: error.code || error.status,
        stack: error.stack,
        provider: this.provider,
        model: this.model,
        inputChars,
        timestamp: new Date().toISOString(),
      }
      saveDebugFile(`${finalCallId}_error.json`, JSON.stringify(errorInfo, null, 2))
      
      // 如果有 response 但解析失败，也保存原始 response
      if (error.response || (error.cause && error.cause.response)) {
        try {
          const responseData = error.response || error.cause.response
          saveDebugFile(`${finalCallId}_error_response.txt`, JSON.stringify(responseData, null, 2))
        } catch (e) {
          // 忽略序列化错误
        }
      }
      
      logger.error('LLM request failed', {
        provider: this.provider,
        model: this.model,
        inputChars,
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code || error.status,
        callId: finalCallId,
        debugFile: `See debug/llm-calls/${finalCallId}_error.json for details`,
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const callId = `${timestamp}_${this.provider}_json_${Date.now()}`
    logger.debug('LLM JSON call started', { callId })
    
    // 传递 callId 给 call 方法，确保文件名一致
    const content = await this.call(prompt, systemPrompt, temperature, callId)
    
    // 尝试提取 JSON（可能包含 markdown 代码块）
    let jsonContent = content.trim()
    const hadCodeBlock = jsonContent.startsWith('```')
    if (hadCodeBlock) {
      // 更健壮的代码块去除：使用正则匹配整个代码块
      const codeBlockMatch = jsonContent.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/)
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim()
        logger.debug('Stripped markdown code block from response')
      } else {
        // 回退到原来的简单方法
        const lines = jsonContent.split('\n')
        jsonContent = lines.slice(1, -1).join('\n')
        logger.debug('Stripped markdown code block from response (fallback method)')
      }
    }

    try {
      const parsed = JSON.parse(jsonContent)
      
      // 保存解析后的 JSON（格式化）
      saveDebugFile(`${callId}_parsed.json`, JSON.stringify(parsed, null, 2))
      
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
        callId,
      })
      
      return parsed
    } catch (error: any) {
      // 尝试从错误信息中提取位置信息
      const positionMatch = error.message.match(/position (\d+)/)
      const position = positionMatch ? parseInt(positionMatch[1], 10) : null
      
      let errorContext = ''
      if (position !== null && position < jsonContent.length) {
        const start = Math.max(0, position - 100)
        const end = Math.min(jsonContent.length, position + 100)
        errorContext = jsonContent.substring(start, end)
        // 标记错误位置
        const relativePos = position - start
        errorContext = 
          errorContext.substring(0, relativePos) + 
          ' <<<ERROR_HERE>>> ' + 
          errorContext.substring(relativePos)
      }
      
      // 保存解析失败的 JSON 内容（用于调试）
      saveDebugFile(`${callId}_failed_json.txt`, jsonContent)
      saveDebugFile(`${callId}_error_info.txt`, JSON.stringify({
        error: error.message,
        contentLength: content.length,
        jsonContentLength: jsonContent.length,
        errorPosition: position,
        errorContext,
        hadCodeBlock,
      }, null, 2))
      
      logger.error('JSON parse failed', {
        error: error.message,
        contentLength: content.length,
        jsonContentLength: jsonContent.length,
        errorPosition: position,
        contentPreview: content.substring(0, 300).replace(/\n/g, ' '),
        errorContext: errorContext || jsonContent.substring(0, 500).replace(/\n/g, ' '),
        hadCodeBlock,
        callId,
        debugFiles: `See debug/llm-calls/${callId}_*.txt for details`,
      })
      throw new Error(`LLM 返回的 JSON 格式错误: ${error}`)
    }
  }
}

