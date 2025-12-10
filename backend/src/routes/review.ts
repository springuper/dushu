/**
 * 审核路由（事件中心 MVP 版本）
 * 
 * 简化审核流程，只处理 EVENT 和 PERSON 两种类型
 */
import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logChange } from '../lib/changeLog'
import { PersonRole, Faction, EventType, TimePrecision } from '@prisma/client'

const router = express.Router()

// 角色映射
function mapRole(role: string | undefined | null): PersonRole {
  if (!role) return 'OTHER'
  const roleMap: Record<string, PersonRole> = {
    EMPEROR: 'MONARCH',
    EMPRESS: 'MONARCH',
    KING: 'MONARCH',
    WARLORD: 'GENERAL',
    MINISTER: 'ADVISOR',
    GENERAL: 'GENERAL',
    SCHOLAR: 'CIVIL_OFFICIAL',
    MONARCH: 'MONARCH',
    ADVISOR: 'ADVISOR',
    CIVIL_OFFICIAL: 'CIVIL_OFFICIAL',
    MILITARY_OFFICIAL: 'MILITARY_OFFICIAL',
    RELATIVE: 'RELATIVE',
    EUNUCH: 'EUNUCH',
    OTHER: 'OTHER',
  }
  return roleMap[role.toUpperCase()] || 'OTHER'
}

// 阵营映射
function mapFaction(faction: string | undefined | null): Faction {
  if (!faction) return 'OTHER'
  const factionMap: Record<string, Faction> = {
    '汉': 'HAN',
    'HAN': 'HAN',
    '楚': 'CHU',
    'CHU': 'CHU',
    'NEUTRAL': 'NEUTRAL',
    'OTHER': 'OTHER',
  }
  return factionMap[faction] || 'OTHER'
}

// 事件类型映射
function mapEventType(type: string | undefined | null): EventType {
  const normalized = (type || '').toUpperCase()
  const map: Record<string, EventType> = {
    WAR: 'BATTLE',
    BATTLE: 'BATTLE',
    MILITARY: 'BATTLE',
    POLITICS: 'POLITICAL',
    POLITICAL: 'POLITICAL',
    PERSONAL: 'PERSONAL',
  }
  return map[normalized] || 'OTHER'
}

// 时间精度映射
function mapTimePrecision(precision: string | undefined | null): TimePrecision {
  const normalized = (precision || '').toUpperCase()
  const map: Record<string, TimePrecision> = {
    EXACT_DATE: 'EXACT_DATE',
    MONTH: 'MONTH',
    SEASON: 'SEASON',
    YEAR: 'YEAR',
    DECADE: 'DECADE',
    APPROXIMATE: 'APPROXIMATE',
  }
  return map[normalized] || 'YEAR'
}

