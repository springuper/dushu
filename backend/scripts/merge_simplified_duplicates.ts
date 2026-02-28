/**
 * 合并繁简重复数据脚本
 *
 * 将同一章节内繁简异体（如「田横」与「田橫」）的人物、地点合并为一条记录，
 * 统一使用简体中文名称，并更新相关引用（TextMention、Event.actors）。
 * 不跨章节合并。
 *
 * 用法：
 *   npx tsx scripts/merge_simplified_duplicates.ts [--dry-run] [--persons-only] [--places-only]
 */
import { PrismaClient } from '@prisma/client'

// 使用 opencc-js 的 t2cn 模块（繁→简）
const { Converter } = require('opencc-js/t2cn')
const toSimplified = Converter({ from: 'tw', to: 'cn' })

const prisma = new PrismaClient()

const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')
const personsOnly = process.argv.includes('--persons-only')
const placesOnly = process.argv.includes('--places-only')

/**
 * 将人名/地名转换为简体（用于分组去重）
 */
function toSimplifiedName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  return toSimplified(name.trim())
}

/**
 * 选择保留的主记录：优先选择名称已是简体的，否则选信息最完整的
 */
function selectPrimaryPerson<T extends { name: string; biography?: string; aliases?: string[] }>(
  records: T[]
): T {
  const simplified = records.find((r) => r.name === toSimplifiedName(r.name))
  if (simplified) return simplified

  return records.reduce((best, curr) => {
    const bestScore = (best.biography?.length || 0) + (best.aliases?.length || 0) * 10
    const currScore = (curr.biography?.length || 0) + (curr.aliases?.length || 0) * 10
    return currScore > bestScore ? curr : best
  })
}

function selectPrimaryPlace<T extends { name: string; modernLocation?: string; aliases?: string[] }>(
  records: T[]
): T {
  const simplified = records.find((r) => r.name === toSimplifiedName(r.name))
  if (simplified) return simplified

  return records.reduce((best, curr) => {
    const bestScore = (best.modernLocation?.length || 0) + (best.aliases?.length || 0) * 10
    const currScore = (curr.modernLocation?.length || 0) + (curr.aliases?.length || 0) * 10
    return currScore > bestScore ? curr : best
  })
}

