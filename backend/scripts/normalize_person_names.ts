/**
 * 将数据库中的人物名称统一为简体中文
 *
 * 遍历所有 Person 记录，将 name 和 aliases 中的繁体转为简体。
 * 若同章节内转换后与已有记录冲突（如 司馬卬 与 司马卬 同在项羽本纪），则合并为一条。
 *
 * 用法：
 *   npx tsx scripts/normalize_person_names.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client'

const { Converter } = require('opencc-js/t2cn')
const toSimplified = Converter({ from: 'tw', to: 'cn' })

const prisma = new PrismaClient()
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')

function toSimplifiedName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  return toSimplified(name.trim())
}

function normalizeAliases(aliases: string[]): string[] {
  if (!Array.isArray(aliases)) return []
  const result = [...new Set(aliases.map((a) => toSimplifiedName(a)).filter(Boolean))]
  return result
}

async function main() {
  console.log('========== 人物名称繁转简 ==========')
  if (isDryRun) console.log('【预览模式】不会实际修改数据\n')

  const persons = await prisma.person.findMany({ orderBy: { name: 'asc' } })

  let updated = 0
  let merged = 0
  let skipped = 0

  for (const p of persons) {
    const stillExists = await prisma.person.findUnique({ where: { id: p.id } })
    if (!stillExists) continue

    const simplifiedName = toSimplifiedName(p.name)
    if (!simplifiedName) continue

    if (simplifiedName === p.name) {
      // 名称已是简体，仅检查 aliases
      const normAliases = normalizeAliases(p.aliases || [])
      const sortedOrig = [...(p.aliases || [])].sort().join(',')
      const sortedNorm = [...normAliases].sort().join(',')
      if (sortedOrig !== sortedNorm && !isDryRun) {
        await prisma.person.update({
          where: { id: p.id },
          data: { aliases: normAliases },
        })
        console.log(`  别名规范化: ${p.name}`)
        updated++
      }
      continue
    }

    // 名称需转为简体
    const existing = await prisma.person.findFirst({
      where: {
        chapterId: p.chapterId,
        name: simplifiedName,
        id: { not: p.id },
      },
    })

    if (existing) {
      // 同章节已有简体版本，合并
      console.log(`  合并: "${p.name}" → "${simplifiedName}" (保留 ${existing.id})`)
      if (!isDryRun) {
        const allAliases = new Set([...(existing.aliases || []), p.name, ...(p.aliases || [])])
        const mergedAliases = normalizeAliases(Array.from(allAliases))

        await prisma.person.update({
          where: { id: existing.id },
          data: {
            aliases: mergedAliases,
            biography:
              (existing.biography?.length || 0) >= (p.biography?.length || 0)
                ? existing.biography
                : p.biography,
          },
        })

        const dupMentions = await prisma.textMention.findMany({
          where: { entityType: 'PERSON', entityId: p.id },
        })
        for (const m of dupMentions) {
          const conflict = await prisma.textMention.findFirst({
            where: {
              paragraphId: m.paragraphId,
              startIndex: m.startIndex,
              endIndex: m.endIndex,
              entityType: 'PERSON',
              entityId: existing.id,
            },
          })
          if (conflict) {
            await prisma.textMention.delete({ where: { id: m.id } })
          } else {
            await prisma.textMention.update({
              where: { id: m.id },
              data: { entityId: existing.id },
            })
          }
        }

        const events = await prisma.event.findMany({ where: { chapterId: p.chapterId } })
        for (const ev of events) {
          const actors = (ev.actors as any[]) || []
          const changed = actors.some((a: any) => a.personId === p.id)
          if (changed) {
            await prisma.event.update({
              where: { id: ev.id },
              data: {
                actors: actors.map((a: any) =>
                  a.personId === p.id ? { ...a, personId: existing.id } : a
                ),
              },
            })
          }
        }

        await prisma.person.delete({ where: { id: p.id } })
        merged++
      }
    } else {
      // 无冲突，直接更新
      console.log(`  更新: "${p.name}" → "${simplifiedName}"`)
      if (!isDryRun) {
        const normAliases = normalizeAliases(p.aliases || [])
        if (p.name !== simplifiedName && !normAliases.includes(p.name)) {
          normAliases.unshift(p.name) // 原繁体名加入别名
        }
        await prisma.person.update({
          where: { id: p.id },
          data: { name: simplifiedName, aliases: normAliases },
        })
        updated++
      }
    }
  }

  console.log('\n========== 完成 ==========')
  console.log(`更新: ${updated} 条，合并: ${merged} 条`)
  if (isDryRun) console.log('\n实际执行请去掉 --dry-run')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
