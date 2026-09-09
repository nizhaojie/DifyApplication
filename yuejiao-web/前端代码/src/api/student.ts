import http from './http'

const studentHeaders = { 'X-User-Id': '1' }

export function getStudentOverview() {
  return http.get('/api/v1/student/overview', { headers: studentHeaders })
}

export function sendStudentChat(scene: 'psych' | 'life' | 'program', query: string, conversationId?: string) {
  return http.post(`/api/v1/student/chat/${scene}`, { query, conversation_id: conversationId }, { headers: studentHeaders })
}