async function mergePersonDuplicates() {
  console.log('\n=== 合并人物繁简重复（同章节内）===\n')

  const persons = await prisma.person.findMany({
    orderBy: { name: 'asc' },
  })

  // 按 (chapterId, 简体name) 分组，只合并同章节内的繁简重复
  const groups = new Map<string, typeof persons>()
  for (const p of persons) {
    const key = `${p.chapterId}|${toSimplifiedName(p.name)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([, arr]) => arr.length > 1)
  if (duplicateGroups.length === 0) {
    console.log('未发现人物繁简重复。')
    return { merged: 0, deleted: 0 }
  }

  console.log(`发现 ${duplicateGroups.length} 组繁简重复人物：\n`)

  let merged = 0
  let deleted = 0

  for (const [, records] of duplicateGroups) {
    const primary = selectPrimaryPerson(records)
    const duplicates = records.filter((r) => r.id !== primary.id)

    console.log(`"${primary.name}" (同章节内 ${records.length} 条):`)
    console.log(`  保留: ${primary.id} (${primary.name})`)
    for (const dup of duplicates) {
      console.log(`  合并: ${dup.id} (${dup.name})`)
    }

    if (!isDryRun) {
      // 1. 合并 aliases（把重复记录的名称加入 primary 的 aliases）
      const allAliases = new Set(primary.aliases || [])
      for (const dup of duplicates) {
        if (dup.name !== primary.name && !allAliases.has(dup.name)) {
          allAliases.add(dup.name)
        }
        ;(dup.aliases || []).forEach((a) => allAliases.add(a))
      }
      const mergedAliases = Array.from(allAliases)

      // 2. 更新 primary：统一为简体名，合并 biography（取更长的）
      let mergedBiography = primary.biography
      for (const dup of duplicates) {
        if (dup.biography && dup.biography.length > (mergedBiography?.length || 0)) {
          mergedBiography = dup.biography
        }
      }

      const simplifiedName = toSimplifiedName(primary.name)

      await prisma.person.update({
        where: { id: primary.id },
        data: {
          name: simplifiedName,
          aliases: mergedAliases,
          biography: mergedBiography || primary.biography,
        },
      })
      merged++

      // 3. 更新 TextMention：entityId 从 duplicate 改为 primary
      // 若同一 span 已存在指向 primary 的 mention，则删除重复的，否则更新
      const duplicateIds = duplicates.map((d) => d.id)
      const dupMentions = await prisma.textMention.findMany({
        where: { entityType: 'PERSON', entityId: { in: duplicateIds } },
      })
      let mentionUpdated = 0
      let mentionDeleted = 0
      for (const m of dupMentions) {
        const existing = await prisma.textMention.findFirst({
          where: {
            paragraphId: m.paragraphId,
            startIndex: m.startIndex,
            endIndex: m.endIndex,
            entityType: 'PERSON',
            entityId: primary.id,
          },
        })
        if (existing) {
          await prisma.textMention.delete({ where: { id: m.id } })
          mentionDeleted++
        } else {
          await prisma.textMention.update({
            where: { id: m.id },
            data: { entityId: primary.id },
          })
          mentionUpdated++
        }
      }

      // 4. 更新 Event.actors 中的 personId
      const events = await prisma.event.findMany({
        where: { chapterId: primary.chapterId },
      })
      let eventsUpdated = 0
      for (const event of events) {
        const actors = (event.actors as any[]) || []
        let changed = false
        const newActors = actors.map((a: any) => {
          if (a.personId && duplicateIds.includes(a.personId)) {
            changed = true
            return { ...a, personId: primary.id }
          }
          return a
        })
        if (changed) {
          await prisma.event.update({
            where: { id: event.id },
            data: { actors: newActors },
          })
          eventsUpdated++
        }
      }

      // 5. 删除重复记录
      const deleteResult = await prisma.person.deleteMany({
        where: { id: { in: duplicateIds } },
      })
      deleted += deleteResult.count

      console.log(`  ✓ 已合并，更新 ${mentionUpdated} 处提及、删除 ${mentionDeleted} 处重复提及，更新 ${eventsUpdated} 个事件，删除 ${deleteResult.count} 条重复\n`)
    } else {
      console.log('  [预览] 将合并上述记录\n')
    }
  }

  return { merged, deleted }
}

async function mergePlaceDuplicates() {
  console.log('\n=== 合并地点繁简重复 ===\n')

  const places = await prisma.place.findMany({
    orderBy: { name: 'asc' },
  })

  const groups = new Map<string, typeof places>()
  for (const p of places) {
    const key = `${p.chapterId}|${toSimplifiedName(p.name)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([, arr]) => arr.length > 1)
  if (duplicateGroups.length === 0) {
    console.log('未发现地点繁简重复。')
    return { merged: 0, deleted: 0 }
  }

  console.log(`发现 ${duplicateGroups.length} 组繁简重复地点：\n`)

  let merged = 0
  let deleted = 0

  for (const [, records] of duplicateGroups) {
    const primary = selectPrimaryPlace(records)
    const duplicates = records.filter((r) => r.id !== primary.id)

    console.log(`"${primary.name}" (章节内共 ${records.length} 条):`)
    console.log(`  保留: ${primary.id} (${primary.name})`)
    for (const dup of duplicates) {
      console.log(`  合并: ${dup.id} (${dup.name})`)
    }

    if (!isDryRun) {
      const allAliases = new Set(primary.aliases || [])
      for (const dup of duplicates) {
        if (dup.name !== primary.name && !allAliases.has(dup.name)) {
          allAliases.add(dup.name)
        }
        ;(dup.aliases || []).forEach((a) => allAliases.add(a))
      }

      const simplifiedName = toSimplifiedName(primary.name)

      await prisma.place.update({
        where: { id: primary.id },
        data: {
          name: simplifiedName,
          aliases: Array.from(allAliases),
        },
      })
      merged++

      const duplicateIds = duplicates.map((d) => d.id)
      const dupMentions = await prisma.textMention.findMany({
        where: { entityType: 'PLACE', entityId: { in: duplicateIds } },
      })
      for (const m of dupMentions) {
        const existing = await prisma.textMention.findFirst({
          where: {
            paragraphId: m.paragraphId,
            startIndex: m.startIndex,
            endIndex: m.endIndex,
            entityType: 'PLACE',
            entityId: primary.id,
          },
        })
        if (existing) {
          await prisma.textMention.delete({ where: { id: m.id } })
        } else {
          await prisma.textMention.update({
            where: { id: m.id },
            data: { entityId: primary.id },
          })
        }
      }

      const deleteResult = await prisma.place.deleteMany({
        where: { id: { in: duplicateIds } },
      })
      deleted += deleteResult.count

      console.log(`  ✓ 已合并并删除 ${deleteResult.count} 条重复\n`)
    } else {
      console.log('  [预览] 将合并上述记录\n')
    }
  }

  return { merged, deleted }
}

async function main() {
  console.log('========== 合并繁简重复数据 ==========')
  if (isDryRun) {
    console.log('【预览模式】不会实际修改数据，去掉 --dry-run 后执行\n')
  }

  let personStats = { merged: 0, deleted: 0 }
  let placeStats = { merged: 0, deleted: 0 }

  if (!placesOnly) {
    personStats = await mergePersonDuplicates()
  }
  if (!personsOnly) {
    placeStats = await mergePlaceDuplicates()
  }

  console.log('\n========== 完成 ==========')
  console.log(`人物: 合并 ${personStats.merged} 组，删除 ${personStats.deleted} 条重复`)
  console.log(`地点: 合并 ${placeStats.merged} 组，删除 ${placeStats.deleted} 条重复`)
  if (isDryRun) {
    console.log('\n要实际执行，请运行: npx tsx scripts/merge_simplified_duplicates.ts')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
