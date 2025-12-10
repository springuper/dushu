import express from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { LLMMerger } from '../lib/llmMerger'

const router = express.Router()

// 配置 multer（内存存储，用于 JSON 文件）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true)
    } else {
      cb(new Error('只支持 JSON 文件'))
    }
  },
})

// 批量导入
router.post('/batch', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' })
    }

    const { type, mode = 'new' } = req.body // type: 'person' | 'relationship' | 'place' | 'event'
    console.info('[import] batch start', {
      filename: req.file.originalname,
      size: req.file.size,
      type,
      mode,
    })

    if (!type) {
      return res.status(400).json({ error: '请指定导入类型' })
    }

    // 解析 JSON 文件
    let data: any[]
    try {
      const fileContent = req.file.buffer.toString('utf-8')
      const parsed = JSON.parse(fileContent)
      
      // 支持两种格式：
      // 1. 直接是数组: [...]
      // 2. 包装格式: { data: [...], type: "...", ... }
      if (Array.isArray(parsed)) {
        data = parsed
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
        data = parsed.data
      } else {
        return res.status(400).json({ error: 'JSON 文件必须是数组格式或包含 data 字段的对象' })
      }
    } catch (error) {
      return res.status(400).json({ error: 'JSON 文件格式错误' })
    }

    // 验证数据格式
    const errors: any[] = []
    const validItems: any[] = []

    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const validationError = validateItem(item, type)

      if (validationError) {
        errors.push({
          index: i,
          item,
          error: validationError,
        })
      } else {
        validItems.push(item)
      }
    }
    console.info('[import] validate done', {
      total: data.length,
      valid: validItems.length,
      errors: errors.length,
    })

    // 使用 LLM 检测重复（仅对人物类型）
    let duplicateChecks: any[] = []
    if (type.toLowerCase() === 'person') {
      // 获取所有已审核通过的人物
      const existingPersons = await prisma.person.findMany({
        where: {
          status: {
            in: ['APPROVED', 'PUBLISHED'],
          },
        },
      })

      const merger = new LLMMerger()

      // 检查每个待导入的人物
      duplicateChecks = await Promise.all(
        validItems.map(async (item: any) => {
          // 查找可能的匹配（基于姓名和别名）
          const possibleMatches = existingPersons.filter((p) => {
            const nameMatch = p.name === item.name
            const aliasMatch =
              p.aliases.includes(item.name) ||
              (item.aliases || []).some((alias: string) => p.aliases.includes(alias)) ||
              (item.aliases || []).includes(p.name)
            return nameMatch || aliasMatch
          })

          if (possibleMatches.length === 0) {
            return {
              itemIndex: validItems.indexOf(item),
              isDuplicate: false,
              matchingPersonId: null,
              confidence: 0,
              reasons: [],
            }
          }

          // 对每个可能的匹配，使用 LLM 判断
          let bestMatch: any = null
          let bestConfidence = 0

          for (const existing of possibleMatches) {
            try {
              const mergeResult = await merger.mergePerson(existing, item)
              if (mergeResult.shouldMerge && mergeResult.confidence > bestConfidence) {
                bestConfidence = mergeResult.confidence
                bestMatch = {
                  personId: existing.id,
                  confidence: mergeResult.confidence,
                  reason: mergeResult.reason,
                }
              }
            } catch (error) {
              console.error('LLM 融合检查错误:', error)
            }
          }

          return {
            itemIndex: validItems.indexOf(item),
            isDuplicate: bestMatch !== null && bestConfidence >= 0.5,
            matchingPersonId: bestMatch?.personId || null,
            confidence: bestConfidence,
            reasons: bestMatch ? [bestMatch.reason] : [],
          }
        })
      )
    }

    // 创建 ReviewItem 记录
    const reviewItems = await Promise.all(
      validItems.map((item, index) => {
        const duplicateCheck = duplicateChecks[index]
        return prisma.reviewItem.create({
          data: {
            type: type.toUpperCase(),
            status: 'PENDING',
            source: 'LLM_EXTRACT',
            originalData: item,
            // 如果有匹配的人物，在 originalData 中添加标记
            // 注意：这里我们暂时在 originalData 中添加，后续可以考虑添加数据库字段
          },
        })
      })
    )

    // 为有重复的 ReviewItem 添加标记（通过更新 originalData）
    for (let i = 0; i < reviewItems.length; i++) {
      const duplicateCheck = duplicateChecks[i]
      if (duplicateCheck && duplicateCheck.isDuplicate) {
        const updatedData = {
          ...reviewItems[i].originalData,
          _duplicateCheck: {
            isDuplicate: true,
            matchingPersonId: duplicateCheck.matchingPersonId,
            confidence: duplicateCheck.confidence,
            reasons: duplicateCheck.reasons,
          },
        }
        await prisma.reviewItem.update({
          where: { id: reviewItems[i].id },
          data: { originalData: updatedData },
        })
      }
    }

    // 统计重复数量
    const duplicateCount = duplicateChecks.filter((c) => c?.isDuplicate).length

    console.info('[import] batch success', {
      total: data.length,
      successCount: validItems.length,
      errorCount: errors.length,
      duplicateCount,
    })
    res.json({
      success: true,
      total: data.length,
      successCount: validItems.length,
      errorCount: errors.length,
      duplicateCount,
      errors: errors.slice(0, 10), // 只返回前 10 个错误
      reviewItems: reviewItems.map((item) => ({
        id: item.id,
        type: item.type,
      })),
    })
  } catch (error) {
    console.error('[import] batch error', {
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 验证数据项
function validateItem(item: any, type: string): string | null {
  if (!item || typeof item !== 'object') {
    return '数据项必须是对象'
  }

  switch (type.toLowerCase()) {
    case 'person':
      if (!item.name || typeof item.name !== 'string') {
        return '缺少必填字段: name'
      }
      if (!item.biography || typeof item.biography !== 'string') {
        return '缺少必填字段: biography'
      }
      break

    case 'relationship':
      if (!item.sourceId || !item.targetId) {
        return '缺少必填字段: sourceId 或 targetId'
      }
      if (!item.type) {
        return '缺少必填字段: type'
      }
      break

    case 'place':
      if (!item.name || typeof item.name !== 'string') {
        return '缺少必填字段: name'
      }
      if (!item.coordinates || !item.coordinates.lng || !item.coordinates.lat) {
        return '缺少必填字段: coordinates (lng, lat)'
      }
      break

    case 'event':
      if (!item.name || typeof item.name !== 'string') {
        return '缺少必填字段: name'
      }
      if (!item.timeRange || !item.timeRange.start) {
        return '缺少必填字段: timeRange.start'
      }
      break

    default:
      return `未知的类型: ${type}`
  }

  return null
}

export default router

