/**
 * API client methods for Customer Service (cs) module.
 * Fully decoupled and strictly scoped within CS views.
 */

import type {
  ApiResponse,
  ChatMessageItem,
  ChatRequest,
  ChatResponse,
  CourseRecommendRequest,
  CourseRecommendResponse,
  EventLectureItem,
  EventRegisterRequest,
  EventRegisterResponse,
  FaqItem,
} from '../types/csTypes'

const BASE_URL = '/api/v1/cs'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`)
    }

    const json: ApiResponse<T> = await res.json()
    if (!json.success && json.code !== 200) {
      throw new Error(json.message || '业务请求失败')
    }

    return json.data
  } catch (err: any) {
    console.error(`[csApi] Request failed for ${endpoint}:`, err)
    throw err
  }
}

export const csApi = {
  /**
   * 发送智能客服对话
   */
  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    return request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  /**
   * 获取课程与项目推荐
   */
  async getRecommendations(req: CourseRecommendRequest): Promise<CourseRecommendResponse> {
    return request<CourseRecommendResponse>('/courses/recommend', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  /**
   * 获取热门讲座与沙龙列表
   */
  async getEvents(): Promise<EventLectureItem[]> {
    return request<EventLectureItem[]>('/events', {
      method: 'GET',
    })
  },

  /**
   * 一键预约讲座/沙龙活动
   */
  async registerEvent(req: EventRegisterRequest): Promise<EventRegisterResponse> {
    return request<EventRegisterResponse>('/events/register', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  /**
   * 获取全部常见问题（36条标准FAQ）
   */
  async getFaqs(): Promise<FaqItem[]> {
    return request<FaqItem[]>('/faqs', {
      method: 'GET',
    })
  },

  /**
   * 获取指定会话的历史对话记录
   */
  async getSessionMessages(sessionId: string): Promise<ChatMessageItem[]> {
    return request<ChatMessageItem[]>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'GET',
    })
  },
}
