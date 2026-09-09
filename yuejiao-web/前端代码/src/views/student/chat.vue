<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChatDotRound, CirclePlus, Delete, Promotion } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type AssistantMode = 'psych' | 'life' | 'program'
type MessageRole = 'assistant' | 'user'

interface ChatMessage { id: number; role: MessageRole; content: string; time: string }
interface ChatSession { id: number; title: string; updatedAt: string; conversationId?: string; messages: ChatMessage[] }

const apiBase = 'http://127.0.0.1:8002/api/v1/student'
const route = useRoute()
const input = ref('')
const sending = ref(false)
const activeSessionId = ref(1)
const scrollArea = ref<HTMLElement>()

const mode = computed<AssistantMode>(() => {
  const value = route.meta.assistantMode
  return value === 'life' || value === 'program' ? value : 'psych'
})

const config = computed(() => ({
  psych: { title: '心理关怀助手', subtitle: '为学生提供支持性回应、情绪陪伴和高风险分流引导。', placeholder: '写下你现在的感受', emptyTitle: '开启新的关怀对话', opening: '你好，我是学生心理关怀助手。你可以放心说说最近的感受或困扰。', quickPrompts: ['最近压力很大，怎么办？', '我总是睡不好。', '我担心申请材料来不及。'] },
  life: { title: '海外生活支持助手', subtitle: '为留学生提供海外医疗、交通、住宿、安全和日常生活支持。', placeholder: '例如：在英国感冒了应该怎么就医？', emptyTitle: '开启新的生活咨询', opening: '你好，我可以协助解答医疗、交通、住宿、安全和日常生活问题。请告诉我所在国家或城市。', quickPrompts: ['在英国感冒了应该怎么就医？', '曼彻斯特如何乘坐公交？', '遇到紧急情况该怎么办？'] },
  program: { title: '学业提升咨询助手', subtitle: '基于增值服务知识库，提供申请规划、科研和语言提升咨询。', placeholder: '例如：我想咨询英国硕博申请规划', emptyTitle: '开启新的项目咨询', opening: '你好，我可以协助梳理申请规划、科研背景、学术英语和学历提升方向。', quickPrompts: ['英国硕博申请要做哪些准备？', '我想提升科研背景。', '学术英语应该如何规划？'] },
}[mode.value]))

function currentTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function newSession(id: number, title: string): ChatSession {
  return { id, title, updatedAt: '刚刚', messages: [] }
}

const sessionsByMode = ref<Record<AssistantMode, ChatSession[]>>({
  psych: [newSession(1, '新的关怀对话')],
  life: [newSession(2, '新的生活咨询')],
  program: [newSession(3, '新的项目咨询')],
})

const sessions = computed(() => sessionsByMode.value[mode.value])
const activeSession = computed(() => sessions.value.find(item => item.id === activeSessionId.value) ?? sessions.value[0])

function selectSession(id: number) {
  activeSessionId.value = id
  void scrollToBottom()
}

function createSession() {
  const id = Date.now()
  sessions.value.unshift(newSession(id, config.value.emptyTitle))
  activeSessionId.value = id
  ensureOpeningMessage()
  void scrollToBottom()
}

function removeSession(id: number) {
  if (sessions.value.length === 1) {
    ElMessage.warning('请至少保留一个会话')
    return
  }
  const index = sessions.value.findIndex(item => item.id === id)
  sessions.value.splice(index, 1)
  if (activeSessionId.value === id) activeSessionId.value = sessions.value[0].id
}

function quickAsk(question: string) {
  input.value = question
  void sendMessage()
}

async function scrollToBottom() {
  await nextTick()
  if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight
}

function ensureOpeningMessage() {
  const session = activeSession.value
  if (session && session.messages.length === 0) {
    session.messages.push({ id: session.id + 1, role: 'assistant', content: config.value.opening, time: currentTime() })
  }
}

