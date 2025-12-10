import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { LLMMerger } from '../lib/llmMerger'
import { logChange, calculateDiff } from '../lib/changeLog'
import { PersonRole, Faction, EventType } from '@prisma/client'

const router = express.Router()

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

// 映射事件类型到 Prisma EventType（前端/提取使用 WAR/POLITICS/...）
function mapEventType(type: string): EventType {
  const normalized = (type || '').toUpperCase()
  const map: Record<string, EventType> = {
    WAR: 'BATTLE',
    BATTLE: 'BATTLE',
    POLITICS: 'POLITICAL',
    POLITICAL: 'POLITICAL',
    PERSONAL: 'PERSONAL',
  }
  return map[normalized] || 'OTHER'
}

// 获取 Review 列表
router.get('/items', requireAuth, async (req, res) => {
  try {
    const { type, status, source, search, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (source) where.source = source

    // 搜索功能（在 originalData 中搜索）
    // 注意：PostgreSQL JSON 搜索需要使用原生查询或 Prisma 的 JSON 操作符
    // 这里简化处理，使用 contains 搜索
    if (search) {
      // 使用 Prisma 的 JSON 过滤（如果支持）
      // 否则在应用层过滤
      where.OR = [
        // 尝试搜索 JSON 字段（需要根据实际数据结构调整）
        { id: { contains: search as string } },
      ]
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [items, total] = await Promise.all([
      prisma.reviewItem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reviewItem.count({ where }),
    ])

    res.json({
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error) {
    console.error('Get review items error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取 Review 详情
router.get('/items/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const item = await prisma.reviewItem.findUnique({
      where: { id },
    })

    if (!item) {
      return res.status(404).json({ error: 'Review item not found' })
    }

    // 如果是人物类型且有重复检测，获取匹配的人物信息
    let matchingPerson = null
    if (item.type === 'PERSON') {
      const personData = item.modifiedData || item.originalData
      const duplicateCheck = (personData as any)?._duplicateCheck
      if (duplicateCheck?.isDuplicate && duplicateCheck.matchingPersonId) {
        matchingPerson = await prisma.person.findUnique({
          where: { id: duplicateCheck.matchingPersonId },
          select: {
            id: true,
            name: true,
            aliases: true,
            biography: true,
            role: true,
            faction: true,
            birthYear: true,
            deathYear: true,
            activePeriodStart: true,
            activePeriodEnd: true,
            keyEvents: true,
          },
        })
      }
    }

    res.json({
      ...item,
      matchingPerson,
    })
  } catch (error) {
    console.error('Get review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 通过审核
router.post('/items/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { notes, mergeTargetId, useLLMMerge = true } = req.body
    console.info('[review] approve start', { id, mergeTargetId, useLLMMerge })
    const item = await prisma.reviewItem.findUnique({
      where: { id },
    })

    if (!item) {
      return res.status(404).json({ error: 'Review item not found' })
    }

    const newData = item.modifiedData || item.originalData
    const adminId = req.session!.adminId

    // 使用 LLM 融合服务
    const merger = new LLMMerger()

    if (item.type === 'PERSON') {
      const duplicateCheck = (newData as any)?._duplicateCheck
      let targetPersonId = mergeTargetId || duplicateCheck?.matchingPersonId

      // 如果检测到可能的重复，使用 LLM 判断是否应该合并
      if (targetPersonId && useLLMMerge) {
        const targetPerson = await prisma.person.findUnique({
          where: { id: targetPersonId },
        })

        if (targetPerson) {
          // 使用 LLM 判断和合并
          const mergeResult = await merger.mergePerson(targetPerson, newData)

          if (mergeResult.shouldMerge && mergeResult.confidence >= 0.7) {
            // 合并数据，确保 role 和 faction 被正确映射
            const mergedData = { ...mergeResult.mergedData }
            if (mergedData.role) {
              mergedData.role = mapRole(mergedData.role as string)
            }
            if (mergedData.faction) {
              mergedData.faction = mapFaction(mergedData.faction as string)
            }
            
            const previousData = JSON.parse(JSON.stringify(targetPerson))
            
            // 更新人物状态为 PUBLISHED（审核通过即发布）
            const updatedPerson = await prisma.person.update({
              where: { id: targetPersonId },
              data: {
                ...mergedData as any,
                status: 'PUBLISHED',
              },
            })

            // 记录变更日志
            await logChange({
              entityType: 'PERSON',
              entityId: targetPersonId,
              action: 'MERGE',
              previousData,
              currentData: updatedPerson,
              changes: mergeResult.changes,
              changedBy: adminId,
              changeReason: notes || mergeResult.reason,
              mergedFrom: [item.id], // 记录来源 ReviewItem ID
            })

            // 更新 ReviewItem
            const updatedItem = await prisma.reviewItem.update({
              where: { id },
              data: {
                status: 'APPROVED',
                reviewerNotes: notes || `已通过 LLM 融合到: ${targetPerson.name} (置信度: ${(mergeResult.confidence * 100).toFixed(1)}%)`,
                reviewedBy: adminId,
                reviewedAt: new Date(),
              },
            })

            console.info('[review] approve merged person', {
              reviewItemId: id,
              targetPersonId,
              confidence: mergeResult.confidence,
            })
            return res.json({
              ...updatedItem,
              merged: true,
              mergeResult,
              mergedPerson: updatedPerson,
            })
          }
        }
      }

      // 如果没有合并，创建新记录
      // 映射 role 和 faction 到正确的枚举值
      const mappedRole = mapRole(newData.role)
      const mappedFaction = mapFaction(newData.faction)
      
      const newPerson = await prisma.person.create({
        data: {
          name: newData.name,
          aliases: newData.aliases || [],
          role: mappedRole,
          faction: mappedFaction,
          birthYear: newData.birthYear,
          deathYear: newData.deathYear,
          activePeriodStart: newData.activePeriod?.start,
          activePeriodEnd: newData.activePeriod?.end,
          biography: newData.biography,
          keyEvents: newData.keyEvents || [],
          portraitUrl: newData.portraitUrl,
          firstAppearanceChapterId: newData.firstAppearance?.chapterId,
          firstAppearanceParagraphId: newData.firstAppearance?.paragraphId,
          status: 'PUBLISHED', // 审核通过即发布
        },
      })

      // 记录变更日志
      await logChange({
        entityType: 'PERSON',
        entityId: newPerson.id,
        action: 'CREATE',
        currentData: newPerson,
        changedBy: adminId,
        changeReason: notes || '从 ReviewItem 创建',
      })

      // 更新 ReviewItem
      const updatedItem = await prisma.reviewItem.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewerNotes: notes,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      })

      return res.json({
        ...updatedItem,
        createdPerson: newPerson,
      })
    }

    if (item.type === 'EVENT') {
      // 直接创建事件并发布（当前不做重复检测）
      const eventType = mapEventType((newData as any)?.type)
      const timeRange = (newData as any)?.timeRange || (newData as any)?.timeRangeStart
      const timeRangeStart =
        typeof timeRange === 'object' ? timeRange.start : (newData as any)?.timeRangeStart
      const timeRangeEnd =
        typeof timeRange === 'object' ? timeRange.end : (newData as any)?.timeRangeEnd
      const timeRangeLunarRaw =
        typeof timeRange === 'object'
          ? timeRange.lunarCalendar ?? (timeRange as any)?.lunar ?? null
          : (newData as any)?.timeRangeLunar ?? null
      const timeRangeLunar =
        typeof timeRangeLunarRaw === 'boolean'
          ? String(timeRangeLunarRaw)
          : timeRangeLunarRaw

      let locationId = (newData as any)?.locationId || null
      if (locationId) {
        const exists = await prisma.place.findUnique({ where: { id: locationId } })
        if (!exists) {
          locationId = null
        }
      }

      // 过滤不存在的参与者，避免外键错误
      const participantIds = Array.isArray((newData as any)?.participants)
        ? (newData as any)?.participants
        : []
      const existingParticipants = await prisma.person.findMany({
        where: { id: { in: participantIds } },
        select: { id: true },
      })
      const validParticipantIds = existingParticipants.map((p) => p.id)

      const createdEvent = await prisma.event.create({
        data: {
          name: (newData as any)?.name,
          timeRangeStart: timeRangeStart,
          timeRangeEnd: timeRangeEnd,
          timeRangeLunar: timeRangeLunar as any,
          locationId,
          chapterId: (newData as any)?.chapterId || null,
          summary: (newData as any)?.summary || '',
          type: eventType,
          impact: (newData as any)?.impact,
          relatedParagraphs: (newData as any)?.relatedParagraphs || [],
          status: 'PUBLISHED', // 审核通过即发布
          participants: {
            create: validParticipantIds.map((personId: string) => ({
              personId,
            })),
          },
        },
      })

      const updatedItem = await prisma.reviewItem.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewerNotes: notes,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      })

      return res.json({
        ...updatedItem,
        createdEvent,
      })
    }

    // 其他类型（地点等）暂时只更新状态
    const updatedItem = await prisma.reviewItem.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewerNotes: notes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(updatedItem)
  } catch (error) {
    console.error('[review] approve error', { id: req.params?.id, error })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 拒绝审核
router.post('/items/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body

    const item = await prisma.reviewItem.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewerNotes: notes,
        reviewedBy: req.session!.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(item)
  } catch (error) {
    console.error('Reject review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 保存修改
router.post('/items/:id/update', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { modifiedData, notes } = req.body

    const item = await prisma.reviewItem.update({
      where: { id },
      data: {
        status: 'MODIFIED',
        modifiedData,
        reviewerNotes: notes,
        reviewedBy: req.session!.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(item)
  } catch (error) {
    console.error('Update review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量通过审核（直接发布）
router.post('/batch-approve', requireAuth, async (req, res) => {
  try {
    const { ids, notes } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    const adminId = req.session!.adminId
    const merger = new LLMMerger()
    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    // 逐个处理，因为需要创建实体
    for (const id of ids) {
      try {
        const item = await prisma.reviewItem.findUnique({
          where: { id },
        })

        if (!item || item.status !== 'PENDING') {
          errorCount++
          continue
        }

        const newData = item.modifiedData || item.originalData

        if (item.type === 'PERSON') {
          const duplicateCheck = (newData as any)?._duplicateCheck
          let targetPersonId = duplicateCheck?.matchingPersonId

          // 如果检测到可能的重复，使用 LLM 判断是否应该合并
          if (targetPersonId) {
            const targetPerson = await prisma.person.findUnique({
              where: { id: targetPersonId },
            })

            if (targetPerson) {
              const mergeResult = await merger.mergePerson(targetPerson, newData)

              if (mergeResult.shouldMerge && mergeResult.confidence >= 0.7) {
                const mergedData = { ...mergeResult.mergedData }
                if (mergedData.role) {
                  mergedData.role = mapRole(mergedData.role as string)
                }
                if (mergedData.faction) {
                  mergedData.faction = mapFaction(mergedData.faction as string)
                }

                const previousData = JSON.parse(JSON.stringify(targetPerson))
                const updatedPerson = await prisma.person.update({
                  where: { id: targetPersonId },
                  data: {
                    ...mergedData as any,
                    status: 'PUBLISHED',
                  },
                })

                await logChange({
                  entityType: 'PERSON',
                  entityId: targetPersonId,
                  action: 'MERGE',
                  previousData,
                  currentData: updatedPerson,
                  changes: mergeResult.changes,
                  changedBy: adminId,
                  changeReason: notes || mergeResult.reason,
                  mergedFrom: [item.id],
                })

                await prisma.reviewItem.update({
                  where: { id },
                  data: {
                    status: 'APPROVED',
                    reviewerNotes: notes || `已通过 LLM 融合到: ${targetPerson.name}`,
                    reviewedBy: adminId,
                    reviewedAt: new Date(),
                  },
                })

                successCount++
                continue
              }
            }
          }

          // 创建新记录
          const mappedRole = mapRole(newData.role)
          const mappedFaction = mapFaction(newData.faction)

          const newPerson = await prisma.person.create({
            data: {
              name: newData.name,
              aliases: newData.aliases || [],
              role: mappedRole,
              faction: mappedFaction,
              birthYear: newData.birthYear,
              deathYear: newData.deathYear,
              activePeriodStart: newData.activePeriod?.start,
              activePeriodEnd: newData.activePeriod?.end,
              biography: newData.biography,
              keyEvents: newData.keyEvents || [],
              portraitUrl: newData.portraitUrl,
              firstAppearanceChapterId: newData.firstAppearance?.chapterId,
              firstAppearanceParagraphId: newData.firstAppearance?.paragraphId,
              status: 'PUBLISHED',
            },
          })

          await logChange({
            entityType: 'PERSON',
            entityId: newPerson.id,
            action: 'CREATE',
            currentData: newPerson,
            changedBy: adminId,
            changeReason: notes || '从 ReviewItem 批量创建',
          })

          await prisma.reviewItem.update({
            where: { id },
            data: {
              status: 'APPROVED',
              reviewerNotes: notes,
              reviewedBy: adminId,
              reviewedAt: new Date(),
            },
          })

          successCount++
        } else if (item.type === 'EVENT') {
          const eventType = mapEventType((newData as any)?.type)
          const timeRange = (newData as any)?.timeRange || (newData as any)?.timeRangeStart
          const timeRangeStart =
            typeof timeRange === 'object' ? timeRange.start : (newData as any)?.timeRangeStart
          const timeRangeEnd =
            typeof timeRange === 'object' ? timeRange.end : (newData as any)?.timeRangeEnd
      const timeRangeLunarRaw =
        typeof timeRange === 'object'
          ? timeRange.lunarCalendar ?? (timeRange as any)?.lunar ?? null
          : (newData as any)?.timeRangeLunar ?? null
      const timeRangeLunar =
        typeof timeRangeLunarRaw === 'boolean'
          ? String(timeRangeLunarRaw)
          : timeRangeLunarRaw

          let locationId = (newData as any)?.locationId || null
          if (locationId) {
            const exists = await prisma.place.findUnique({ where: { id: locationId } })
            if (!exists) {
              locationId = null
            }
          }

          const participantIds = Array.isArray((newData as any)?.participants)
            ? (newData as any)?.participants
            : []
          const existingParticipants = await prisma.person.findMany({
            where: { id: { in: participantIds } },
            select: { id: true },
          })
          const validParticipantIds = existingParticipants.map((p) => p.id)

          await prisma.event.create({
            data: {
              name: (newData as any)?.name,
              timeRangeStart: timeRangeStart,
              timeRangeEnd: timeRangeEnd,
              timeRangeLunar: timeRangeLunar as any,
              locationId,
              chapterId: (newData as any)?.chapterId || null,
              summary: (newData as any)?.summary || '',
              type: eventType,
              impact: (newData as any)?.impact,
              relatedParagraphs: (newData as any)?.relatedParagraphs || [],
              status: 'PUBLISHED',
              participants: {
                create: validParticipantIds.map((personId: string) => ({
                  personId,
                })),
              },
            },
          })

          await prisma.reviewItem.update({
            where: { id },
            data: {
              status: 'APPROVED',
              reviewerNotes: notes,
              reviewedBy: adminId,
              reviewedAt: new Date(),
            },
          })
          successCount++
        } else {
          // 其他类型暂时只更新状态
          await prisma.reviewItem.update({
            where: { id },
            data: {
              status: 'APPROVED',
              reviewerNotes: notes,
              reviewedBy: adminId,
              reviewedAt: new Date(),
            },
          })
          successCount++
        }
      } catch (error: any) {
        errorCount++
        errors.push({ id, error: error.message })
      }
    }

    res.json({
      success: true,
      successCount,
      errorCount,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error('Batch approve error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量拒绝
router.post('/batch-reject', requireAuth, async (req, res) => {
  try {
    const { ids, notes } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    const result = await prisma.reviewItem.updateMany({
      where: {
        id: { in: ids },
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        reviewerNotes: notes,
        reviewedBy: req.session!.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Batch reject error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量操作（保留向后兼容，内部调用批量通过/拒绝接口）
router.post('/items/batch', requireAuth, async (req, res) => {
  try {
    const { ids, action, notes } = req.body // action: 'approve' | 'reject' | 'delete'

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    if (action === 'approve') {
      // 调用批量通过逻辑（复用代码）
      const adminId = req.session!.adminId
      const merger = new LLMMerger()
      let successCount = 0
      let errorCount = 0
      const errors: any[] = []

      for (const id of ids) {
        try {
          const item = await prisma.reviewItem.findUnique({
            where: { id },
          })

          if (!item || item.status !== 'PENDING') {
            errorCount++
            continue
          }

          const newData = item.modifiedData || item.originalData

          if (item.type === 'PERSON') {
            const duplicateCheck = (newData as any)?._duplicateCheck
            let targetPersonId = duplicateCheck?.matchingPersonId

            if (targetPersonId) {
              const targetPerson = await prisma.person.findUnique({
                where: { id: targetPersonId },
              })

              if (targetPerson) {
                const mergeResult = await merger.mergePerson(targetPerson, newData)

                if (mergeResult.shouldMerge && mergeResult.confidence >= 0.7) {
                  const mergedData = { ...mergeResult.mergedData }
                  if (mergedData.role) {
                    mergedData.role = mapRole(mergedData.role as string)
                  }
                  if (mergedData.faction) {
                    mergedData.faction = mapFaction(mergedData.faction as string)
                  }

                  const previousData = JSON.parse(JSON.stringify(targetPerson))
                  const updatedPerson = await prisma.person.update({
                    where: { id: targetPersonId },
                    data: {
                      ...mergedData as any,
                      status: 'PUBLISHED',
                    },
                  })

                  await logChange({
                    entityType: 'PERSON',
                    entityId: targetPersonId,
                    action: 'MERGE',
                    previousData,
                    currentData: updatedPerson,
                    changes: mergeResult.changes,
                    changedBy: adminId,
                    changeReason: notes || mergeResult.reason,
                    mergedFrom: [item.id],
                  })

                  await prisma.reviewItem.update({
                    where: { id },
                    data: {
                      status: 'APPROVED',
                      reviewerNotes: notes || `已通过 LLM 融合到: ${targetPerson.name}`,
                      reviewedBy: adminId,
                      reviewedAt: new Date(),
                    },
                  })

                  successCount++
                  continue
                }
              }
            }

            const mappedRole = mapRole(newData.role)
            const mappedFaction = mapFaction(newData.faction)

            const newPerson = await prisma.person.create({
              data: {
                name: newData.name,
                aliases: newData.aliases || [],
                role: mappedRole,
                faction: mappedFaction,
                birthYear: newData.birthYear,
                deathYear: newData.deathYear,
                activePeriodStart: newData.activePeriod?.start,
                activePeriodEnd: newData.activePeriod?.end,
                biography: newData.biography,
                keyEvents: newData.keyEvents || [],
                portraitUrl: newData.portraitUrl,
                firstAppearanceChapterId: newData.firstAppearance?.chapterId,
                firstAppearanceParagraphId: newData.firstAppearance?.paragraphId,
                status: 'PUBLISHED',
              },
            })

            await logChange({
              entityType: 'PERSON',
              entityId: newPerson.id,
              action: 'CREATE',
              currentData: newPerson,
              changedBy: adminId,
              changeReason: notes || '从 ReviewItem 批量创建',
            })

            await prisma.reviewItem.update({
              where: { id },
              data: {
                status: 'APPROVED',
                reviewerNotes: notes,
                reviewedBy: adminId,
                reviewedAt: new Date(),
              },
            })

            successCount++
          } else if (item.type === 'EVENT') {
            const eventType = mapEventType((newData as any)?.type)
            const timeRange = (newData as any)?.timeRange || (newData as any)?.timeRangeStart
            const timeRangeStart =
              typeof timeRange === 'object' ? timeRange.start : (newData as any)?.timeRangeStart
            const timeRangeEnd =
              typeof timeRange === 'object' ? timeRange.end : (newData as any)?.timeRangeEnd
            const timeRangeLunarRaw =
              typeof timeRange === 'object'
                ? timeRange.lunarCalendar ?? (timeRange as any)?.lunar ?? null
                : (newData as any)?.timeRangeLunar ?? null
            const timeRangeLunar =
              typeof timeRangeLunarRaw === 'boolean'
                ? String(timeRangeLunarRaw)
                : timeRangeLunarRaw

            let locationId = (newData as any)?.locationId || null
            if (locationId) {
              const exists = await prisma.place.findUnique({ where: { id: locationId } })
              if (!exists) {
                locationId = null
              }
            }

            const participantIds = Array.isArray((newData as any)?.participants)
              ? (newData as any)?.participants
              : []
            const existingParticipants = await prisma.person.findMany({
              where: { id: { in: participantIds } },
              select: { id: true },
            })
            const validParticipantIds = existingParticipants.map((p) => p.id)

            await prisma.event.create({
              data: {
                name: (newData as any)?.name,
                timeRangeStart: timeRangeStart,
                timeRangeEnd: timeRangeEnd,
                timeRangeLunar: timeRangeLunar as any,
                locationId,
                chapterId: (newData as any)?.chapterId || null,
                summary: (newData as any)?.summary || '',
                type: eventType,
                impact: (newData as any)?.impact,
                relatedParagraphs: (newData as any)?.relatedParagraphs || [],
                status: 'PUBLISHED',
                participants: {
                  create: validParticipantIds.map((personId: string) => ({
                    personId,
                  })),
                },
              },
            })

            await prisma.reviewItem.update({
              where: { id },
              data: {
                status: 'APPROVED',
                reviewerNotes: notes,
                reviewedBy: adminId,
                reviewedAt: new Date(),
              },
            })
            successCount++
          } else {
            await prisma.reviewItem.update({
              where: { id },
              data: {
                status: 'APPROVED',
                reviewerNotes: notes,
                reviewedBy: adminId,
                reviewedAt: new Date(),
              },
            })
            successCount++
          }
        } catch (error: any) {
          errorCount++
          errors.push({ id, error: error.message })
        }
      }

      return res.json({
        success: true,
        successCount,
        errorCount,
        errors: errors.slice(0, 10),
      })
    } else if (action === 'reject') {
      const result = await prisma.reviewItem.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'REJECTED',
          reviewerNotes: notes,
          reviewedBy: req.session!.adminId,
          reviewedAt: new Date(),
        },
      })
      return res.json({ success: true, count: result.count })
    } else if (action === 'delete') {
      const result = await prisma.reviewItem.deleteMany({
        where: { id: { in: ids } },
      })
      return res.json({ success: true, count: result.count })
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Batch operation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

