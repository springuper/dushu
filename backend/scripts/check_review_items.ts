import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 检查待审核数据 ===\n')

  // 1. 查询所有待审核的人物
  const pendingPersons = await prisma.reviewItem.findMany({
    where: {
      type: 'PERSON',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`待审核人物数: ${pendingPersons.length}\n`)

  // 检查萧何相关的待审核记录
  const xiaohePending = pendingPersons.filter(item => {
    const data = item.originalData as any
    return data.name?.includes('萧何') || 
           data.name?.includes('蕭何') ||
           data.aliases?.some((a: string) => a.includes('萧何') || a.includes('蕭何'))
  })

  if (xiaohePending.length > 0) {
    console.log(`找到 ${xiaohePending.length} 条萧何相关的待审核记录:\n`)
    for (const item of xiaohePending) {
      const data = item.originalData as any
      console.log(`  ReviewItem ID: ${item.id}`)
      console.log(`  姓名: ${data.name}`)
      console.log(`  阵营: ${data.faction}`)
      console.log(`  角色: ${data.role}`)
      console.log(`  状态: ${item.status}`)
      console.log(`  创建时间: ${item.createdAt.toISOString()}`)
      if (data.biography) {
        console.log(`  简介: ${data.biography.substring(0, 100)}...`)
      }
      console.log('')
    }
  }

  // 2. 查询所有待审核的人物，按阵营分组
  console.log('\n\n待审核人物按阵营分组:')
  console.log('─'.repeat(60))
  
  const factionGroups = new Map<string, number>()
  for (const item of pendingPersons) {
    const data = item.originalData as any
    const faction = data.faction || 'UNKNOWN'
    factionGroups.set(faction, (factionGroups.get(faction) || 0) + 1)
  }
  
  for (const [faction, count] of Array.from(factionGroups.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${faction}: ${count} 条`)
  }

  // 3. 查找可能重复的待审核人物（与已发布人物同名）
  console.log('\n\n3. 检查待审核人物与已发布人物的重复')
  console.log('─'.repeat(60))
  
  const publishedPersons = await prisma.person.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, name: true, aliases: true, faction: true },
  })

  const conflicts: Array<{
    pendingItem: typeof pendingPersons[0]
    publishedPerson: typeof publishedPersons[0]
    matchType: string
  }> = []

  for (const item of pendingPersons) {
    const data = item.originalData as any
    const pendingName = data.name?.trim()
    const pendingAliases = (data.aliases || []) as string[]

    for (const published of publishedPersons) {
      // 检查名称匹配
      if (published.name === pendingName) {
        conflicts.push({
          pendingItem: item,
          publishedPerson: published,
          matchType: '名称完全匹配',
        })
        continue
      }

      // 检查别名匹配
      if (published.aliases.includes(pendingName)) {
        conflicts.push({
          pendingItem: item,
          publishedPerson: published,
          matchType: '待审核名称匹配已发布别名',
        })
        continue
      }

      if (pendingAliases.some(a => a === published.name)) {
        conflicts.push({
          pendingItem: item,
          publishedPerson: published,
          matchType: '待审核别名匹配已发布名称',
        })
        continue
      }

      // 检查别名交叉匹配
      const commonAliases = pendingAliases.filter(a => published.aliases.includes(a))
      if (commonAliases.length > 0) {
        conflicts.push({
          pendingItem: item,
          publishedPerson: published,
          matchType: `别名匹配: ${commonAliases.join(', ')}`,
        })
      }
    }
  }

  console.log(`发现 ${conflicts.length} 个潜在的重复记录:\n`)
  
  // 按人物名分组显示
  const conflictGroups = new Map<string, typeof conflicts>()
  for (const conflict of conflicts) {
    const name = (conflict.pendingItem.originalData as any).name
    if (!conflictGroups.has(name)) {
      conflictGroups.set(name, [])
    }
    conflictGroups.get(name)!.push(conflict)
  }

  for (const [name, group] of Array.from(conflictGroups.entries()).slice(0, 10)) {
    console.log(`\n  "${name}":`)
    for (const conflict of group) {
      const pendingData = conflict.pendingItem.originalData as any
      console.log(`    待审核记录 (${conflict.pendingItem.id}):`)
      console.log(`      阵营: ${pendingData.faction}`)
      console.log(`      角色: ${pendingData.role}`)
      console.log(`      匹配类型: ${conflict.matchType}`)
      console.log(`    已发布记录 (${conflict.publishedPerson.id}):`)
      console.log(`      阵营: ${conflict.publishedPerson.faction}`)
      console.log(`      角色: ${conflict.publishedPerson.role || 'N/A'}`)
      
      // 检查阵营是否不同
      if (pendingData.faction !== conflict.publishedPerson.faction) {
        console.log(`      ⚠️  阵营冲突: 待审核=${pendingData.faction}, 已发布=${conflict.publishedPerson.faction}`)
      }
    }
  }

  // 4. 检查事件数据
  console.log('\n\n4. 待审核事件统计')
  console.log('─'.repeat(60))
  
  const pendingEvents = await prisma.reviewItem.findMany({
    where: {
      type: 'EVENT',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`待审核事件数: ${pendingEvents.length}`)

  // 5. 检查地点数据
  console.log('\n\n5. 待审核地点统计')
  console.log('─'.repeat(60))
  
  const pendingPlaces = await prisma.reviewItem.findMany({
    where: {
      type: 'PLACE',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`待审核地点数: ${pendingPlaces.length}`)

  // 6. 总结
  console.log('\n\n6. 总结')
  console.log('─'.repeat(60))
  console.log(`
待审核数据:
- 人物: ${pendingPersons.length} 条
- 事件: ${pendingEvents.length} 条
- 地点: ${pendingPlaces.length} 条

潜在重复:
- 与已发布人物重复: ${conflicts.length} 条

主要问题:
- 待审核数据中可能存在与已发布数据重复的记录
- 同一人物在不同章节中可能被标记为不同的阵营
- 需要建立去重和合并机制
  `)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

