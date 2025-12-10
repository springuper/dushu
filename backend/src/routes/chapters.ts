/**
 * 章节路由（事件中心 MVP 版本）
 */
import express from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { LLMExtractor } from '../lib/llmExtractor'

const router = express.Router()

// 添加路由级别的日志中间件
router.use((req, res, next) => {
  if (req.path.includes('/extract')) {
    console.log('[chapters-router] Request received:', req.method, req.path, 'body:', req.body)
  }
  next()
})

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

// 获取章节列表
router.get('/', async (req, res) => {
  try {
    const { bookId, page = '1', pageSize = '20' } = req.query

    const where: any = {}
    if (bookId) {
      where.bookId = bookId as string
    }

    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [chapters, total] = await Promise.all([
      prisma.chapter.findMany({
        where,
        skip,
        take,
        include: {
          book: {
            select: {
              id: true,
              name: true,
              nameEn: true,
            },
          },
          _count: {
            select: {
              paragraphs: true,
              events: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      }),
      prisma.chapter.count({ where }),
    ])

    res.json({
      items: chapters.map((ch) => ({
        ...ch,
        paragraphCount: ch._count.paragraphs,
        eventCount: ch._count.events,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    })
  } catch (error) {
    console.error('Get chapters error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取章节详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        book: true,
        paragraphs: {
          orderBy: {
            order: 'asc',
          },
          include: {
            annotations: {
              orderBy: {
                position: 'asc',
              },
            },
          },
        },
        events: {
          where: { status: 'PUBLISHED' },
          orderBy: { timeRangeStart: 'asc' },
        },
      },
    })

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' })
    }

    res.json(chapter)
  } catch (error) {
    console.error('Get chapter error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 导入章节（从 JSON 文件）
router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' })
    }

    const { bookId } = req.body

    if (!bookId) {
      return res.status(400).json({ error: '请指定书籍 ID' })
    }

    // 验证书籍是否存在
    const book = await prisma.book.findUnique({
      where: { id: bookId },
    })

    if (!book) {
      return res.status(404).json({ error: '书籍不存在' })
    }

    // 解析 JSON 文件
    let chapterData: any
    try {
      const fileContent = req.file.buffer.toString('utf-8')
      chapterData = JSON.parse(fileContent)
    } catch (error) {
      return res.status(400).json({ error: 'JSON 文件格式错误' })
    }

    // 验证数据格式
    if (!chapterData.title) {
      return res.status(400).json({ error: '缺少必填字段: title' })
    }

    if (!chapterData.paragraphs || !Array.isArray(chapterData.paragraphs)) {
      return res.status(400).json({ error: '缺少必填字段: paragraphs (数组)' })
    }

    // 获取当前书籍的最大 order
    const maxOrderChapter = await prisma.chapter.findFirst({
      where: { bookId },
      orderBy: { order: 'desc' },
    })
    const nextOrder = maxOrderChapter ? maxOrderChapter.order + 1 : 1

    // 创建章节
    const chapter = await prisma.chapter.create({
      data: {
        bookId,
        title: chapterData.title,
        summary: chapterData.summary || chapterData.title,
        order: chapterData.order || nextOrder,
        totalParagraphs: chapterData.paragraphs.length,
        timeRangeStart: chapterData.timeRange?.start || chapterData.source?.timeRangeStart,
        timeRangeEnd: chapterData.timeRange?.end || chapterData.source?.timeRangeEnd,
        sourceUrl: chapterData.source?.url,
      },
    })

    // 创建段落
    const paragraphs = await Promise.all(
      chapterData.paragraphs.map((para: any, index: number) =>
        prisma.paragraph.create({
          data: {
            chapterId: chapter.id,
            order: para.order || index + 1,
            text: para.text,
          },
        })
      )
    )

    // 更新书籍的总章节数
    await prisma.book.update({
      where: { id: bookId },
      data: {
        totalChapters: {
          increment: 1,
        },
      },
    })

    res.json({
      success: true,
      chapter: {
        ...chapter,
        paragraphs,
      },
      paragraphCount: paragraphs.length,
    })
  } catch (error: any) {
    console.error('Import chapter error:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '章节已存在' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建章节（手动）
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.bookId || !data.title) {
      return res.status(400).json({ error: 'bookId and title are required' })
    }

    // 获取当前书籍的最大 order
    const maxOrderChapter = await prisma.chapter.findFirst({
      where: { bookId: data.bookId },
      orderBy: { order: 'desc' },
    })
    const nextOrder = maxOrderChapter ? maxOrderChapter.order + 1 : 1

    const chapter = await prisma.chapter.create({
      data: {
        bookId: data.bookId,
        title: data.title,
        summary: data.summary || data.title,
        order: data.order || nextOrder,
        totalParagraphs: 0,
        timeRangeStart: data.timeRangeStart,
        timeRangeEnd: data.timeRangeEnd,
        sourceUrl: data.sourceUrl,
      },
    })

    // 更新书籍的总章节数
    await prisma.book.update({
      where: { id: data.bookId },
      data: {
        totalChapters: {
          increment: 1,
        },
      },
    })

    res.json(chapter)
  } catch (error: any) {
    console.error('Create chapter error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新章节
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    const chapter = await prisma.chapter.update({
      where: { id },
      data: {
        title: data.title,
        summary: data.summary,
        order: data.order,
        timeRangeStart: data.timeRangeStart,
        timeRangeEnd: data.timeRangeEnd,
        sourceUrl: data.sourceUrl,
      },
    })

    res.json(chapter)
  } catch (error: any) {
    console.error('Update chapter error:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Chapter not found' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除章节
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: { bookId: true },
    })

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' })
    }

    await prisma.chapter.delete({
      where: { id },
    })

    // 更新书籍的总章节数
    await prisma.book.update({
      where: { id: chapter.bookId },
      data: {
        totalChapters: {
          decrement: 1,
        },
      },
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete chapter error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 从章节提取数据（LLM 提取 - 事件中心版本）
router.post('/:id/extract', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    // 获取章节和段落
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        paragraphs: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' })
    }

    const chapterText = chapter.paragraphs.map((p) => p.text).join('\n\n')
    const extractor = new LLMExtractor()

    console.info('[extract] start event-centric extraction', {
      chapterId: id,
      paragraphCount: chapter.paragraphs.length,
      textLength: chapterText.length,
    })

    // 使用新的事件中心提取方法
    const results = await extractor.extract(chapterText, chapter.paragraphs, id)

    // 创建 ReviewItem（只有 EVENT 和 PERSON 两种类型）
    const reviewItems: { event: any[]; person: any[] } = { event: [], person: [] }

    // 创建事件 ReviewItem
    for (const event of results.events) {
      const reviewItem = await prisma.reviewItem.create({
        data: {
          type: 'EVENT',
          status: 'PENDING',
          source: 'LLM_EXTRACT',
          originalData: JSON.parse(JSON.stringify({
            ...event,
            chapterId: id,
          })),
        },
      })
      reviewItems.event.push(reviewItem)
    }

    // 创建人物 ReviewItem
    for (const person of results.persons) {
      const reviewItem = await prisma.reviewItem.create({
        data: {
          type: 'PERSON',
          status: 'PENDING',
          source: 'LLM_EXTRACT',
          originalData: JSON.parse(JSON.stringify({
            ...person,
            chapterId: id,
            sourceChapterIds: [id],
          })),
        },
      })
      reviewItems.person.push(reviewItem)
    }

    console.info('[extract] success', {
      chapterId: id,
      counts: {
        event: reviewItems.event.length,
        person: reviewItems.person.length,
      },
      meta: results.meta,
    })

    res.json({
      success: true,
      results: reviewItems,
      meta: results.meta,
      counts: {
        event: reviewItems.event.length,
        person: reviewItems.person.length,
      },
    })
  } catch (error: any) {
    console.error('[extract] error', {
      message: error?.message,
      stack: error?.stack,
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// 获取章节提取状态
router.get('/:id/extract-status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    const chapter = await prisma.chapter.findUnique({
      where: { id },
    })

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' })
    }

    // 统计该章节相关的 ReviewItem 数量（通过 originalData.chapterId）
    // 由于 Prisma 对 JSON 字段的查询有限制，这里简化处理
    const pendingCounts = {
      event: await prisma.reviewItem.count({
        where: {
          type: 'EVENT',
          status: 'PENDING',
        },
      }),
      person: await prisma.reviewItem.count({
        where: {
          type: 'PERSON',
          status: 'PENDING',
        },
      }),
    }

    // 统计该章节已发布的事件数量
    const publishedEventCount = await prisma.event.count({
      where: {
        chapterId: id,
        status: 'PUBLISHED',
      },
    })

    res.json({
      chapterId: id,
      status: publishedEventCount > 0 ? 'extracted' : 'pending',
      counts: {
        ...pendingCounts,
        publishedEvents: publishedEventCount,
      },
    })
  } catch (error: any) {
    console.error('Get extract status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取章节的事件列表
router.get('/:id/events', async (req, res) => {
  try {
    const { id } = req.params
    const { status = 'PUBLISHED' } = req.query

    const events = await prisma.event.findMany({
      where: {
        chapterId: id,
        status: status as any,
      },
      orderBy: { timeRangeStart: 'asc' },
    })

    res.json(events)
  } catch (error) {
    console.error('Get chapter events error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
