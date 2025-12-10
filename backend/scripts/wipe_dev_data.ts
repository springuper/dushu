import { prisma } from '../src/lib/prisma'

/**
 * 清空提取相关数据（dev 环境）
 * 范围：ReviewItem、ChangeLog、Relationship、Event、Person、Place
 * 运行：npx ts-node backend/scripts/wipe_dev_data.ts
 * 警告：不可逆，请仅在 dev 使用
 */
async function main() {
  console.log('[wipe_dev_data] start')

  // 无需保留的审核记录
  await prisma.reviewItem.deleteMany({})
  // 变更日志（如果保留历史，请注释掉）
  await prisma.changeLog.deleteMany({})
  // 关系依赖人物，先删关系
  await prisma.relationship.deleteMany({})
  // 事件依赖地点，先删事件
  await prisma.event.deleteMany({})
  // 人物
  await prisma.person.deleteMany({})
  // 地点
  await prisma.place.deleteMany({})

  console.log('[wipe_dev_data] done')
}

main()
  .catch((err) => {
    console.error('[wipe_dev_data] failed', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

