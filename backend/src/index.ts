import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import path from 'path'
import { Pool } from 'pg'

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // 允许 localhost 的所有端口（开发环境）
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true)
    } else {
      // 生产环境可以配置具体的域名
      const allowedOrigins = process.env.FRONTEND_URL?.split(',') || []
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  },
  credentials: true,
}))
app.use(express.json())

// Session 配置 - 使用 PostgreSQL 持久化存储
// 开发环境：7天过期；生产环境：30分钟过期
const isDevelopment = process.env.NODE_ENV !== 'production'
const sessionMaxAge = isDevelopment
  ? 7 * 24 * 60 * 60 * 1000 // 7 天（开发环境）
  : 30 * 60 * 1000 // 30 分钟（生产环境）

// 创建 PostgreSQL 连接池用于 session store
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// 创建 PostgreSQL session store
const PgSession = connectPgSimple(session)
const sessionStore = new PgSession({
  pool: pgPool,
  tableName: 'session', // session 表名
  createTableIfMissing: true, // 如果表不存在则自动创建
})

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dushu-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: sessionMaxAge,
    },
  })
)

// 全局请求日志中间件（用于调试）
app.use((req, res, next) => {
  if (req.path.includes('/extract')) {
    const session = req.session as any
    console.log('========================================')
    console.log('[app] Incoming request:', req.method, req.path)
    console.log('[app] Body:', JSON.stringify(req.body, null, 2))
    console.log('[app] Session:', session?.adminId ? 'authenticated' : 'not authenticated')
    console.log('[app] Timestamp:', new Date().toISOString())
    console.log('========================================')
  }
  next()
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Public routes (for user-facing pages)
import booksRouter from './routes/books'
app.use('/api/books', booksRouter)

import chaptersRouter from './routes/chapters'
app.use('/api/chapters', chaptersRouter)

// Admin routes
import adminRouter from './routes/admin'
app.use('/api/admin', adminRouter)

// Review routes
import reviewRouter from './routes/review'
app.use('/api/admin/review', reviewRouter)

// Import routes
import importRouter from './routes/import'
app.use('/api/admin/import', importRouter)

// Content management routes (admin access, same routers but different paths)
app.use('/api/admin/books', booksRouter)
app.use('/api/admin/chapters', chaptersRouter)

import personsRouter from './routes/persons'
app.use('/api/admin/persons', personsRouter)

import relationshipsRouter from './routes/relationships'
app.use('/api/admin/relationships', relationshipsRouter)

import placesRouter from './routes/places'
app.use('/api/admin/places', placesRouter)

import eventsRouter from './routes/events'
app.use('/api/admin/events', eventsRouter)

// Change log routes
import changelogRouter from './routes/changelog'
app.use('/api/admin/changelog', changelogRouter)

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

