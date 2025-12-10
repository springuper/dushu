import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 支持 session cookie
})

// 添加请求拦截器（用于调试）
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url)
    // 如果是 FormData，删除 Content-Type 头，让浏览器自动设置 multipart/form-data
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// 添加响应拦截器（用于错误处理）
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('Network Error: 无法连接到服务器，请检查后端是否运行')
    } else if (error.response) {
      console.error('API Error:', error.response.status, error.response.data)
    } else {
      console.error('API Error:', error.message)
    }
    return Promise.reject(error)
  }
)

// API 方法
export const healthCheck = async () => {
  const response = await api.get('/api/health')
  return response.data
}

// 获取已发布的书籍列表
export const getPublishedBooks = async () => {
  const response = await api.get('/api/books', {
    params: { status: 'PUBLISHED' },
  })
  return response.data
}

// 根据 ID 获取书籍详情（包含章节列表）
export const getBookById = async (id: string) => {
  const response = await api.get(`/api/books/id/${id}`)
  return response.data
}

// 根据 nameEn 获取书籍详情（包含章节列表）
export const getBookByNameEn = async (nameEn: string) => {
  const response = await api.get(`/api/books/${nameEn}`)
  return response.data
}

// 获取章节详情（包含段落）
export const getChapterById = async (id: string) => {
  const response = await api.get(`/api/chapters/${id}`)
  return response.data
}

