import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { createLogger } from '../lib/logger'

const router = express.Router()
const logger = createLogger('books')

// 获取所有书籍
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { nameEn: { contains: search as string, mode: 'insensitive' } },
        { author: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const books = await prisma.book.findMany({
      where,
      include: {
        _count: {
          select: {
            chapters: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json(books.map((book) => ({
      ...book,
      chapterCount: book._count.chapters,
    })))
  } catch (error: any) {
    logger.error('Get books error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 根据 ID 获取书籍（优先匹配，因为 ID 是 UUID 格式）
router.get('/id/:id', async (req, res) => {
  try {
    const { id } = req.params

    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            title: true,
            order: true,
            totalParagraphs: true,
            timeRangeStart: true,
            timeRangeEnd: true,
            sourceUrl: true,
          },
        },
        _count: {
          select: {
            chapters: true,
          },
        },
      },
    })

    if (!book) {
      return res.status(404).json({ error: 'Book not found' })
    }

    res.json({
      ...book,
      chapterCount: book._count.chapters,
    })
  } catch (error: any) {
    logger.error('Get book by id error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 根据 nameEn 获取书籍（用于公开 API）
router.get('/:nameEn', async (req, res) => {
  try {
    const { nameEn } = req.params

    // 如果看起来像 UUID，尝试作为 ID 查询
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameEn)

    const book = await prisma.book.findUnique({
      where: isUUID ? { id: nameEn } : { nameEn },
      include: {
        chapters: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            title: true,
            order: true,
            totalParagraphs: true,
            timeRangeStart: true,
            timeRangeEnd: true,
            sourceUrl: true,
          },
        },
        _count: {
          select: {
            chapters: true,
          },
        },
      },
    })

    if (!book) {
      return res.status(404).json({ error: 'Book not found' })
    }

    res.json({
      ...book,
      chapterCount: book._count.chapters,
    })
  } catch (error: any) {
    logger.error('Get book by nameEn error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 创建书籍
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = req.body

    if (!data.name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    // 如果没有提供 nameEn，从 name 生成（简单处理）
    const nameEn = data.nameEn || data.name.toLowerCase().replace(/\s+/g, '_')

    const book = await prisma.book.create({
      data: {
        name: data.name,
        nameEn,
        author: data.author,
        dynasty: data.dynasty,
        writtenYear: data.writtenYear,
        description: data.description,
        sourceUrl: data.sourceUrl,
        status: data.status || 'DRAFT',
      },
    })

    logger.info('Book created', { bookId: book.id, name: book.name, nameEn: book.nameEn })
    res.json(book)
  } catch (error: any) {
    if (error.code === 'P2002') {
      logger.warn('Book creation failed - duplicate nameEn')
      return res.status(400).json({ error: 'Book with this nameEn already exists' })
    }
    logger.error('Create book error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 更新书籍
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const data = req.body

    const book = await prisma.book.update({
      where: { id },
      data: {
        name: data.name,
        nameEn: data.nameEn,
        author: data.author,
        dynasty: data.dynasty,
        writtenYear: data.writtenYear,
        description: data.description,
        sourceUrl: data.sourceUrl,
        status: data.status,
      },
    })

    logger.info('Book updated', { bookId: id })
    res.json(book)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Book not found' })
    }
    logger.error('Update book error', { bookId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 删除书籍
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.book.delete({
      where: { id },
    })

    logger.info('Book deleted', { bookId: id })
    res.json({ success: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Book not found' })
    }
    logger.error('Delete book error', { bookId: id, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

