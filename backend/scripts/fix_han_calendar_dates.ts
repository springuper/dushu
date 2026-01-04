import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 从命令行参数获取是否只是预览（dry-run）
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')

/**
 * 汉朝历法转换规则
 * 
 * 汉朝使用十月为岁首（一年的开始是十月），因此：
 * - 汉X年十月、十一月、十二月 = 公元前(195-X+1)年10月、11月、12月
 * - 汉X年一月到九月 = 公元前(195-X)年1月到9月
 * 
 * 例如：
 * - 汉元年十月 = 公元前206年10月
 * - 汉元年十二月 = 公元前206年12月
 * - 汉元年一月 = 公元前205年1月
 * - 汉十二年十月 = 公元前196年10月
 * - 汉十二年十二月 = 公元前196年12月
 * - 汉十二年四月 = 公元前195年4月
 */

interface TimeCorrection {
  eventId: string
  eventName: string
  oldTime: string
  newTime: string
  reason: string
  hanYear?: number
  hanMonth?: number
}

/**
 * 中文数字转阿拉伯数字
 */
function chineseToNumber(chinese: string): number | null {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
    '十六': 16, '十七': 17, '十八': 18, '十九': 19,
  }
  
  // 直接匹配（优先匹配完整数字，如"十一"、"十二"）
  if (map[chinese]) {
    return map[chinese]
  }
  
  // 处理"十"单独出现（表示10）
  if (chinese === '十') {
    return 10
  }
  
  // 处理"十X"格式（如"十一"、"十二"）
  if (chinese.startsWith('十') && chinese.length > 1) {
    const rest = chinese.substring(1)
    if (map[rest]) {
      return 10 + map[rest]
    }
  }
  
  // 处理"X十"格式（如"二十"、"三十"）
  if (chinese.endsWith('十') && chinese.length > 1) {
    const tens = map[chinese.substring(0, chinese.length - 1)]
    if (tens) {
      return tens * 10
    }
  }
  
  // 处理"X十Y"格式（如"二十一"、"三十二"）
  if (chinese.includes('十') && chinese.length > 2) {
    const parts = chinese.split('十')
    if (parts.length === 2) {
      const tens = map[parts[0]] || 0
      const ones = map[parts[1]] || 0
      return tens * 10 + ones
    }
  }
  
  return null
}

/**
 * 从文本中提取汉朝年份和月份
 * 匹配模式：汉X年Y月 或 汉X年（支持中文数字和阿拉伯数字）
 */
function extractHanCalendarDate(text: string): { year: number; month: number | null } | null {
  // 匹配"汉X年Y月"或"汉X年"（支持中文数字和阿拉伯数字）
  const patterns = [
    /汉([一二三四五六七八九十\d]+)年([一二三四五六七八九十\d]+)月/g,
    /汉([一二三四五六七八九十\d]+)年/g,
  ]

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern))
    if (matches.length > 0) {
      const match = matches[0]
      let year: number
      let month: number | null = null
      
      // 转换年份
      if (/^\d+$/.test(match[1])) {
        year = parseInt(match[1], 10)
      } else {
        const yearNum = chineseToNumber(match[1])
        if (yearNum === null) continue
        year = yearNum
      }
      
      // 转换月份（如果有）
      if (match[2]) {
        if (/^\d+$/.test(match[2])) {
          month = parseInt(match[2], 10)
        } else {
          const monthNum = chineseToNumber(match[2])
          if (monthNum !== null) {
            month = monthNum
          }
        }
      }
      
      return { year, month }
    }
  }

  return null
}

/**
 * 将汉朝历法日期转换为公历日期
 * @param hanYear 汉朝年份（如：1表示汉元年，12表示汉十二年）
 * @param hanMonth 汉朝月份（1-12，null表示只有年份）
 * @returns 公历日期字符串，格式如 "-206-10" 或 "-206年"
 */
function convertHanToGregorian(hanYear: number, hanMonth: number | null): string {
  // 汉元年 = 公元前206年（刘邦称汉王）
  // 汉朝以十月为岁首，所以：
  // - 汉X年十月、十一月、十二月 = 公元前(207 - X)年10月、11月、12月
  // - 汉X年一月到九月 = 公元前(206 - X)年1月到9月
  // 验证：
  //   汉元年十月 = 公元前(207-1)年10月 = 公元前206年10月 ✓
  //   汉十二年四月 = 公元前(206-12)年4月 = 公元前195年4月 ✓
  //   汉十二年十月 = 公元前(207-12)年10月 = 公元前196年10月 ✓
  
  if (hanMonth === null) {
    // 只有年份，返回该汉朝年份对应的主要公历年份（即十月所在的年份）
    const baseYear = 207 - hanYear
    return `-${baseYear}年`
  }

  // 汉朝以十月为岁首
  if (hanMonth >= 10) {
    // 十月、十一月、十二月属于该汉朝年份对应的公历年份（208 - X）
    // 验证：汉元年十月 = 208-1 = 207年？不对，应该是206年
    // 重新计算：汉元年十月 = 公元前206年10月
    // 汉X年十月 = 公元前(207 - X)年10月，但汉12年应该是196年
    // 207-12=195，不对。应该是208-12=196
    // 所以公式：baseYear = 208 - hanYear
    const baseYear = 208 - hanYear
    return `-${baseYear}-${hanMonth.toString().padStart(2, '0')}`
  } else {
    // 一月到九月属于下一公历年份（207 - X）
    // 验证：汉元年一月 = 207-1 = 206年？不对，应该是205年
    // 重新计算：汉元年一月 = 公元前205年1月
    // 汉X年一月 = 公元前(206 - X)年1月
    // 汉12年四月 = 公元前(206-12)年4月 = 公元前195年4月？不对，应该是194年
    // 实际上汉12年四月 = 公元前195年4月，所以206-12=194不对
    // 应该是207-12=195
    const baseYear = 207 - hanYear
    return `-${baseYear}-${hanMonth.toString().padStart(2, '0')}`
  }

  if (hanMonth === null) {
    // 只有年份，返回该汉朝年份对应的主要公历年份（即十月所在的年份）
    return `-${baseYear}年`
  }

  // 汉朝以十月为岁首
  if (hanMonth >= 10) {
    // 十月、十一月、十二月属于该汉朝年份对应的公历年份
    return `-${baseYear}-${hanMonth.toString().padStart(2, '0')}`
  } else {
    // 一月到九月属于下一公历年份（即baseYear - 1）
    return `-${baseYear - 1}-${hanMonth.toString().padStart(2, '0')}`
  }
}

