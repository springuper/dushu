import { prisma } from '../src/lib/prisma'
import { EventType } from '@prisma/client'

function mapEventType(type: string): EventType {
  const normalized = (type || '').toUpperCase()
  const map: Record<string, EventType> = {
    WAR: 'BATTLE',
    BATTLE: 'BATTLE',
    POLITICS: 'POLITICAL',
    POLITICAL: 'POLITICAL',
    PERSONAL: 'PERSONAL',
  }
  return map[normalized] || 'OTHER'
}

async function main() {
  console.log('🔍 查找已审核通过的事件 ReviewItem...\n')

  const approvedEvents = await prisma.reviewItem.findMany({
    where: {
      type: 'EVENT',
      status: 'APPROVED',
    },
    orderBy: {
      reviewedAt: 'asc',
    },
  })

  console.log(`找到 ${approvedEvents.length} 个事件 ReviewItem\n`)

  let created = 0
  let skipped = 0
  let errors: Array<{ id: string; name: string; error: string }> = []

  for (const item of approvedEvents) {
    try {
      const data: any = item.modifiedData || item.originalData
      const eventType = mapEventType(data?.type)
      const timeRange = data?.timeRange || data?.timeRangeStart
      const timeRangeStart = typeof timeRange === 'object' ? timeRange.start : data?.timeRangeStart
      const timeRangeEnd = typeof timeRange === 'object' ? timeRange.end : data?.timeRangeEnd
      const timeRangeLunarRaw =
        typeof timeRange === 'object' ? timeRange.lunarCalendar ?? timeRange.lunar ?? null : data?.timeRangeLunar ?? null
      const timeRangeLunar =
        typeof timeRangeLunarRaw === 'boolean' ? String(timeRangeLunarRaw) : timeRangeLunarRaw

      // 简单去重：按名称+开始时间
      const existing = await prisma.event.findFirst({
        where: {
          name: data?.name,
          timeRangeStart: timeRangeStart,
        },
      })
      if (existing) {
        console.log(`⏭️  跳过已存在事件: ${existing.name}`)
        skipped++
        continue
      }

      // 校验地点存在，不存在则置空避免外键错误
      let locationId = data?.locationId || null
      if (locationId) {
        const exists = await prisma.place.findUnique({ where: { id: locationId } })
        if (!exists) {
          locationId = null
        }
      }

      // 校验人物存在，过滤掉不存在的参与者，避免外键错误
      const participantIds = Array.isArray(data?.participants) ? data?.participants : []
      const existingParticipants = await prisma.person.findMany({
        where: { id: { in: participantIds } },
        select: { id: true },
      })
      const validParticipantIds = existingParticipants.map((p) => p.id)

      await prisma.event.create({
        data: {
          name: data?.name,
          timeRangeStart: timeRangeStart,
          timeRangeEnd: timeRangeEnd,
          timeRangeLunar: timeRangeLunar as any,
          locationId,
          chapterId: data?.chapterId || null,
          summary: data?.summary || '',
          type: eventType,
          impact: data?.impact,
          relatedParagraphs: data?.relatedParagraphs || [],
          status: 'PUBLISHED',
          participants: {
            create: validParticipantIds.map((personId: string) => ({
              personId,
            })),
          },
        },
      })

      created++
      console.log(`✅ 已创建事件: ${data?.name}`)
    } catch (error: any) {
      console.error(`❌ 处理失败 (${item.id}): ${error.message}`)
      errors.push({
        id: item.id,
        name: (item.modifiedData || item.originalData as any)?.name || '未知',
        error: error.message,
      })
    }
  }

  console.log('\n=== 处理结果 ===')
  console.log(`✅ 新增: ${created}`)
  console.log(`⏭️  跳过: ${skipped}`)
  console.log(`❌ 错误: ${errors.length}`)

  if (errors.length) {
    console.log('\n错误详情:')
    errors.slice(0, 10).forEach((e) => {
      console.log(`- ${e.name} (${e.id}): ${e.error}`)
    })
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('重新处理事件失败:', error)
  prisma.$disconnect()
  process.exit(1)
})

