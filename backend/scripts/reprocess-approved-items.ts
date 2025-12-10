import { prisma } from '../src/lib/prisma'
import { PersonRole, Faction } from '@prisma/client'
import { LLMMerger } from '../src/lib/llmMerger'
import { logChange } from '../src/lib/changeLog'

// 映射 JSON 中的 role 值到 Prisma PersonRole 枚举
function mapRole(role: string): PersonRole {
  const roleMap: Record<string, PersonRole> = {
    EMPEROR: 'MONARCH',
    EMPRESS: 'MONARCH',
    WARLORD: 'GENERAL',
    MINISTER: 'ADVISOR',
    GENERAL: 'GENERAL',
    SCHOLAR: 'CIVIL_OFFICIAL',
    // 如果已经是正确的枚举值，直接返回
    MONARCH: 'MONARCH',
    ADVISOR: 'ADVISOR',
    GENERAL: 'GENERAL',
    CIVIL_OFFICIAL: 'CIVIL_OFFICIAL',
    MILITARY_OFFICIAL: 'MILITARY_OFFICIAL',
    RELATIVE: 'RELATIVE',
    EUNUCH: 'EUNUCH',
    OTHER: 'OTHER',
  }
  return roleMap[role.toUpperCase()] || 'OTHER'
}

// 映射 JSON 中的 faction 值到 Prisma Faction 枚举
function mapFaction(faction: string): Faction {
  const factionMap: Record<string, Faction> = {
    '汉': 'HAN',
    'HAN': 'HAN',
    '楚': 'CHU',
    'CHU': 'CHU',
    '张楚': 'CHU', // 张楚可以归为楚
    '赵': 'OTHER', // 暂时归为 OTHER，后续可以扩展枚举
    '秦': 'OTHER', // 暂时归为 OTHER
    'NEUTRAL': 'NEUTRAL',
    'OTHER': 'OTHER',
  }
  return factionMap[faction] || 'OTHER'
}

// 检查是否已存在相同的人物
async function findExistingPerson(personData: any): Promise<string | null> {
  const name = personData.name
  const aliases = personData.aliases || []

  // 先按姓名查找
  const byName = await prisma.person.findFirst({
    where: {
      name: name,
    },
  })

  if (byName) {
    return byName.id
  }

  // 按别名查找
  if (aliases.length > 0) {
    const byAlias = await prisma.person.findFirst({
      where: {
        OR: [
          { aliases: { has: name } }, // 新记录的姓名在已有记录的别名中
          ...aliases.map((alias: string) => ({
            OR: [
              { name: alias }, // 新记录的别名是已有记录的姓名
              { aliases: { has: alias } }, // 新记录的别名在已有记录的别名中
            ],
          })),
        ],
      },
    })

    if (byAlias) {
      return byAlias.id
    }
  }

  return null
}

