import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 从命令行参数获取是否只是预览（dry-run）
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')

/**
 * 合并事件摘要（保留更详细的）
 */
function mergeEventSummary(existingSummary: string, newSummary: string): string {
  if (!newSummary || newSummary.startsWith('（') || newSummary.length < 20) {
    return existingSummary
  }
  if (!existingSummary || existingSummary.startsWith('（') || existingSummary.length < 20) {
    return newSummary
  }
  // 如果两者都有内容，保留更长的那个
  return newSummary.length > existingSummary.length ? newSummary : existingSummary
}

/**
 * 合并事件相关段落 ID
 */
function mergeRelatedParagraphs(existing: string[], newParagraphs: string[]): string[] {
  return Array.from(new Set([...existing, ...newParagraphs]))
}

/**
 * 合并事件参与者
 */
function mergeEventActors(existingActors: any[], newActors: any[]): any[] {
  // 使用 Map 来去重，基于 name 和 roleType
  const actorMap = new Map<string, any>()
  
  // 先添加已存在的参与者
  for (const actor of existingActors) {
    const key = `${actor.name || ''}_${actor.roleType || ''}`
    if (!actorMap.has(key)) {
      actorMap.set(key, actor)
    }
  }
  
  // 再添加新的参与者
  for (const actor of newActors) {
    const key = `${actor.name || ''}_${actor.roleType || ''}`
    if (!actorMap.has(key)) {
      actorMap.set(key, actor)
    }
  }
  
  return Array.from(actorMap.values())
}

/**
 * 选择主事件（保留信息最完整的那个）
 */
function selectPrimaryEvent(events: any[]): any {
  // 优先选择：
  // 1. summary 最长的（信息最完整）
  // 2. 如果有相同长度，选择最早创建的（更可能是原始数据）
  return events.reduce((primary, current) => {
    const primaryScore = (primary.summary?.length || 0) + (primary.impact?.length || 0)
    const currentScore = (current.summary?.length || 0) + (current.impact?.length || 0)
    
    if (currentScore > primaryScore) {
      return current
    } else if (currentScore === primaryScore) {
      // 如果分数相同，选择更早创建的
      return new Date(primary.createdAt) < new Date(current.createdAt) ? primary : current
    }
    return primary
  })
}