async function sendMessage() {
  const content = input.value.trim()
  const session = activeSession.value
  if (!content || !session || sending.value) return

  session.messages.push({ id: Date.now(), role: 'user', content, time: currentTime() })
  session.title = content.slice(0, 18)
  session.updatedAt = '刚刚'
  input.value = ''
  sending.value = true
  void scrollToBottom()

  try {
    const response = await fetch(`${apiBase}/chat/${mode.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': '1' },
      body: JSON.stringify({ query: content, conversation_id: session.conversationId }),
    })
    const payload = await response.json()
    if (!response.ok || payload.code !== 200) throw new Error(payload.detail ?? payload.message ?? 'Dify 调用失败')
    session.conversationId = payload.data.conversation_id ?? session.conversationId
    session.messages.push({ id: Date.now() + 1, role: 'assistant', content: payload.data.answer, time: currentTime() })
  } catch (error) {
    session.messages.push({ id: Date.now() + 1, role: 'assistant', content: '当前无法连接智能助手，请稍后重试或联系服务老师。', time: currentTime() })
    ElMessage.error(error instanceof Error ? error.message : '智能助手连接失败')
  } finally {
    sending.value = false
    void scrollToBottom()
  }
}

watch(mode, () => {
  activeSessionId.value = sessionsByMode.value[mode.value][0].id
  ensureOpeningMessage()
  input.value = ''
  void scrollToBottom()
}, { immediate: true })
</script>

<template>
  <section class="chat-page">
    <header class="chat-heading">
      <div><p>STUDENT AI SERVICE</p><h1>{{ config.title }}</h1></div>
      <el-tag effect="plain" type="info">Dify 已接入</el-tag>
    </header>

    <section class="chat-workspace">
      <aside class="session-sidebar">
        <div class="assistant-identity"><span class="assistant-icon"><el-icon><ChatDotRound /></el-icon></span><strong>{{ config.title }}</strong></div>
        <el-button class="new-chat" plain :icon="CirclePlus" @click="createSession">开启新对话</el-button>
        <div class="session-list">
          <button v-for="item in sessions" :key="item.id" type="button" class="session-item" :class="{ active: item.id === activeSessionId }" @click="selectSession(item.id)">
            <span><strong>{{ item.title }}</strong><small>{{ item.updatedAt }}</small></span>
            <el-icon class="remove-session" @click.stop="removeSession(item.id)"><Delete /></el-icon>
          </button>
        </div>
      </aside>

      <main class="conversation-main">
        <div class="service-note">{{ config.subtitle }}</div>
        <div ref="scrollArea" class="message-area">
          <article v-for="message in activeSession?.messages" :key="message.id" class="message-row" :class="message.role">
            <span v-if="message.role === 'assistant'" class="message-avatar"><el-icon><ChatDotRound /></el-icon></span>
            <div class="message-bubble"><p>{{ message.content }}</p><div v-if="message.role === 'assistant' && message === activeSession?.messages[0]" class="quick-prompts"><button v-for="question in config.quickPrompts" :key="question" type="button" @click="quickAsk(question)">{{ question }}</button></div></div>
          </article>
          <article v-if="sending" class="message-row assistant"><span class="message-avatar"><el-icon><ChatDotRound /></el-icon></span><div class="message-bubble waiting"><p>正在思考...</p></div></article>
        </div>
        <div class="composer"><el-input v-model="input" type="textarea" :rows="3" :placeholder="config.placeholder" resize="none" @keyup.ctrl.enter="sendMessage" /><div><span>Ctrl + Enter 发送</span><el-button type="primary" :icon="Promotion" :loading="sending" @click="sendMessage">发送</el-button></div></div>
      </main>
    </section>
  </section>
</template>

<style scoped>
.chat-page { height: calc(100vh - 160px); min-height: 560px; display: flex; flex-direction: column; }.chat-heading { display: none; }.chat-workspace { min-height: 0; flex: 1; display: grid; grid-template-columns: 220px minmax(0, 1fr); overflow: hidden; border: 1px solid #dfe4ec; border-radius: 14px; background: #f7f8fa; }.session-sidebar { display: flex; min-height: 0; flex-direction: column; padding: 18px 16px; border-right: 1px solid #e1e5ec; background: #eef1f6; }.assistant-identity { display: flex; align-items: center; gap: 10px; color: #1f2937; font-size: 14px; }.assistant-icon, .message-avatar { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; border: 1px solid #bdd9ff; background: #e1f0ff; color: #27a9e8; }.assistant-icon { width: 34px; height: 34px; border-radius: 9px; font-size: 18px; }.new-chat { width: 100%; margin-top: 26px; border: 0; border-radius: 8px; background: #fff; color: #1743ff; box-shadow: 0 1px 3px rgba(38, 49, 70, .12); }.session-list { overflow-y: auto; padding-top: 12px; }.session-item { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 10px 8px; border: 0; border-radius: 6px; background: transparent; color: #4b5563; text-align: left; cursor: pointer; }.session-item:hover, .session-item.active { background: #e1e7f0; }.session-item strong, .session-item small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.session-item strong { max-width: 155px; font-size: 12px; font-weight: 500; }.session-item small { margin-top: 4px; color: #9ca3af; font-size: 11px; }.remove-session { color: #8c96a8; opacity: 0; }.session-item:hover .remove-session { opacity: 1; }.conversation-main { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #fafbfc; }.service-note { align-self: center; width: min(560px, calc(100% - 48px)); margin: 72px 0 20px; padding: 19px 23px; border-radius: 14px; background: #fff; color: #667085; box-shadow: 0 3px 8px rgba(30, 41, 59, .12); font-size: 13px; line-height: 1.5; }.message-area { flex: 1; overflow-y: auto; padding: 120px clamp(24px, 20%, 280px) 124px; }.message-row { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }.message-row.assistant { justify-content: flex-start; }.message-row.user { justify-content: flex-end; }.message-avatar { width: 42px; height: 42px; border-radius: 11px; font-size: 22px; }.message-bubble { max-width: min(650px, 82%); padding: 14px 16px; border-radius: 13px; background: #fff; color: #172033; box-shadow: 0 1px 2px rgba(0, 0, 0, .03); }.message-row.user .message-bubble { background: #dceaff; color: #172033; }.message-bubble p { margin: 0; line-height: 1.75; font-size: 14px; white-space: pre-wrap; }.waiting { color: #667085; }.quick-prompts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }.quick-prompts button { padding: 6px 12px; border: 1px solid #d9e0ea; border-radius: 6px; background: #fff; color: #1743ff; font-size: 12px; cursor: pointer; }.quick-prompts button:hover { border-color: #96b8ff; background: #f3f7ff; }.composer { position: absolute; right: clamp(24px, 20%, 280px); bottom: 20px; left: clamp(24px, 20%, 280px); padding: 12px 16px 14px; border: 1px solid #e2e6ed; border-radius: 13px; background: #fff; box-shadow: 0 2px 8px rgba(30, 41, 59, .08); }.composer > div { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }.composer span { color: #98a2b3; font-size: 11px; }
@media (max-width: 960px) { .chat-workspace { grid-template-columns: 190px minmax(0, 1fr); }.message-area { padding-right: 80px; padding-left: 80px; }.composer { right: 80px; left: 80px; } }
@media (max-width: 680px) { .chat-page { height: calc(100vh - 146px); min-height: 500px; }.chat-workspace { grid-template-columns: 1fr; }.session-sidebar { display: none; }.service-note { margin-top: 30px; }.message-area { padding: 80px 16px 112px; }.composer { right: 16px; bottom: 12px; left: 16px; }.message-bubble { max-width: 86%; } }
</style>
