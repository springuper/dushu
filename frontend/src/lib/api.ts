import axios from 'axios'
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

// 日志工具
const logger = {
  formatDuration: (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  },
  
  info: (message: string, context?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString().substring(11, 23)
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    console.log(`%c[${timestamp}] [api] ${message}${contextStr}`, 'color: #10b981')
  },
  
  warn: (message: string, context?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString().substring(11, 23)
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    console.warn(`[${timestamp}] [api] ${message}${contextStr}`)
  },
  
  error: (message: string, context?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString().substring(11, 23)
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    console.error(`[${timestamp}] [api] ${message}${contextStr}`)
  },
}

// 扩展 AxiosRequestConfig 以包含开始时间
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: number
    requestId: string
  }
}

// 生成简单的请求 ID
const generateRequestId = () => Math.random().toString(36).substring(2, 8)

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 支持 session cookie
})

// 添加请求拦截器（用于调试和计时）
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const extConfig = config as ExtendedAxiosRequestConfig
    const requestId = generateRequestId()
    
    // 记录开始时间
    extConfig.metadata = {
      startTime: Date.now(),
      requestId,
    }
    
    logger.info(`→ ${config.method?.toUpperCase()} ${config.url}`, {
      requestId,
      hasBody: !!config.data,
    })
    
    // 如果是 FormData，删除 Content-Type 头，让浏览器自动设置 multipart/form-data
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    return config
  },
  (error: AxiosError) => {
    logger.error('Request setup error', { error: error.message })
    return Promise.reject(error)
  }
)

// 添加响应拦截器（用于错误处理和计时）
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as ExtendedAxiosRequestConfig
    const duration = config.metadata 
      ? Date.now() - config.metadata.startTime 
      : 0
    
    logger.info(`← ${response.config.method?.toUpperCase()} ${response.config.url} ${response.status}`, {
      requestId: config.metadata?.requestId,
      duration: logger.formatDuration(duration),
      dataSize: JSON.stringify(response.data).length,
    })
    
    return response
  },
  (error: AxiosError) => {
    const config = error.config as ExtendedAxiosRequestConfig | undefined
    const duration = config?.metadata 
      ? Date.now() - config.metadata.startTime 
      : 0
    
    if (error.code === 'ERR_NETWORK') {
      logger.error('Network error - 无法连接到服务器', {
        requestId: config?.metadata?.requestId,
        url: config?.url,
      })
    } else if (error.response) {
      const responseData = error.response.data as { error?: string; message?: string }
      logger.error(`← ${config?.method?.toUpperCase()} ${config?.url} ${error.response.status}`, {
        requestId: config?.metadata?.requestId,
        duration: logger.formatDuration(duration),
        status: error.response.status,
        error: responseData?.error || responseData?.message || error.message,
      })
    } else {
      logger.error('Request failed', {
        requestId: config?.metadata?.requestId,
        error: error.message,
      })
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

// ============================================
// 人物 API
// ============================================

export interface Person {
  id: string
  name: string
  aliases: string[]
  role: 'MONARCH' | 'ADVISOR' | 'GENERAL' | 'CIVIL_OFFICIAL' | 'MILITARY_OFFICIAL' | 'RELATIVE' | 'EUNUCH' | 'OTHER'
  faction: 'HAN' | 'CHU' | 'NEUTRAL' | 'OTHER'
  birthYear?: string
  deathYear?: string
  biography: string
  portraitUrl?: string
  sourceChapterIds: string[]
  status: string
}

export interface PersonsResponse {
  items: Person[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface GetPersonsParams {
  faction?: string
  role?: string
  search?: string
  page?: number
  pageSize?: number
}

// 获取人物列表
export const getPersons = async (params: GetPersonsParams = {}): Promise<PersonsResponse> => {
  const response = await api.get('/api/persons', { params })
  return response.data
}

// 获取人物详情
export const getPersonById = async (id: string, chapterId?: string): Promise<Person & { chapterEvents?: Event[] }> => {
  const response = await api.get(`/api/persons/${id}`, {
    params: chapterId ? { chapterId } : undefined,
  })
  return response.data
}

// 获取人物参与的事件
export const getPersonEvents = async (id: string): Promise<Event[]> => {
  const response = await api.get(`/api/persons/${id}/events`)
  return response.data
}

// 获取某人的所有关系
export const getPersonRelationships = async (id: string, limit: number = 10) => {
  const response = await api.get(`/api/persons/${id}/relationships`, {
    params: { limit },
  })
  return response.data
}

// ============================================
// 事件 API
// ============================================

export interface EventActor {
  personId?: string
  name: string
  roleType: 'PROTAGONIST' | 'ALLY' | 'OPPOSING' | 'ADVISOR' | 'EXECUTOR' | 'OBSERVER' | 'OTHER'
  description?: string
}

export interface Event {
  id: string
  name: string
  type: 'BATTLE' | 'POLITICAL' | 'PERSONAL' | 'OTHER'
  timeRangeStart: string
  timeRangeEnd?: string
  timePrecision: string
  locationName?: string
  locationModernName?: string
  summary: string
  impact?: string
  actors: EventActor[]
  chapterId: string
  relatedParagraphs: string[]
  status: string
  chapter?: {
    id: string
    title: string
    book: {
      id: string
      name: string
    }
  }
}

export interface EventsResponse {
  items: Event[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface GetEventsParams {
  chapterId?: string
  type?: string
  search?: string
  page?: number
  pageSize?: number
}

// 获取事件列表
export const getEvents = async (params: GetEventsParams = {}): Promise<EventsResponse> => {
  const response = await api.get('/api/events', { params })
  return response.data
}

// 获取事件详情
export const getEventById = async (id: string): Promise<Event> => {
  const response = await api.get(`/api/events/${id}`)
  return response.data
}

// 按章节获取事件
export const getEventsByChapter = async (chapterId: string): Promise<Event[]> => {
  const response = await api.get(`/api/events/by-chapter/${chapterId}`)
  return response.data
}

// ============================================
// 关系 API
// ============================================

export interface RelationshipTimeline {
  eventId: string
  eventName: string
  eventType: string
  time: string
  summary: string
  chapter: {
    id: string
    title: string
    book: {
      id: string
      name: string
    }
  }
  personARole?: string
  personADescription?: string
  personBRole?: string
  personBDescription?: string
}

export interface RelationshipResponse {
  personA: Person
  personB: Person
  sharedEventsCount: number
  timeline: RelationshipTimeline[]
}

// 获取两人之间的关系
export const getRelationship = async (personAId: string, personBId: string): Promise<RelationshipResponse> => {
  const response = await api.get('/api/persons/relationships/between', {
    params: { personA: personAId, personB: personBId },
  })
  return response.data
}

// ============================================
// 地点 API
// ============================================

export interface LocationSearchResult {
  id: string
  name: string
  transcription?: string
  modernName?: string
  parentName?: string
  coordinates: {
    lng: number
    lat: number
  }
  timeRange?: {
    begin: string
    end: string
  }
  featureType?: string
}

export interface LocationSearchResponse {
  success: boolean
  data?: LocationSearchResult
  error?: string
}

// 查询地点坐标
export const searchLocation = async (
  name: string,
  year?: string
): Promise<LocationSearchResult> => {
  const params = new URLSearchParams({ name })
  if (year) {
    params.append('year', year)
  }

  const response = await api.get<LocationSearchResponse>(`/api/locations/search?${params.toString()}`)
  
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '未找到地点')
  }

  return response.data.data
}
