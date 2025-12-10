import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [books, chapters, paragraphs, persons, events, reviewItems] = await Promise.all([
    prisma.book.count(),
    prisma.chapter.count(),
    prisma.paragraph.count(),
    prisma.person.count(),
    prisma.event.count(),
    prisma.reviewItem.count(),
  ])
  
  console.log('=== 数据统计 ===')
  console.log(`书籍 (Book): ${books}`)
  console.log(`章节 (Chapter): ${chapters}`)
  console.log(`段落 (Paragraph): ${paragraphs}`)
  console.log(`人物 (Person): ${persons}`)
  console.log(`事件 (Event): ${events}`)
  console.log(`待审核 (ReviewItem): ${reviewItems}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