// 获取 Review 列表
router.get('/items', requireAuth, async (req, res) => {
  try {
    const { type, status, source, search, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (source) where.source = source

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

    res.json(item)
  } catch (error) {
    console.error('Get review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 通过审核
router.post('/items/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body
    
    const item = await prisma.reviewItem.findUnique({
      where: { id },
    })

    if (!item) {
      return res.status(404).json({ error: 'Review item not found' })
    }

    const newData = (item.modifiedData || item.originalData) as any
    const adminId = (req.session as any)?.adminId

    if (item.type === 'PERSON') {
      // 验证必填字段
      if (!newData.name || !newData.name.trim()) {
        return res.status(400).json({ error: '人物姓名不能为空' })
      }
      
      // 为 biography 提供默认值
      const biography = (newData.biography && newData.biography.trim()) 
        ? newData.biography.trim() 
        : `（${newData.name}，暂无详细简介）`
      
      const newPerson = await prisma.person.create({
        data: {
          name: newData.name.trim(),
          aliases: newData.aliases || [],
          role: mapRole(newData.role),
          faction: mapFaction(newData.faction),
          birthYear: newData.birthYear || null,
          deathYear: newData.deathYear || null,
          biography: biography,
          portraitUrl: newData.portraitUrl || null,
          sourceChapterIds: newData.sourceChapterIds || (newData.chapterId ? [newData.chapterId] : []),
          status: 'PUBLISHED',
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
      // 验证必填字段
      if (!newData.name || !newData.name.trim()) {
        return res.status(400).json({ error: '事件名称不能为空' })
      }
      if (!newData.chapterId) {
        return res.status(400).json({ error: '事件必须关联章节' })
      }

      const eventName = newData.name.trim()
      const eventTimeRangeStart = newData.timeRangeStart || '（时间不详）'
      const eventSummary = (newData.summary && newData.summary.trim()) 
        ? newData.summary.trim() 
        : `（${eventName}，暂无详细摘要）`

      const createdEvent = await prisma.event.create({
        data: {
          name: eventName,
          type: mapEventType(newData.type),
          timeRangeStart: eventTimeRangeStart,
          timeRangeEnd: newData.timeRangeEnd || null,
          timePrecision: mapTimePrecision(newData.timePrecision),
          locationName: newData.locationName || null,
          locationModernName: newData.locationModernName || null,
          summary: eventSummary,
          impact: newData.impact || null,
          actors: newData.actors || [],
          chapterId: newData.chapterId,
          relatedParagraphs: newData.relatedParagraphs || [],
          status: 'PUBLISHED',
        },
      })

      // 记录变更日志
      await logChange({
        entityType: 'EVENT',
        entityId: createdEvent.id,
        action: 'CREATE',
        currentData: createdEvent,
        changedBy: adminId,
        changeReason: notes || '从 ReviewItem 创建',
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

    // 未知类型，只更新状态
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
        reviewedBy: (req.session as any)?.adminId,
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
        reviewedBy: (req.session as any)?.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json(item)
  } catch (error) {
    console.error('Update review item error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量通过审核
router.post('/batch-approve', requireAuth, async (req, res) => {
  try {
    const { ids, notes } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    const adminId = (req.session as any)?.adminId
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

        const newData = (item.modifiedData || item.originalData) as any

        if (item.type === 'PERSON') {
          if (!newData.name || !newData.name.trim()) {
            errors.push({ id, error: '人物姓名不能为空' })
            errorCount++
            continue
          }

          const biography = (newData.biography && newData.biography.trim()) 
            ? newData.biography.trim() 
            : `（${newData.name}，暂无详细简介）`

          const newPerson = await prisma.person.create({
            data: {
              name: newData.name.trim(),
              aliases: newData.aliases || [],
              role: mapRole(newData.role),
              faction: mapFaction(newData.faction),
              birthYear: newData.birthYear || null,
              deathYear: newData.deathYear || null,
              biography: biography,
              portraitUrl: newData.portraitUrl || null,
              sourceChapterIds: newData.sourceChapterIds || (newData.chapterId ? [newData.chapterId] : []),
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
          if (!newData.name || !newData.name.trim()) {
            errors.push({ id, error: '事件名称不能为空' })
            errorCount++
            continue
          }
          if (!newData.chapterId) {
            errors.push({ id, error: '事件必须关联章节' })
            errorCount++
            continue
          }

          const eventName = newData.name.trim()
          const eventTimeRangeStart = newData.timeRangeStart || '（时间不详）'
          const eventSummary = (newData.summary && newData.summary.trim()) 
            ? newData.summary.trim() 
            : `（${eventName}，暂无详细摘要）`

          const createdEvent = await prisma.event.create({
            data: {
              name: eventName,
              type: mapEventType(newData.type),
              timeRangeStart: eventTimeRangeStart,
              timeRangeEnd: newData.timeRangeEnd || null,
              timePrecision: mapTimePrecision(newData.timePrecision),
              locationName: newData.locationName || null,
              locationModernName: newData.locationModernName || null,
              summary: eventSummary,
              impact: newData.impact || null,
              actors: newData.actors || [],
              chapterId: newData.chapterId,
              relatedParagraphs: newData.relatedParagraphs || [],
              status: 'PUBLISHED',
            },
          })

          await logChange({
            entityType: 'EVENT',
            entityId: createdEvent.id,
            action: 'CREATE',
            currentData: createdEvent,
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
        } else {
          // 未知类型，只更新状态
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
        reviewedBy: (req.session as any)?.adminId,
        reviewedAt: new Date(),
      },
    })

    res.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Batch reject error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 批量操作（兼容旧接口）
router.post('/items/batch', requireAuth, async (req, res) => {
  try {
    const { ids, action, notes } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids' })
    }

    if (action === 'approve') {
      // 直接调用批量通过逻辑
      const adminId = (req.session as any)?.adminId
      let successCount = 0
      let errorCount = 0
      const errors: any[] = []

      for (const id of ids) {
        try {
          const item = await prisma.reviewItem.findUnique({ where: { id } })
          if (!item || item.status !== 'PENDING') {
            errorCount++
            continue
          }

          const newData = (item.modifiedData || item.originalData) as any

          if (item.type === 'PERSON') {
            if (!newData.name || !newData.name.trim()) {
              errors.push({ id, error: '人物姓名不能为空' })
              errorCount++
              continue
            }

            const biography = (newData.biography && newData.biography.trim()) 
              ? newData.biography.trim() 
              : `（${newData.name}，暂无详细简介）`

            await prisma.person.create({
              data: {
                name: newData.name.trim(),
                aliases: newData.aliases || [],
                role: mapRole(newData.role),
                faction: mapFaction(newData.faction),
                birthYear: newData.birthYear || null,
                deathYear: newData.deathYear || null,
                biography: biography,
                portraitUrl: newData.portraitUrl || null,
                sourceChapterIds: newData.sourceChapterIds || (newData.chapterId ? [newData.chapterId] : []),
                status: 'PUBLISHED',
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
          } else if (item.type === 'EVENT') {
            if (!newData.name || !newData.name.trim()) {
              errors.push({ id, error: '事件名称不能为空' })
              errorCount++
              continue
            }
            if (!newData.chapterId) {
              errors.push({ id, error: '事件必须关联章节' })
              errorCount++
              continue
            }

            await prisma.event.create({
              data: {
                name: newData.name.trim(),
                type: mapEventType(newData.type),
                timeRangeStart: newData.timeRangeStart || '（时间不详）',
                timeRangeEnd: newData.timeRangeEnd || null,
                timePrecision: mapTimePrecision(newData.timePrecision),
                locationName: newData.locationName || null,
                locationModernName: newData.locationModernName || null,
                summary: (newData.summary && newData.summary.trim()) 
                  ? newData.summary.trim() 
                  : `（${newData.name}，暂无详细摘要）`,
                impact: newData.impact || null,
                actors: newData.actors || [],
                chapterId: newData.chapterId,
                relatedParagraphs: newData.relatedParagraphs || [],
                status: 'PUBLISHED',
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
          reviewedBy: (req.session as any)?.adminId,
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
