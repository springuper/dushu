import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 分析重复数据问题 ===\n')

  // 1. 查询所有人物，按名称分组
  console.log('1. 人物数据统计')
  console.log('─'.repeat(60))
  
  const allPersons = await prisma.person.findMany({
    orderBy: { name: 'asc' },
  })
  
  console.log(`总人物数: ${allPersons.length}\n`)
  
  // 按名称分组
  const nameGroups = new Map<string, typeof allPersons>()
  for (const person of allPersons) {
    const normalizedName = person.name.trim()
    if (!nameGroups.has(normalizedName)) {
      nameGroups.set(normalizedName, [])
    }
    nameGroups.get(normalizedName)!.push(person)
  }
  
  // 找出重复名称
  const duplicates = Array.from(nameGroups.entries())
    .filter(([_, persons]) => persons.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
  
  console.log(`有重复名称的人物组数: ${duplicates.length}`)
  if (duplicates.length > 0) {
    console.log('\n重复人物详情:')
    for (const [name, persons] of duplicates.slice(0, 10)) {
      console.log(`\n  "${name}" (${persons.length}条记录):`)
      for (const person of persons) {
        console.log(`    - ID: ${person.id}`)
        console.log(`      阵营: ${person.faction}`)
        console.log(`      角色: ${person.role}`)
        console.log(`      来源章节: ${person.sourceChapterIds.length}个`)
        console.log(`      状态: ${person.status}`)
        console.log(`      创建时间: ${person.createdAt.toISOString()}`)
        if (person.aliases.length > 0) {
          console.log(`      别名: ${person.aliases.join(', ')}`)
        }
      }
    }
  }
  
  // 2. 特别检查萧何
  console.log('\n\n2. 萧何相关记录')
  console.log('─'.repeat(60))
  const xiaoheRecords = allPersons.filter(p => 
    p.name.includes('萧何') || 
    p.name.includes('蕭何') ||
    p.aliases.some(a => a.includes('萧何') || a.includes('蕭何'))
  )
  
  if (xiaoheRecords.length > 0) {
    console.log(`找到 ${xiaoheRecords.length} 条萧何相关记录:\n`)
    for (const person of xiaoheRecords) {
      console.log(`  ID: ${person.id}`)
      console.log(`  姓名: ${person.name}`)
      console.log(`  阵营: ${person.faction}`)
      console.log(`  角色: ${person.role}`)
      console.log(`  来源章节数: ${person.sourceChapterIds.length}`)
      console.log(`  来源章节IDs: ${person.sourceChapterIds.join(', ')}`)
      console.log(`  状态: ${person.status}`)
      console.log(`  简介: ${person.biography.substring(0, 100)}...`)
      console.log('')
    }
    
    // 查询这些章节的标题
    if (xiaoheRecords[0].sourceChapterIds.length > 0) {
      const chapterIds = xiaoheRecords.flatMap(p => p.sourceChapterIds)
      const uniqueChapterIds = [...new Set(chapterIds)]
      const chapters = await prisma.chapter.findMany({
        where: { id: { in: uniqueChapterIds } },
        select: { id: true, title: true, book: { select: { name: true } } },
      })
      
      console.log('  相关章节:')
      for (const chapter of chapters) {
        console.log(`    - ${chapter.book.name} - ${chapter.title} (${chapter.id})`)
      }
    }
  } else {
    console.log('未找到萧何相关记录')
  }
  
  // 3. 检查不同阵营的同一人物
  console.log('\n\n3. 同一人物在不同章节中的阵营变化')
  console.log('─'.repeat(60))
  
  const factionConflicts: Array<{
    name: string
    records: typeof allPersons
  }> = []
  
  for (const [name, persons] of nameGroups.entries()) {
    if (persons.length > 1) {
      const factions = new Set(persons.map(p => p.faction))
      if (factions.size > 1) {
        factionConflicts.push({ name, records: persons })
      }
    }
  }
  
  console.log(`发现 ${factionConflicts.length} 个人物在不同记录中有不同的阵营:`)
  for (const { name, records } of factionConflicts.slice(0, 10)) {
    console.log(`\n  "${name}":`)
    const factionGroups = new Map<string, typeof records>()
    for (const person of records) {
      if (!factionGroups.has(person.faction)) {
        factionGroups.set(person.faction, [])
      }
      factionGroups.get(person.faction)!.push(person)
    }
    
    for (const [faction, persons] of factionGroups.entries()) {
      console.log(`    阵营 ${faction}: ${persons.length}条记录`)
      for (const person of persons) {
        console.log(`      - ${person.id} (来源: ${person.sourceChapterIds.length}个章节)`)
      }
    }
  }
  
  // 4. 检查事件中的参与者
  console.log('\n\n4. 事件中的参与者信息')
  console.log('─'.repeat(60))
  
  const events = await prisma.event.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
  })
  
  const eventActors = new Map<string, Set<string>>() // 人物名 -> 出现的阵营集合
  
  for (const event of events) {
    const actors = event.actors as any[]
    if (Array.isArray(actors)) {
      for (const actor of actors) {
        if (actor.name) {
          const name = actor.name.trim()
          if (!eventActors.has(name)) {
            eventActors.set(name, new Set())
          }
          // 从事件中推断阵营（如果有的话）
          // 这里我们只记录人物名，实际的阵营需要从Person表中查找
        }
      }
    }
  }
  
  console.log(`检查了 ${events.length} 个事件中的参与者`)
  console.log(`发现 ${eventActors.size} 个不同的人物名出现在事件中`)
  
  // 5. 检查地点数据
  console.log('\n\n5. 地点数据统计')
  console.log('─'.repeat(60))
  
  const allPlaces = await prisma.place.findMany({
    orderBy: { name: 'asc' },
  })
  
  console.log(`总地点数: ${allPlaces.length}`)
  
  // 检查重复地点
  const placeNameGroups = new Map<string, typeof allPlaces>()
  for (const place of allPlaces) {
    const normalizedName = place.name.trim()
    if (!placeNameGroups.has(normalizedName)) {
      placeNameGroups.set(normalizedName, [])
    }
    placeNameGroups.get(normalizedName)!.push(place)
  }
  
  const duplicatePlaces = Array.from(placeNameGroups.entries())
    .filter(([_, places]) => places.length > 1)
  
  console.log(`有重复名称的地点组数: ${duplicatePlaces.length}`)
  if (duplicatePlaces.length > 0) {
    console.log('\n重复地点示例 (前5个):')
    for (const [name, places] of duplicatePlaces.slice(0, 5)) {
      console.log(`  "${name}" (${places.length}条记录):`)
      for (const place of places) {
        console.log(`    - ID: ${place.id}`)
        console.log(`      来源: ${place.source}`)
        console.log(`      来源章节数: ${place.sourceChapterIds.length}`)
        console.log(`      状态: ${place.status}`)
      }
    }
  }
  
  // 6. 检查事件数据
  console.log('\n\n6. 事件数据统计')
  console.log('─'.repeat(60))
  
  const allEvents = await prisma.event.findMany({
    orderBy: { name: 'asc' },
  })
  
  console.log(`总事件数: ${allEvents.length}`)
  
  // 检查重复事件
  const eventNameGroups = new Map<string, typeof allEvents>()
  for (const event of allEvents) {
    const normalizedName = event.name.trim()
    if (!eventNameGroups.has(normalizedName)) {
      eventNameGroups.set(normalizedName, [])
    }
    eventNameGroups.get(normalizedName)!.push(event)
  }
  
  const duplicateEvents = Array.from(eventNameGroups.entries())
    .filter(([_, events]) => events.length > 1)
  
  console.log(`有重复名称的事件组数: ${duplicateEvents.length}`)
  if (duplicateEvents.length > 0) {
    console.log('\n重复事件示例 (前5个):')
    for (const [name, events] of duplicateEvents.slice(0, 5)) {
      console.log(`  "${name}" (${events.length}条记录):`)
      for (const event of events) {
        console.log(`    - ID: ${event.id}`)
        console.log(`      章节ID: ${event.chapterId}`)
        console.log(`      时间: ${event.timeRangeStart}`)
        console.log(`      状态: ${event.status}`)
      }
    }
  }
  
  // 7. 总结
  console.log('\n\n7. 问题总结')
  console.log('─'.repeat(60))
  console.log(`
主要发现:
1. 人物重复: ${duplicates.length} 组重复名称的人物
2. 阵营冲突: ${factionConflicts.length} 个人物在不同记录中有不同的阵营
3. 地点重复: ${duplicatePlaces.length} 组重复名称的地点
4. 事件重复: ${duplicateEvents.length} 组重复名称的事件

潜在问题:
- 同一人物在不同章节中可能被标记为不同的阵营（如萧何）
- 人物、地点、事件可能存在重复记录，需要合并
- 需要建立去重和合并机制
  `)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

