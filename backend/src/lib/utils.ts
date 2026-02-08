/**
 * 提取器工具函数
 * 可复用的纯函数，可在其他地方使用
 */

import { ExtractedPlace } from './llmExtractor'

// ============================================
// 常量
// ============================================

export const MAX_WINDOW_CHARS = 12000 // 约合 4k-6k tokens
export const LONG_WINDOW_CHARS = 20000 // 约合 8k-12k tokens

// ============================================
// 工具函数
// ============================================

export interface ParagraphInput {
  id?: string
  order?: number
  text: string
}

/**
 * 统计数组中某个字段的分布
 */
export function countByType<T extends Record<string, any>>(
  items: T[],
  field: keyof T
): Record<string, number> {
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
export function chunkParagraphsWithIds(
  paragraphs: ParagraphInput[],
  fallbackText: string
): {
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
export function chunkParagraphs(
  paragraphs: ParagraphInput[],
  fallbackText: string
): string[] {
  return chunkParagraphsWithIds(paragraphs, fallbackText).chunks
}

/**
 * 清理地点名称：处理括号格式，提取主地名
 * 格式：'主地名 (别名/区域)' -> 返回'主地名'
 * 如：'鸿门 (戏)' -> '鸿门'
 */
export function cleanLocationName(location: string): string {
  // 移除括号及其内容，提取主地名
  // 匹配格式：'主地名 (别名)' 或 '主地名（别名）'
  const cleaned = location.replace(/[（(][^）)]+[）)]/g, '').trim()
  return cleaned || location.trim() // 如果没有括号，返回原字符串
}

/**
 * 提取地点别名：从括号格式中提取别名
 * 格式：'主地名 (别名/区域)' -> 返回'别名/区域'
 * 如：'鸿门 (戏)' -> '戏'
 */
export function extractLocationAlias(location: string): string | null {
  const match = location.match(/[（(]([^）)]+)[）)]/)
  return match ? match[1].trim() : null
}

/**
 * 将数据库 Place 转换为 ExtractedPlace
 */
export function convertPlaceToExtracted(place: any): ExtractedPlace {
  return {
    name: place.name,
    aliases: place.aliases || [],
    coordinates: place.coordinatesLng && place.coordinatesLat
      ? {
          lng: place.coordinatesLng,
          lat: place.coordinatesLat,
        }
      : undefined,
    modernLocation: place.modernLocation || '',
    modernAddress: place.modernAddress,
    adminLevel1: place.adminLevel1,
    adminLevel2: place.adminLevel2,
    adminLevel3: place.adminLevel3,
    geographicContext: place.geographicContext,
    featureType: place.featureType,
    timeRangeBegin: place.timeRangeBegin,
    timeRangeEnd: place.timeRangeEnd,
    chgisId: place.chgisId,
    source:
      place.source === 'CHGIS'
        ? 'CHGIS'
        : place.source === 'LLM'
          ? 'LLM'
          : 'HYBRID',
  }
}

/**
 * 解析中文日期字符串为可排序的数值
 * 公元前用负数表示，公元后用正数
 * 例如："前206年" -> -206, "25年" -> 25, "前206年12月" -> -206.12, "-206-12" -> -206.12
 * 
 * 排序规则：
 * - 前256年 < 前206年 < 前195年 < 1年 < 25年
 * - 同年内：1月 < 4月 < 12月
 */
