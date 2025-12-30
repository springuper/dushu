import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 清空数据脚本 ===\n')

  // 先显示当前数据统计
  const [personsCount, placesCount, eventsCount, changeLogsCount, reviewItemsCount] = await Promise.all([
    prisma.person.count(),
    prisma.place.count(),
    prisma.event.count(),
    prisma.changeLog.count({
      where: {
        entityType: {
          in: ['PERSON', 'PLACE', 'EVENT']
        }
      }
    }),
    prisma.reviewItem.count({
      where: {
        type: {
          in: ['PERSON', 'PLACE', 'EVENT']
        }
      }
    })
  ])

  console.log('当前数据统计:')
  console.log(`  人物 (Person): ${personsCount}`)
  console.log(`  地点 (Place): ${placesCount}`)
  console.log(`  事件 (Event): ${eventsCount}`)
  console.log(`  相关变更日志 (ChangeLog): ${changeLogsCount}`)
  console.log(`  相关审核项 (ReviewItem): ${reviewItemsCount}\n`)

  if (personsCount === 0 && placesCount === 0 && eventsCount === 0) {
    console.log('数据库已经是空的，无需清空。')
    return
  }

  console.log('开始清空数据...\n')

  try {
    // 1. 先删除相关的变更日志
    if (changeLogsCount > 0) {
      console.log(`正在删除 ${changeLogsCount} 条变更日志...`)
      const deletedLogs = await prisma.changeLog.deleteMany({
        where: {
          entityType: {
            in: ['PERSON', 'PLACE', 'EVENT']
          }
        }
      })
      console.log(`✓ 已删除 ${deletedLogs.count} 条变更日志`)
    }

    // 2. 删除相关的审核项
    if (reviewItemsCount > 0) {
      console.log(`正在删除 ${reviewItemsCount} 条审核项...`)
      const deletedReviews = await prisma.reviewItem.deleteMany({
        where: {
          type: {
            in: ['PERSON', 'PLACE', 'EVENT']
          }
        }
      })
      console.log(`✓ 已删除 ${deletedReviews.count} 条审核项`)
    }

    // 3. 删除事件（Event）
    if (eventsCount > 0) {
      console.log(`正在删除 ${eventsCount} 条事件...`)
      const deletedEvents = await prisma.event.deleteMany({})
      console.log(`✓ 已删除 ${deletedEvents.count} 条事件`)
    }

    // 4. 删除人物（Person）
    if (personsCount > 0) {
      console.log(`正在删除 ${personsCount} 个人物...`)
      const deletedPersons = await prisma.person.deleteMany({})
      console.log(`✓ 已删除 ${deletedPersons.count} 个人物`)
    }

    // 5. 删除地点（Place）
    if (placesCount > 0) {
      console.log(`正在删除 ${placesCount} 个地点...`)
      const deletedPlaces = await prisma.place.deleteMany({})
      console.log(`✓ 已删除 ${deletedPlaces.count} 个地点`)
    }

    console.log('\n=== 清空完成 ===')
    console.log('所有 Person、Place、Event 数据已清空。')

  } catch (error) {
    console.error('清空数据时出错:', error)
    throw error
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

