export interface DifyChatResult {
  assistant_text: string
  conversation_id: string
}

function read_sse_payload(raw_line: string): Record<string, unknown> | null {
  const trimmed_line = raw_line.trim()
  if (!trimmed_line.startsWith('data:')) return null
  const payload_text = trimmed_line.slice(5).trim()
  if (!payload_text || payload_text === '[DONE]') return null
  try {
    return JSON.parse(payload_text) as Record<string, unknown>
  } catch {
    return null
  }
}

function strip_think_blocks(raw_text: string): string {
  return raw_text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/^[\s\S]*?<\/think>/, '')
    .trim()
}

function cut_runaway_repeat(raw_text: string): { text: string; runaway: boolean } {
  const detectors = [/(\]\)\*\*){2,}/, /([^\s]{1,24})\1{6,}/]
  for (const detector of detectors) {
    const matched = detector.exec(raw_text)
    if (matched && typeof matched.index === 'number') {
      return { text: raw_text.slice(0, matched.index).trim(), runaway: true }
    }
  }
  return { text: raw_text, runaway: false }
}

function merge_stream_text(current_text: string, incoming_text: string): string {
  if (!incoming_text) return current_text
  if (!current_text) return incoming_text
  if (incoming_text.startsWith(current_text)) return incoming_text
  if (current_text.startsWith(incoming_text)) return current_text
  return current_text + incoming_text
}

function extract_answer_chunk(payload: Record<string, unknown>): string {
  const event_name = String(payload.event ?? '')
  if (event_name === 'message' || event_name === 'agent_message') {
    return typeof payload.answer === 'string' ? payload.answer : ''
  }
  if (event_name === 'text_chunk') {
    const chunk_data = payload.data
    if (chunk_data && typeof chunk_data === 'object' && 'text' in chunk_data) {
      const text_value = (chunk_data as { text?: unknown }).text
      return typeof text_value === 'string' ? text_value : ''
    }
  }
  return ''
}

export function is_dify_chat_enabled(): boolean {
  return import.meta.env.VITE_CS_USE_DIFY === 'true'
}

function is_stale_conversation_error(error: unknown): boolean {
  const error_text = error instanceof Error ? error.message : String(error)
  return (
    error_text.includes('dify_http_404') ||
    error_text.includes('dify_http_400') ||
    error_text.toLowerCase().includes('conversation')
  )
}

async function request_dify_chat_once(
  user_query: string,
  user_id: string,
  conversation_id: string,
  on_delta?: (chunk_text: string) => void,
): Promise<DifyChatResult> {
  const request_body: Record<string, unknown> = {
    inputs: {},
    query: user_query,
    response_mode: 'streaming',
    user: user_id,
  }
  if (conversation_id) {
    request_body.conversation_id = conversation_id
  }

  const response = await fetch('/dify-api/chat-messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request_body),
  })

  if (!response.ok) {
    throw new Error(`dify_http_${response.status}`)
  }
  if (!response.body) {
    throw new Error('dify_empty_stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let assistant_text = ''
  let resolved_conversation_id = conversation_id
  let line_buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    line_buffer += decoder.decode(value, { stream: true })
    const parts = line_buffer.split('\n')
    line_buffer = parts.pop() ?? ''
    for (const raw_line of parts) {
      const payload = read_sse_payload(raw_line)
      if (!payload) continue
      if (payload.event === 'error') {
        const message = typeof payload.message === 'string' ? payload.message : 'dify_error'
        throw new Error(message)
      }
      if (typeof payload.conversation_id === 'string' && payload.conversation_id) {
        resolved_conversation_id = payload.conversation_id
      }
      const chunk_text = extract_answer_chunk(payload)
      if (chunk_text) {
        assistant_text = merge_stream_text(assistant_text, chunk_text)
        const clipped = cut_runaway_repeat(strip_think_blocks(assistant_text))
        if (clipped.text) {
          on_delta?.(clipped.text)
        }
        if (clipped.runaway) {
          assistant_text = clipped.text
          await reader.cancel()
          break
        }
      }
    }
  }

  const cleaned_text = strip_think_blocks(assistant_text)
  if (!cleaned_text) {
    throw new Error('dify_empty_answer')
  }
  return {
    assistant_text: cleaned_text,
    conversation_id: resolved_conversation_id,
  }
}

export async function request_dify_chat(
  user_query: string,
  user_id: string,
  conversation_id: string,
  on_delta?: (chunk_text: string) => void,
): Promise<DifyChatResult> {
  try {
    return await request_dify_chat_once(user_query, user_id, conversation_id, on_delta)
  } catch (error) {
    if (conversation_id && is_stale_conversation_error(error)) {
      return await request_dify_chat_once(user_query, user_id, '', on_delta)
    }
    throw error
  }
}
