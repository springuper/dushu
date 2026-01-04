import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 分析待审核数据的来源章节 ===\n')

  // 1. 查询所有待审核的人物，并查看它们的来源章节
  const pendingPersons = await prisma.reviewItem.findMany({
    where: {
      type: 'PERSON',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`待审核人物总数: ${pendingPersons.length}\n`)

  // 按来源章节分组
  const chapterGroups = new Map<string, typeof pendingPersons>()
  
  for (const item of pendingPersons) {
    const data = item.originalData as any
    const chapterId = data.chapterId || data.sourceChapterIds?.[0] || 'UNKNOWN'
    
    if (!chapterGroups.has(chapterId)) {
      chapterGroups.set(chapterId, [])
    }
    chapterGroups.get(chapterId)!.push(item)
  }

  console.log(`来源章节数: ${chapterGroups.size}\n`)

  // 查询章节信息
  const chapterIds = Array.from(chapterGroups.keys()).filter(id => id !== 'UNKNOWN')
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: chapterIds } },
    select: {
      id: true,
      title: true,
      book: { select: { name: true } },
    },
  })

  const chapterMap = new Map(chapters.map(c => [c.id, c]))

  console.log('按来源章节分组:')
  console.log('─'.repeat(60))
  
  for (const [chapterId, items] of Array.from(chapterGroups.entries()).sort((a, b) => b[1].length - a[1].length)) {
    const chapter = chapterMap.get(chapterId)
    const chapterName = chapter 
      ? `${chapter.book.name} - ${chapter.title}` 
      : chapterId === 'UNKNOWN' 
        ? '未知章节' 
        : `章节ID: ${chapterId}`
    
    console.log(`\n${chapterName}:`)
    console.log(`  人物数: ${items.length}`)
    
    // 统计阵营分布
    const factionCounts = new Map<string, number>()
    for (const item of items) {
      const data = item.originalData as any
      const faction = data.faction || 'UNKNOWN'
      factionCounts.set(faction, (factionCounts.get(faction) || 0) + 1)
    }
    
    console.log(`  阵营分布:`)
    for (const [faction, count] of Array.from(factionCounts.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${faction}: ${count}`)
    }
  }

  // 2. 特别查看萧何的记录
  console.log('\n\n2. 萧何相关记录的详细信息')
  console.log('─'.repeat(60))
  
  const xiaoheItems = pendingPersons.filter(item => {
    const data = item.originalData as any
    return data.name?.includes('萧何') || 
           data.name?.includes('蕭何') ||
           data.aliases?.some((a: string) => a.includes('萧何') || a.includes('蕭何'))
  })

  for (const item of xiaoheItems) {
    const data = item.originalData as any
    const chapterId = data.chapterId || data.sourceChapterIds?.[0]
    const chapter = chapterId ? chapterMap.get(chapterId) : null
    
    console.log(`\nReviewItem ID: ${item.id}`)
    console.log(`  姓名: ${data.name}`)
    console.log(`  阵营: ${data.faction}`)
    console.log(`  角色: ${data.role}`)
    console.log(`  来源章节: ${chapter ? `${chapter.book.name} - ${chapter.title}` : chapterId || '未知'}`)
    console.log(`  创建时间: ${item.createdAt.toISOString()}`)
  }

  // 3. 检查与已发布人物的冲突
  console.log('\n\n3. 阵营冲突详情')
  console.log('─'.repeat(60))
  
  const publishedPersons = await prisma.person.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, name: true, faction: true, sourceChapterIds: true },
  })

  const conflicts: Array<{
    name: string
    pendingFaction: string
    publishedFaction: string
    pendingChapter: string
    publishedChapters: string[]
  }> = []

  for (const item of pendingPersons) {
    const data = item.originalData as any
    const pendingName = data.name?.trim()
    const pendingFaction = data.faction || 'UNKNOWN'
    const chapterId = data.chapterId || data.sourceChapterIds?.[0]
    const chapter = chapterId ? chapterMap.get(chapterId) : null
    const pendingChapter = chapter ? `${chapter.book.name} - ${chapter.title}` : chapterId || '未知'

    for (const published of publishedPersons) {
      if (published.name === pendingName) {
        if (published.faction !== pendingFaction) {
          const publishedChapters = await prisma.chapter.findMany({
            where: { id: { in: published.sourceChapterIds } },
            select: { title: true, book: { select: { name: true } } },
          })
          
          conflicts.push({
            name: pendingName,
            pendingFaction,
            publishedFaction: published.faction,
            pendingChapter,
            publishedChapters: publishedChapters.map(c => `${c.book.name} - ${c.title}`),
          })
        }
      }
    }
  }

  console.log(`发现 ${conflicts.length} 个阵营冲突:\n`)
  
  for (const conflict of conflicts.slice(0, 15)) {
    console.log(`\n  "${conflict.name}":`)
    console.log(`    待审核: ${conflict.pendingFaction} (来自: ${conflict.pendingChapter})`)
    console.log(`    已发布: ${conflict.publishedFaction} (来自: ${conflict.publishedChapters.join(', ')})`)
  }

  // 4. 总结
  console.log('\n\n4. 问题总结')
  console.log('─'.repeat(60))
  console.log(`
主要发现:
1. 待审核人物总数: ${pendingPersons.length}
2. 来源章节数: ${chapterGroups.size}
3. 阵营冲突数: ${conflicts.length}

核心问题:
- 同一人物在不同章节中被提取时，可能被标记为不同的阵营
- 例如：萧何在《高祖本纪》中被标记为HAN阵营，但在《项羽本纪》中被标记为OTHER阵营
- 这是因为LLM在提取时，只基于当前章节的上下文来判断阵营，没有考虑人物的整体历史背景

需要解决的问题:
1. 如何识别同一人物在不同章节中的重复记录？
2. 如何合并不同来源的人物信息（特别是阵营、角色等属性）？
3. 如何处理人物在不同历史时期的阵营变化？
4. 如何建立人物、地点、事件的去重和合并机制？
  `)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

