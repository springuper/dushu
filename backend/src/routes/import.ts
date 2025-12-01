import express from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

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

    if (!type) {
      return res.status(400).json({ error: '请指定导入类型' })
    }

    // 解析 JSON 文件
    let data: any[]
    try {
      const fileContent = req.file.buffer.toString('utf-8')
      data = JSON.parse(fileContent)
    } catch (error) {
      return res.status(400).json({ error: 'JSON 文件格式错误' })
    }

    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'JSON 文件必须是数组格式' })
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

    // 创建 ReviewItem 记录
    const reviewItems = await Promise.all(
      validItems.map((item) =>
        prisma.reviewItem.create({
          data: {
            type: type.toUpperCase(),
            status: 'PENDING',
            source: 'LLM_EXTRACT',
            originalData: item,
          },
        })
      )
    )

    res.json({
      success: true,
      total: data.length,
      successCount: validItems.length,
      errorCount: errors.length,
      errors: errors.slice(0, 10), // 只返回前 10 个错误
      reviewItems: reviewItems.map((item) => ({
        id: item.id,
        type: item.type,
      })),
    })
  } catch (error) {
    console.error('Batch import error:', error)
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

