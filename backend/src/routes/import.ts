/**
 * 导入路由（事件中心 MVP 版本）
 * 
 * 支持批量导入 EVENT 和 PERSON 数据
 */
import express from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { createLogger } from '../lib/logger'

const router = express.Router()
const logger = createLogger('import')

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

    const { type } = req.body // type: 'person' | 'event'
    logger.info('Batch import started', {
      filename: req.file.originalname,
      size: req.file.size,
      type,
    })

    if (!type) {
      return res.status(400).json({ error: '请指定导入类型' })
    }

    // 验证类型（MVP 只支持 person 和 event）
    const validTypes = ['person', 'event']
    if (!validTypes.includes(type.toLowerCase())) {
      return res.status(400).json({ error: `不支持的类型: ${type}。仅支持: ${validTypes.join(', ')}` })
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
    logger.debug('Import validation done', {
      total: data.length,
      valid: validItems.length,
      errors: errors.length,
    })

    // 创建 ReviewItem 记录
    const reviewItems = await Promise.all(
      validItems.map((item) => {
        return prisma.reviewItem.create({
          data: {
            type: type.toUpperCase() as 'EVENT' | 'PERSON',
            status: 'PENDING',
            source: 'LLM_EXTRACT',
            originalData: item,
          },
        })
      })
    )

    logger.info('Batch import completed', {
      total: data.length,
      successCount: validItems.length,
      errorCount: errors.length,
      type,
    })
    
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
  } catch (error: any) {
    logger.error('Batch import error', {
      error: error.message,
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
      // biography 可以为空，会在审核时自动填充默认值
      break

    case 'event':
      if (!item.name || typeof item.name !== 'string') {
        return '缺少必填字段: name'
      }
      if (!item.chapterId) {
        return '缺少必填字段: chapterId'
      }
      // timeRangeStart 可以为空，会在审核时自动填充默认值
      break

    default:
      return `未知的类型: ${type}`
  }

  return null
}

export default router
