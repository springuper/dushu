import { prisma } from '../src/lib/prisma'

/**
 * 清理旧的提取数据（ReviewItem 来源为 LLM_EXTRACT）
 * 运行方式（需要 ts-node）：
 *   npx ts-node backend/scripts/cleanup_old_extraction.ts
 */
async function main() {
  const deleted = await prisma.reviewItem.deleteMany({
    where: {
      source: {
        in: ['LLM_EXTRACT'],
      },
    },
  })

  console.log(`[cleanup_old_extraction] deleted review items: ${deleted.count}`)
}

main()
  .catch((err) => {
    console.error('[cleanup_old_extraction] failed', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

