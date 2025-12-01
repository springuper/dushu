import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import session from 'express-session'

dotenv.config()

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

// Session 配置
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dushu-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 分钟
    },
  })
)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Admin routes
import adminRouter from './routes/admin'
app.use('/api/admin', adminRouter)

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