export function parseChineseDate(dateStr: string): number {
  if (!dateStr) return 0

  // 处理"约"前缀（大致时间，给予小的偏移以便排序）
  const isApproximate = dateStr.startsWith('约')
  let workingStr = isApproximate ? dateStr.substring(1) : dateStr

  // 判断是否为公元前（支持 '前' 和 '-' 两种格式）
  const isBCE = workingStr.startsWith('前') || workingStr.startsWith('-')
  if (isBCE) {
    workingStr = workingStr.startsWith('前')
      ? workingStr.substring(1)
      : workingStr.substring(1) // 移除 '-' 前缀
  }

  // 提取年份（支持 '年' 后缀、'-206-12' 格式或直接数字）
  let yearMatch = workingStr.match(/(\d+)年/)
  if (!yearMatch) {
    // 尝试匹配 '-206-12' 格式或纯数字格式
    yearMatch = workingStr.match(/^(\d+)/)
  }
  // 如果无法匹配数字年份（如"汉元年十一月"），返回一个基于字符串哈希的数值
  // 这样可以保持相对顺序，但不会与可解析的日期混淆
  if (!yearMatch) {
    // 返回一个很大的正数（公元后），让无法解析的日期排在最后
    // 使用字符串的简单哈希来保持相对顺序
    let hash = 0
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i)
      hash = hash & hash // Convert to 32bit integer
    }
    return 10000 + Math.abs(hash) % 1000 // 返回 10000-10999 之间的值
  }

  let year = parseInt(yearMatch[1], 10)

  // 提取月份作为小数部分（用于更精确排序）
  // 月份范围1-12，转换为0.01-0.12
  // 支持 '月' 后缀或 '-12' 格式（如 '-206-12'）
  let monthMatch = workingStr.match(/(\d+)月/)
  if (!monthMatch) {
    // 尝试匹配 '-206-12' 格式中的月份（在年份匹配之后的部分）
    // 例如：'206-12' -> 匹配 '-12'
    const afterYear = workingStr.substring(yearMatch[0].length)
    monthMatch = afterYear.match(/-(\d+)$/)
  }
  let month = monthMatch ? parseInt(monthMatch[1], 10) / 100 : 0

  // 处理季节（粗略转换为月份）
  // 春=3月(0.03), 夏=6月(0.06), 秋=9月(0.09), 冬=12月(0.12)
  if (!monthMatch) {
    if (workingStr.includes('春')) {
      month = 0.03
    } else if (workingStr.includes('夏')) {
      month = 0.06
    } else if (workingStr.includes('秋')) {
      month = 0.09
      // 秋末 = 11月
      if (workingStr.includes('秋末') || workingStr.includes('晚秋')) {
        month = 0.11
      }
    } else if (workingStr.includes('冬')) {
      month = 0.12
    }
  }

  // 公元前用负数，月份从年份中减去（这样月份越大，数值越大，排序越靠后）
  // 前256年 = -256, 前256年4月 = -(256 - 0.04) = -255.96
  // 这样 -256 < -255.96，表示1月排在4月之前（正确）
  if (isBCE) {
    const result = -(year - month)
    // 如果是大致时间，给予小的随机偏移以便区分（但保持大致顺序）
    return isApproximate ? result + 0.0001 : result
  }

  // 公元后：年份 + 月份
  const result = year + month
  return isApproximate ? result - 0.0001 : result
}

/**
 * 按时间排序事件（处理公元前/后的正确顺序）
 * 使用 parseChineseDate 进行排序，支持多种时间格式
 */
export function sortEventsByTime<T extends { timeRangeStart: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const timeA = parseChineseDate(a.timeRangeStart)
    const timeB = parseChineseDate(b.timeRangeStart)
    return timeA - timeB
  })
}

/**
 * 按段落顺序和时间排序事件
 * 优先按照段落的顺序排序（如果有多个段落，按最前面的段落排序）
 * 对于同一段落的，再根据年份来排序
 * 
 * @param events 事件列表
 * @param paragraphOrderMap 段落ID到order的映射 { paragraphId: order }
 */
export function sortEventsByParagraphAndTime<T extends { 
  timeRangeStart: string
  relatedParagraphs?: string[]
}>(
  events: T[],
  paragraphOrderMap: Record<string, number>
): T[] {
  return [...events].sort((a, b) => {
    // 获取每个事件的最前段落order（如果有多个段落，取最小的order）
    const getMinParagraphOrder = (event: T): number => {
      if (!event.relatedParagraphs || event.relatedParagraphs.length === 0) {
        // 如果没有相关段落，返回一个很大的数字，排在最后
        return Number.MAX_SAFE_INTEGER
      }
      
      const orders = event.relatedParagraphs
        .map(paraId => paragraphOrderMap[paraId])
        .filter(order => order !== undefined)
      
      if (orders.length === 0) {
        // 如果段落ID在映射中不存在，返回一个很大的数字，排在最后
        return Number.MAX_SAFE_INTEGER
      }
      
      // 返回最小的order（最前面的段落）
      return Math.min(...orders)
    }
    
    const orderA = getMinParagraphOrder(a)
    const orderB = getMinParagraphOrder(b)
    
    // 先按段落order排序
    if (orderA !== orderB) {
      return orderA - orderB
    }
    
    // 如果段落order相同，再按时间排序
    const timeA = parseChineseDate(a.timeRangeStart)
    const timeB = parseChineseDate(b.timeRangeStart)
    return timeA - timeB
  })
}