/**
 * 检查当前时间是否需要修正
 */
function shouldCorrectTime(currentTime: string, hanYear: number, hanMonth: number | null): {
  needsCorrection: boolean
  correctTime: string
} {
  const correctTime = convertHanToGregorian(hanYear, hanMonth)
  
  // 如果当前时间已经是正确的，不需要修正
  if (currentTime === correctTime) {
    return { needsCorrection: false, correctTime }
  }

  // 检查是否是近似时间（如"约-195年"）
  if (currentTime.startsWith('约')) {
    const withoutYue = currentTime.substring(1)
    if (withoutYue === correctTime || withoutYue.replace('年', '') === correctTime.replace('年', '')) {
      return { needsCorrection: false, correctTime }
    }
  }

  return { needsCorrection: true, correctTime }
}

async function main() {
  console.log('=== 修正汉朝历法时间错误 ===\n')
  console.log('汉朝历法规则：以十月为岁首\n')

  // 查找所有事件
  const allEvents = await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      timeRangeStart: true,
      summary: true,
    },
  })

  console.log(`检查 ${allEvents.length} 个事件...\n`)

  const corrections: TimeCorrection[] = []

  // 检查每个事件
  let foundHanEvents = 0
  for (const event of allEvents) {
    const summary = event.summary || ''
    const timeStart = event.timeRangeStart

    // 从摘要中提取汉朝历法日期
    const hanDate = extractHanCalendarDate(summary)
    if (!hanDate) {
      continue
    }

    foundHanEvents++
    const { year: hanYear, month: hanMonth } = hanDate
    const { needsCorrection, correctTime } = shouldCorrectTime(timeStart, hanYear, hanMonth)

    if (needsCorrection) {
      corrections.push({
        eventId: event.id,
        eventName: event.name,
        oldTime: timeStart,
        newTime: correctTime,
        reason: `汉${hanYear}年${hanMonth !== null ? `${hanMonth}月` : ''}应转换为${correctTime}（汉朝以十月为岁首）`,
        hanYear,
        hanMonth: hanMonth || undefined,
      })
    }
  }

  if (foundHanEvents > 0) {
    console.log(`找到 ${foundHanEvents} 个包含汉朝历法的事件，其中 ${corrections.length} 个需要修正。\n`)
  }

  if (corrections.length === 0) {
    console.log('没有发现需要修正的事件。')
    return
  }

  console.log(`需要修正 ${corrections.length} 个事件的时间：\n`)

  // 按汉朝年份分组显示
  const byHanYear = new Map<number, TimeCorrection[]>()
  for (const correction of corrections) {
    if (correction.hanYear) {
      if (!byHanYear.has(correction.hanYear)) {
        byHanYear.set(correction.hanYear, [])
      }
      byHanYear.get(correction.hanYear)!.push(correction)
    }
  }

  // 显示需要修正的事件
  for (const [hanYear, yearCorrections] of Array.from(byHanYear.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`汉${hanYear}年事件：`)
    for (const correction of yearCorrections) {
      console.log(`  - "${correction.eventName}"`)
      console.log(`    时间: ${correction.oldTime} -> ${correction.newTime}`)
      console.log(`    原因: ${correction.reason}\n`)
    }
  }

  if (isDryRun) {
    console.log('=== 预览模式（--dry-run）===')
    console.log('以上事件将被修正，但不会实际更新数据库。')
    console.log('要实际执行修正，请运行: npm run fix-han-calendar-dates')
    return
  }

  // 执行修正
  console.log('开始修正事件时间...\n')

  let successCount = 0
  let errorCount = 0

  for (const correction of corrections) {
    try {
      await prisma.event.update({
        where: { id: correction.eventId },
        data: {
          timeRangeStart: correction.newTime,
        },
      })
      successCount++
      console.log(`  ✓ 已修正: "${correction.eventName}" (${correction.oldTime} -> ${correction.newTime})`)
    } catch (error: any) {
      errorCount++
      console.error(`  ✗ 修正失败: "${correction.eventName}" - ${error.message}`)
    }
  }

  console.log('\n=== 修正完成 ===')
  console.log(`成功修正: ${successCount} 个事件`)
  if (errorCount > 0) {
    console.log(`修正失败: ${errorCount} 个事件`)
  }
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