async function reprocessApprovedItems() {
  console.log('🔍 查找已审核通过但未导入的 ReviewItem...\n')

  // 查找所有已审核通过的 PERSON 类型 reviewItem
  const approvedItems = await prisma.reviewItem.findMany({
    where: {
      type: 'PERSON',
      status: 'APPROVED',
    },
    orderBy: {
      reviewedAt: 'asc',
    },
  })

  console.log(`找到 ${approvedItems.length} 个已审核通过的 ReviewItem\n`)

  if (approvedItems.length === 0) {
    console.log('✅ 没有需要处理的 ReviewItem')
    await prisma.$disconnect()
    return
  }

  // 延迟初始化 LLMMerger，只在需要时才创建
  let merger: LLMMerger | null = null
  let hasLLM = false
  
  // 检查是否有 LLM API key
  if (process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY) {
    try {
      merger = new LLMMerger()
      hasLLM = true
      console.log('✅ LLM 服务可用，将使用智能合并\n')
    } catch (error) {
      console.log('⚠️  LLM 服务不可用，将跳过合并功能\n')
    }
  } else {
    console.log('⚠️  未设置 LLM API key，将跳过合并功能（只创建新记录）\n')
  }

  let successCount = 0
  let skipCount = 0
  let errorCount = 0
  const errors: Array<{ id: string; name: string; error: string }> = []

  for (const item of approvedItems) {
    try {
      const personData = item.modifiedData || item.originalData
      const name = personData.name

      console.log(`处理: ${name} (${item.id.substring(0, 8)}...)`)

      // 检查是否已存在
      const existingPersonId = await findExistingPerson(personData)

      if (existingPersonId) {
        const existingPerson = await prisma.person.findUnique({
          where: { id: existingPersonId },
        })

        if (existingPerson) {
          console.log(`  ⚠️  已存在相同人物: ${existingPerson.name} (${existingPersonId.substring(0, 8)}...)`)
          
          // 检查是否需要合并（通过 LLM 判断）
          const duplicateCheck = (personData as any)?._duplicateCheck
          if (duplicateCheck?.isDuplicate && duplicateCheck.matchingPersonId === existingPersonId && hasLLM && merger) {
            console.log(`  🔄 尝试合并...`)
            
            try {
              const mergeResult = await merger.mergePerson(existingPerson, personData)
              
              if (mergeResult.shouldMerge && mergeResult.confidence >= 0.7) {
                // 合并数据
                const mergedData = { ...mergeResult.mergedData }
                if (mergedData.role) {
                  mergedData.role = mapRole(mergedData.role as string)
                }
                if (mergedData.faction) {
                  mergedData.faction = mapFaction(mergedData.faction as string)
                }

                const previousData = JSON.parse(JSON.stringify(existingPerson))
                const updatedPerson = await prisma.person.update({
                  where: { id: existingPersonId },
                  data: mergedData as any,
                })

                // 记录变更日志
                await logChange({
                  entityType: 'PERSON',
                  entityId: existingPersonId,
                  action: 'MERGE',
                  previousData,
                  currentData: updatedPerson,
                  changes: mergeResult.changes,
                  changedBy: item.reviewedBy || null,
                  changeReason: `从 ReviewItem 重新处理合并 (${item.id})`,
                  mergedFrom: [item.id],
                })

                console.log(`  ✅ 已合并 (置信度: ${(mergeResult.confidence * 100).toFixed(1)}%)`)
                successCount++
              } else {
                console.log(`  ⏭️  跳过（不是同一人，置信度: ${(mergeResult.confidence * 100).toFixed(1)}%）`)
                skipCount++
              }
            } catch (mergeError: any) {
              console.log(`  ⚠️  合并失败: ${mergeError.message}，跳过`)
              skipCount++
            }
          } else {
            console.log(`  ⏭️  跳过（已存在${!hasLLM ? '，且 LLM 不可用' : ''}）`)
            skipCount++
          }
          continue
        }
      }

      // 创建新记录
      const mappedRole = mapRole(personData.role)
      const mappedFaction = mapFaction(personData.faction)

      const newPerson = await prisma.person.create({
        data: {
          name: personData.name,
          aliases: personData.aliases || [],
          role: mappedRole,
          faction: mappedFaction,
          birthYear: personData.birthYear,
          deathYear: personData.deathYear,
          activePeriodStart: personData.activePeriod?.start,
          activePeriodEnd: personData.activePeriod?.end,
          biography: personData.biography,
          keyEvents: personData.keyEvents || [],
          portraitUrl: personData.portraitUrl,
          firstAppearanceChapterId: personData.firstAppearance?.chapterId,
          firstAppearanceParagraphId: personData.firstAppearance?.paragraphId,
          status: 'APPROVED',
        },
      })

      // 记录变更日志
      await logChange({
        entityType: 'PERSON',
        entityId: newPerson.id,
        action: 'CREATE',
        currentData: newPerson,
        changedBy: item.reviewedBy || null,
        changeReason: `从 ReviewItem 重新处理创建 (${item.id})`,
      })

      console.log(`  ✅ 已创建: ${newPerson.name} (${newPerson.id.substring(0, 8)}...)`)
      successCount++
    } catch (error: any) {
      console.error(`  ❌ 错误: ${error.message}`)
      errors.push({
        id: item.id,
        name: (item.modifiedData || item.originalData)?.name || '未知',
        error: error.message,
      })
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 处理结果:')
  console.log(`  ✅ 成功: ${successCount}`)
  console.log(`  ⏭️  跳过: ${skipCount}`)
  console.log(`  ❌ 错误: ${errorCount}`)
  
  if (errors.length > 0) {
    console.log('\n❌ 错误详情:')
    errors.forEach((e) => {
      console.log(`  - ${e.name} (${e.id.substring(0, 8)}...): ${e.error}`)
    })
  }

  await prisma.$disconnect()
}

reprocessApprovedItems().catch((error) => {
  console.error('重新处理失败:', error)
  process.exit(1)
})