async function main() {
  console.log('开始查找重复事件...\n')

  // 获取所有事件，按名称分组
  const allEvents = await prisma.event.findMany({
    orderBy: { name: 'asc' },
  })

  console.log(`总共找到 ${allEvents.length} 个事件`)

  // 按名称分组
  const eventsByName = new Map<string, any[]>()
  for (const event of allEvents) {
    const name = event.name.trim()
    if (!eventsByName.has(name)) {
      eventsByName.set(name, [])
    }
    eventsByName.get(name)!.push(event)
  }

  // 找出重复的事件（名称相同且数量 > 1）
  const duplicateGroups: Array<{ name: string; events: any[] }> = []
  for (const [name, events] of eventsByName.entries()) {
    if (events.length > 1) {
      duplicateGroups.push({ name, events })
    }
  }

  console.log(`找到 ${duplicateGroups.length} 组重复事件\n`)

  if (duplicateGroups.length === 0) {
    console.log('没有发现重复事件，无需清理。')
    return
  }

  // 显示重复事件统计
  let totalDuplicates = 0
  for (const group of duplicateGroups) {
    totalDuplicates += group.events.length - 1 // 减去要保留的一个
    console.log(`  "${group.name}": ${group.events.length} 个重复事件`)
  }

  console.log(`\n将删除 ${totalDuplicates} 个重复事件，保留 ${duplicateGroups.length} 个主事件\n`)

  if (isDryRun) {
    console.log('=== 预览模式（--dry-run）===')
    console.log('以下是将要合并的重复事件：\n')
    
    for (const group of duplicateGroups) {
      const { name, events } = group
      const primaryEvent = selectPrimaryEvent(events)
      const duplicateEvents = events.filter(e => e.id !== primaryEvent.id)
      
      console.log(`"${name}":`)
      console.log(`  保留: ${primaryEvent.id} (${primaryEvent.summary?.substring(0, 50)}...)`)
      for (const dup of duplicateEvents) {
        console.log(`  删除: ${dup.id} (${dup.summary?.substring(0, 50)}...)`)
      }
      console.log()
    }
    
    console.log('\n要实际执行合并，请运行: npm run deduplicate-events')
    return
  }

  console.log('开始合并重复事件...\n')

  let mergedCount = 0
  let deletedCount = 0

  for (const group of duplicateGroups) {
    const { name, events } = group
    
    // 选择主事件
    const primaryEvent = selectPrimaryEvent(events)
    const duplicateEvents = events.filter(e => e.id !== primaryEvent.id)

    console.log(`处理: "${name}"`)
    console.log(`  保留主事件: ${primaryEvent.id} (创建于 ${primaryEvent.createdAt.toISOString()})`)
    console.log(`  将合并 ${duplicateEvents.length} 个重复事件`)

    // 合并所有重复事件的信息到主事件
    let mergedSummary = primaryEvent.summary
    let mergedImpact = primaryEvent.impact
    let mergedRelatedParagraphs = [...(primaryEvent.relatedParagraphs || [])]
    let mergedActors = [...((primaryEvent.actors as any[]) || [])]
    let mergedLocationName = primaryEvent.locationName
    let mergedLocationModernName = primaryEvent.locationModernName
    let mergedTimeRangeEnd = primaryEvent.timeRangeEnd

    for (const duplicate of duplicateEvents) {
      // 合并摘要
      mergedSummary = mergeEventSummary(mergedSummary, duplicate.summary)
      
      // 合并影响描述（保留更长的）
      if (duplicate.impact && duplicate.impact.trim()) {
        if (!mergedImpact || duplicate.impact.length > mergedImpact.length) {
          mergedImpact = duplicate.impact
        }
      }
      
      // 合并相关段落
      mergedRelatedParagraphs = mergeRelatedParagraphs(
        mergedRelatedParagraphs,
        duplicate.relatedParagraphs || []
      )
      
      // 合并参与者
      mergedActors = mergeEventActors(
        mergedActors,
        (duplicate.actors as any[]) || []
      )
      
      // 合并地点信息（如果主事件没有，使用重复事件的）
      if (!mergedLocationName && duplicate.locationName) {
        mergedLocationName = duplicate.locationName
      }
      if (!mergedLocationModernName && duplicate.locationModernName) {
        mergedLocationModernName = duplicate.locationModernName
      }
      
      // 合并结束时间（如果主事件没有，使用重复事件的）
      if (!mergedTimeRangeEnd && duplicate.timeRangeEnd) {
        mergedTimeRangeEnd = duplicate.timeRangeEnd
      }
    }

    // 更新主事件
    try {
      if (!isDryRun) {
        await prisma.event.update({
          where: { id: primaryEvent.id },
          data: {
            summary: mergedSummary,
            impact: mergedImpact,
            relatedParagraphs: mergedRelatedParagraphs,
            actors: mergedActors,
            locationName: mergedLocationName,
            locationModernName: mergedLocationModernName,
            timeRangeEnd: mergedTimeRangeEnd,
          },
        })
        mergedCount++

        // 删除重复事件
        const duplicateIds = duplicateEvents.map(e => e.id)
        const deleteResult = await prisma.event.deleteMany({
          where: {
            id: { in: duplicateIds },
          },
        })
        deletedCount += deleteResult.count

        console.log(`  ✓ 已合并并删除 ${deleteResult.count} 个重复事件\n`)
      } else {
        console.log(`  [预览] 将合并 ${duplicateEvents.length} 个重复事件到主事件\n`)
      }
    } catch (error: any) {
      console.error(`  ✗ 处理失败: ${error.message}\n`)
    }
  }

  console.log('\n=== 清理完成 ===')
  console.log(`合并了 ${mergedCount} 组重复事件`)
  console.log(`删除了 ${deletedCount} 个重复事件`)
  
  // 显示最终统计
  const finalCount = await prisma.event.count()
  console.log(`\n当前数据库中共有 ${finalCount} 个事件`)
}

main()
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

