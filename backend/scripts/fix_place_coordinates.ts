/**
 * 修正历史地点的错误坐标
 *
 * 针对「同名异地」导致地图显示错误的问题，将已知错误坐标修正为正确位置。
 * 参见 docs/development/PLACE_GEOCODING_ACCURACY_ANALYSIS.md
 *
 * 用法：
 *   npm run fix-place-coordinates         # 执行修正
 *   npm run fix-place-coordinates:dry-run # 仅预览，不修改数据库
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')

/** 需要修正的地点：名称匹配规则 -> 正确坐标与信息 */
const CORRECTIONS: Array<{
  matchNames: string[] // 匹配 name 或 aliases
  coordinatesLng: number
  coordinatesLat: number
  modernLocation: string
  modernAddress?: string
  adminLevel1?: string
  adminLevel2?: string
  reason: string
}> = [
  {
    matchNames: ['鸿门'],
    coordinatesLng: 109.21,
    coordinatesLat: 34.38,
    modernLocation: '陕西省西安市临潼区',
    modernAddress: '鸿门宴遗址',
    adminLevel1: '陕西省',
    adminLevel2: '西安市临潼区',
    reason: '鸿门宴之鸿门在戏西，今临潼；CHGIS 返回的鸿门县在陕北，系同名异地',
  },
  {
    matchNames: ['蓝田'],
    coordinatesLng: 109.15,
    coordinatesLat: 34.24,
    modernLocation: '陕西省西安市蓝田县',
    adminLevel1: '陕西省',
    adminLevel2: '西安市蓝田县',
    reason: '楚汉战争语境下蓝田为京兆蓝田县，非福建等地蓝田镇',
  },
]

async function main() {
  console.log('=== 修正地点坐标错误 ===\n')
  if (isDryRun) {
    console.log('【预览模式】不会实际修改数据库\n')
  }

  const allPlaces = await prisma.place.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      coordinatesLng: true,
      coordinatesLat: true,
      modernLocation: true,
      chapterId: true,
      chapter: { select: { title: true } },
    },
  })

  const toUpdate: Array<{
    place: (typeof allPlaces)[0]
    correction: (typeof CORRECTIONS)[0]
    matchReason: string
  }> = []

  for (const correction of CORRECTIONS) {
    for (const name of correction.matchNames) {
      for (const place of allPlaces) {
        const nameMatch = place.name === name
        const aliasMatch = Array.isArray(place.aliases) && place.aliases.includes(name)
        if (!nameMatch && !aliasMatch) continue

        // 检查坐标是否已正确，避免重复修正
        const lngOk = place.coordinatesLng != null && Math.abs(place.coordinatesLng - correction.coordinatesLng) < 0.01
        const latOk = place.coordinatesLat != null && Math.abs(place.coordinatesLat - correction.coordinatesLat) < 0.01
        if (lngOk && latOk) {
          console.log(`  跳过（已正确）: ${place.name} [${(place as any).chapter?.title}]`)
          continue
        }

        toUpdate.push({
          place,
          correction,
          matchReason: nameMatch ? 'name' : 'alias',
        })
      }
    }
  }

  if (toUpdate.length === 0) {
    console.log('没有发现需要修正的地点。')
    return
  }

  console.log(`需要修正 ${toUpdate.length} 条地点记录：\n`)

  for (const { place, correction } of toUpdate) {
    console.log(`  ${place.name}`)
    console.log(`    章节: ${(place as any).chapter?.title}`)
    console.log(`    当前: ${place.coordinatesLng ?? '-'}, ${place.coordinatesLat ?? '-'}  ${place.modernLocation ?? ''}`)
    console.log(`    修正: ${correction.coordinatesLng}, ${correction.coordinatesLat}  ${correction.modernLocation}`)
    console.log(`    原因: ${correction.reason}\n`)
  }

  if (isDryRun) {
    console.log('=== 预览模式（--dry-run）===')
    console.log('以上地点将被修正。要实际执行，请运行: npm run fix-place-coordinates')
    return
  }

  let successCount = 0
  let errorCount = 0

  for (const { place, correction } of toUpdate) {
    try {
      await prisma.place.update({
        where: { id: place.id },
        data: {
          coordinatesLng: correction.coordinatesLng,
          coordinatesLat: correction.coordinatesLat,
          modernLocation: correction.modernLocation,
          ...(correction.modernAddress != null && { modernAddress: correction.modernAddress }),
          ...(correction.adminLevel1 != null && { adminLevel1: correction.adminLevel1 }),
          ...(correction.adminLevel2 != null && { adminLevel2: correction.adminLevel2 }),
        },
      })
      successCount++
      console.log(`  ✓ 已修正: ${place.name} [${(place as any).chapter?.title}]`)
    } catch (error: unknown) {
      errorCount++
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ 修正失败: ${place.name} - ${msg}`)
    }
  }

  console.log('\n=== 修正完成 ===')
  console.log(`成功: ${successCount} 条`)
  if (errorCount > 0) {
    console.log(`失败: ${errorCount} 条`)
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
