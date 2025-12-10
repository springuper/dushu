/**
 * 统一日志工具
 * 
 * 格式：[时间][模块][级别] 消息 {上下文}
 * 支持：info, warn, error, debug
 * 自动附加：timestamp, requestId, duration
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogContext {
  requestId?: string
  duration?: number
  [key: string]: any
}

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

// 当前环境的最低日志级别
const MIN_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'DEBUG'

// ANSI 颜色代码
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  // 级别颜色
  DEBUG: '\x1b[36m',  // cyan
  INFO: '\x1b[32m',   // green
  WARN: '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',  // red
  // 模块颜色
  module: '\x1b[35m', // magenta
}

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace('T', ' ').replace('Z', '')
}

/**
 * 格式化上下文对象为可读字符串
 */
function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return ''
  }
  
  // 过滤掉 undefined 值
  const filtered = Object.fromEntries(
    Object.entries(context).filter(([_, v]) => v !== undefined)
  )
  
  if (Object.keys(filtered).length === 0) {
    return ''
  }
  
  try {
    return `\n  ${COLORS.dim}${JSON.stringify(filtered)}${COLORS.reset}`
  } catch {
    return `\n  ${COLORS.dim}[无法序列化的上下文]${COLORS.reset}`
  }
}

/**
 * 核心日志函数
 */
function log(level: LogLevel, module: string, message: string, context?: LogContext): void {
  // 检查日志级别
  if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LOG_LEVEL]) {
    return
  }

  const timestamp = formatTimestamp()
  const contextStr = formatContext(context)
  
  const output = `${COLORS.dim}[${timestamp}]${COLORS.reset} ${COLORS.module}[${module}]${COLORS.reset} ${COLORS[level]}[${level}]${COLORS.reset} ${message}${contextStr}`

  switch (level) {
    case 'ERROR':
      console.error(output)
      break
    case 'WARN':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

/**
 * 创建模块专用的 logger
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) => log('DEBUG', module, message, context),
    info: (message: string, context?: LogContext) => log('INFO', module, message, context),
    warn: (message: string, context?: LogContext) => log('WARN', module, message, context),
    error: (message: string, context?: LogContext) => log('ERROR', module, message, context),
    
    /**
     * 计时器：测量操作耗时
     */
    startTimer: (operation: string) => {
      const startTime = Date.now()
      return {
        end: (additionalContext?: LogContext) => {
          const duration = Date.now() - startTime
          log('INFO', module, `${operation} completed`, { duration, ...additionalContext })
          return duration
        },
        endWithError: (error: Error | string, additionalContext?: LogContext) => {
          const duration = Date.now() - startTime
          const errorMessage = error instanceof Error ? error.message : error
          log('ERROR', module, `${operation} failed: ${errorMessage}`, { duration, ...additionalContext })
          return duration
        },
      }
    },
  }
}

/**
 * 生成唯一请求 ID
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * 默认 logger（用于全局日志）
 */
export const logger = createLogger('app')

export type Logger = ReturnType<typeof createLogger>

