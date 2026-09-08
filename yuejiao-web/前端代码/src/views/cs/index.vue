<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import {
  CircleCheckFilled,
  Delete,
  Document,
  Lightning,
  Promotion,
  Service,
  User,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { csApi } from './api/csApi'
import CitationBadge from './components/CitationBadge.vue'
import CourseCard from './components/CourseCard.vue'
import EventCard from './components/EventCard.vue'
import FaqDrawer from './components/FaqDrawer.vue'
import type { CourseProjectItem, EventLectureItem, UIConversationMessage } from './types/csTypes'

function getCurrentTimeStr(): string {
  const d = new Date()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${mins}`
}

// Session State
const sessionId = ref('')
const visitorName = ref('')
const visitorContact = ref('')
const inputMessage = ref('')
const isSending = ref(false)
const messageListRef = ref<HTMLDivElement | null>(null)
const faqDrawerVisible = ref(false)
const visitorDialogVisible = ref(false)

const visitorForm = reactive({
  name: '',
  contact: '',
})

// Welcome Message
const defaultWelcomeMessage: UIConversationMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content:
    '您好！我是粤教国际官方智能客服顾问「小粤同学」🎓\n\n我可以为您提供：\n• 🇩🇪 德国中德双元制职业教育（免学费+企业每月实训津贴）\n• 🇸🇬 新加坡定向本硕连读（专升本1~1.5年/本升硕1年，带薪实习）\n• 📜 德国/新加坡最新签证、工作签与永居政策解读\n• 💡 对公银行账号、退费政策及36条官方权威FAQ秒回\n• 🎯 个性化课程推荐与近期讲座一键预约席位\n\n请问您目前的学历背景是什么？或者您对哪个国家/项目最感兴趣呢？',
  time: getCurrentTimeStr(),
  intent_name: '官方顾问欢迎',
  intent_code: 'casual_chat',
  tokens_used: 92,
  response_time_ms: 15,
  source_references: ['企业信息.docx', '中德精英人才共建计划.docx'],
}

const messages = ref<UIConversationMessage[]>([])

// Quick Prompt Chips
const quickPrompts = [
  { label: '🇩🇪 德国双元制适合什么学历？', text: '请问中德双元制职业教育的招生学历要求是什么？初中或中专可以报吗？' },
  { label: '🇸🇬 新加坡专升本读几年？', text: '大专学历去新加坡读专升本需要多长时间？受中留服认证吗？' },
  { label: '📅 近期讲座活动有哪些？', text: '请问近期有什么关于德国双元制或新加坡留学的讲座分享会吗？' },
  { label: '🏦 官方对公缴费银行账户', text: '请问公司简称是什么？缴费的对公银行账户信息是多少？' },
  { label: '🎯 高中毕业新加坡本科推荐', text: '我是高中毕业，想去新加坡读本科，预算25万左右，有什么推荐的项目？' },
  { label: '🛂 德国工作签证政策', text: '请问德国双元制毕业后在德国工作签证和永居申请政策是怎样的？' },
]

onMounted(() => {
  initSession()
})

function initSession() {
  const savedId = localStorage.getItem('cs_session_id')
  if (savedId) {
    sessionId.value = savedId
  } else {
    sessionId.value = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    localStorage.setItem('cs_session_id', sessionId.value)
  }

  const savedName = localStorage.getItem('cs_visitor_name')
  if (savedName) {
    visitorName.value = savedName
    visitorForm.name = savedName
  }

  const savedContact = localStorage.getItem('cs_visitor_contact')
  if (savedContact) {
    visitorContact.value = savedContact
    visitorForm.contact = savedContact
  }

  messages.value = [{ ...defaultWelcomeMessage, time: getCurrentTimeStr() }]
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

async function streamTypewriterText(msg: UIConversationMessage, fullText: string) {
  if (!fullText) return
  const chars = Array.from(fullText)
  const step = chars.length > 200 ? 6 : chars.length > 80 ? 3 : 1
  let index = 0

  while (index < chars.length) {
    index = Math.min(index + step, chars.length)
    msg.content = chars.slice(0, index).join('')
    scrollToBottom()
    await new Promise((resolve) => setTimeout(resolve, 14))
  }
}

async function handleSend(textToSend?: string) {
  const content = (textToSend || inputMessage.value).trim()
  if (!content) return
  if (isSending.value) return

  // 1. Append user message
  const userMsg: UIConversationMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    time: getCurrentTimeStr(),
  }
  messages.value.push(userMsg)
  if (!textToSend) {
    inputMessage.value = ''
  }
  scrollToBottom()

  // 2. Append assistant placeholder
  const assistantMsgId = `assistant-${Date.now()}`
  const assistantMsg: UIConversationMessage = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    time: getCurrentTimeStr(),
    loading: true,
  }
  messages.value.push(assistantMsg)
  scrollToBottom()

  isSending.value = true

  try {
    const res = await csApi.sendMessage({
      session_id: sessionId.value,
      message: content,
      visitor_name: visitorName.value || undefined,
      visitor_contact: visitorContact.value || undefined,
    })

    if (res.session_id) {
      sessionId.value = res.session_id
      localStorage.setItem('cs_session_id', res.session_id)
    }

    const target = messages.value.find((m) => m.id === assistantMsgId)
    if (target) {
      target.loading = false
      target.intent_code = res.intent_code
      target.intent_name = res.intent_name
      target.source_references = res.source_references
      target.card_type = res.card_type
      target.card_content = res.card_content
      target.tokens_used = res.tokens_used
      target.response_time_ms = res.response_time_ms

      // Smooth typewriter rendering
      await streamTypewriterText(target, res.reply)
    }
  } catch (err: any) {
    const target = messages.value.find((m) => m.id === assistantMsgId)
    if (target) {
      target.loading = false
      target.content = `抱歉，服务连接异常（${err.message || '请确认后端服务已就绪'}）。您可稍后重试，或点击右上角查看常见问答库。`
      target.intent_name = '异常提示'
      target.intent_code = 'casual_chat'
    }
    ElMessage.error('对话发送失败，请确认后端 API 正常工作')
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

function handleKeyDown(e: KeyboardEvent | Event) {
  const keyEvent = e as KeyboardEvent
  if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
    keyEvent.preventDefault()
    handleSend()
  }
}

function handleSelectFaqQuestion(q: string) {
  handleSend(q)
}

function handleCourseConsult(courseName: string) {
  handleSend(`我想详细了解【${courseName}】的申请门槛、实训补贴与学制周期`)
}

function handleEventRegistered(eventName: string) {
  messages.value.push({
    id: `event-ack-${Date.now()}`,
    role: 'assistant',
    content: `🎉 太棒啦！已为您成功预约讲座【${eventName}】！\n我们的升学规划顾问将提前向您发送参会指南，请保持手机畅通。您还可以继续向我咨询更多项目细节～`,
    time: getCurrentTimeStr(),
    intent_name: '报名确认',
    intent_code: 'event_register',
    tokens_used: 48,
    response_time_ms: 10,
  })
  scrollToBottom()
}

function handleResetSession() {
  ElMessageBox.confirm('确定要重置当前对话记录并开启新会话吗？', '提示', {
    confirmButtonText: '确定重置',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      sessionId.value = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      localStorage.setItem('cs_session_id', sessionId.value)
      messages.value = [{ ...defaultWelcomeMessage, time: getCurrentTimeStr() }]
      ElMessage.success('已开启全新会话！')
    })
    .catch(() => {})
}

function saveVisitorInfo() {
  visitorName.value = visitorForm.name.trim()
  visitorContact.value = visitorForm.contact.trim()
  localStorage.setItem('cs_visitor_name', visitorName.value)
  localStorage.setItem('cs_visitor_contact', visitorContact.value)
  visitorDialogVisible.value = false
  ElMessage.success('访客联系信息已保存！后续咨询将自动为您对接专属顾问')
}

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

function getIntentTagType(intentCode?: string): TagType {
  switch (intentCode) {
    case 'company_inquiry':
      return 'info'
    case 'business_query':
      return 'warning'
    case 'policy_query':
      return 'danger'
    case 'faq':
      return 'success'
    case 'course_recommend':
      return 'danger'
    case 'event_register':
      return 'primary'
    default:
      return 'info'
  }
}
</script>

<template>
  <div class="cs-container">
    <!-- 主界面卡片 -->
    <div class="chat-card">
      <!-- 顶部状态与功能栏 -->
      <div class="chat-header">
        <div class="header-left">
          <div class="avatar-wrap">
            <el-avatar :size="42" class="cs-avatar">
              <el-icon :size="24"><Service /></el-icon>
            </el-avatar>
            <span class="status-dot" title="顾问在线中" />
          </div>
          <div class="cs-info">
            <div class="name-row">
              <span class="cs-name">小粤同学</span>
              <el-tag size="small" effect="dark" class="brand-tag">粤教国际官方</el-tag>
              <el-tag size="small" type="success" effect="plain" class="online-tag">
                AI 顾问在线
              </el-tag>
            </div>
            <div class="cs-subtitle">
              中德双元制 · 新加坡定向升学 · 权威留学政策答疑
            </div>
          </div>
        </div>

        <div class="header-actions">
          <el-button
            size="small"
            class="visitor-btn"
            @click="visitorDialogVisible = true"
          >
            <el-icon><User /></el-icon>
            <span>{{ visitorName ? `访客：${visitorName}` : '登记意向信息' }}</span>
          </el-button>

          <el-button
            type="primary"
            size="small"
            class="faq-btn"
            @click="faqDrawerVisible = true"
          >
            <el-icon><Document /></el-icon>
            <span>高频问答库 (36条)</span>
          </el-button>

          <el-button
            size="small"
            type="danger"
            plain
            class="reset-btn"
            title="开启新会话"
            @click="handleResetSession"
          >
            <el-icon><Delete /></el-icon>
            <span>清空会话</span>
          </el-button>
        </div>
      </div>

      <!-- 消息列表滚动视窗 -->
      <div ref="messageListRef" class="chat-body">
        <!-- 欢迎向导卡片 -->
        <div class="welcome-guide-panel">
          <div class="guide-title">
            <span>✨ 您可以向小粤同学咨询以下热门方向：</span>
          </div>
          <div class="quick-chip-grid">
            <div
              v-for="chip in quickPrompts"
              :key="chip.label"
              class="quick-chip"
              @click="handleSend(chip.text)"
            >
              {{ chip.label }}
            </div>
          </div>
        </div>

        <!-- 消息气泡列表 -->
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-row"
          :class="{ 'is-user': msg.role === 'user', 'is-assistant': msg.role === 'assistant' }"
        >
          <!-- 客服头像 -->
          <div v-if="msg.role === 'assistant'" class="msg-avatar assistant-avatar">
            <el-icon><Service /></el-icon>
          </div>

          <!-- 消息实体 -->
          <div class="msg-bubble-wrap">
            <!-- 助手意图与指标头部 -->
            <div v-if="msg.role === 'assistant'" class="assistant-meta-bar">
              <el-tag
                v-if="msg.intent_name"
                size="small"
                :type="getIntentTagType(msg.intent_code)"
                effect="plain"
                class="intent-badge"
              >
                {{ msg.intent_name }}
              </el-tag>
              <span v-if="msg.response_time_ms" class="metric-text">
                <el-icon><Lightning /></el-icon>
                {{ msg.response_time_ms }}ms
              </span>
              <span v-if="msg.tokens_used" class="metric-text">
                {{ msg.tokens_used }} Tokens
              </span>
              <span class="msg-time">{{ msg.time }}</span>
            </div>

            <!-- 用户端时间提示 -->
            <div v-else class="user-meta-bar">
              <span class="msg-time">{{ msg.time }}</span>
            </div>

            <!-- 消息气泡正文 -->
            <div class="msg-bubble">
              <!-- 加载中动画 -->
              <div v-if="msg.loading" class="typing-indicator">
                <span class="dot" />
                <span class="dot" />
                <span class="dot" />
                <span class="typing-hint">小粤正在检索知识库思考中...</span>
              </div>

              <!-- 文本内容 -->
              <div v-else class="msg-content">
                {{ msg.content }}
              </div>

              <!-- 结构化卡片渲染：课程推荐列表 -->
              <div
                v-if="msg.card_type === 'course_list' && msg.card_content"
                class="card-container"
              >
                <div class="card-section-title">
                  <el-icon><CircleCheckFilled /></el-icon>
                  <span>为您精准匹配到以下优质课程项目：</span>
                </div>
                <CourseCard
                  v-for="course in (msg.card_content.recommended_courses as CourseProjectItem[])"
                  :key="course.id"
                  :course="course"
                  @consult="handleCourseConsult"
                />
              </div>

              <!-- 结构化卡片渲染：讲座活动列表 -->
              <div
                v-if="msg.card_type === 'event_list' && msg.card_content"
                class="card-container"
              >
                <div class="card-section-title">
                  <el-icon><CircleCheckFilled /></el-icon>
                  <span>近期讲座与招生分享会推荐：</span>
                </div>
                <EventCard
                  v-for="evt in (msg.card_content.events as EventLectureItem[])"
                  :key="evt.id"
                  :event="evt"
                  @registered="handleEventRegistered"
                />
              </div>

              <!-- 结构化卡片渲染：报名成功卡片 -->
              <div
                v-if="msg.card_type === 'register_success' && msg.card_content"
                class="register-success-card"
              >
                <div class="success-header">
                  <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
                  <span class="success-title">预约登记成功！</span>
                </div>
                <div class="success-detail">
                  <div><strong>活动名称：</strong>{{ msg.card_content.event_name }}</div>
                  <div><strong>报名编号：</strong>#REG-{{ msg.card_content.registration_id }}</div>
                  <div class="success-notice">
                    讲座开场前顾问老师将通过电话/短信发送入场会议号及校区导航。
                  </div>
                </div>
              </div>

              <!-- 知识库来源引用 -->
              <div
                v-if="msg.source_references && msg.source_references.length > 0"
                class="citations-wrapper"
              >
                <div class="citation-label">权威依据与参考来源：</div>
                <CitationBadge
                  v-for="src in msg.source_references"
                  :key="src"
                  :source="src"
                />
              </div>
            </div>
          </div>

          <!-- 用户头像 -->
          <div v-if="msg.role === 'user'" class="msg-avatar user-avatar">
            <el-icon><User /></el-icon>
          </div>
        </div>
      </div>

      <!-- 底部输入操作区 -->
      <div class="chat-footer">
        <!-- 快捷问答提示标签行 -->
        <div class="prompt-pills-row">
          <span class="pills-label">猜你想问：</span>
          <div class="pills-scroll">
            <el-tag
              size="small"
              class="prompt-pill"
              @click="handleSend('请问德国双元制每月补贴津贴有多少欧元？')"
            >
              德国双元制津贴
            </el-tag>
            <el-tag
              size="small"
              class="prompt-pill"
              @click="handleSend('新加坡专升本受中国教育部留学服务中心学历认证吗？')"
            >
              中留服学历认证
            </el-tag>
            <el-tag
              size="small"
              class="prompt-pill"
              @click="handleSend('请问公司的对公转账银行账号和开户行是什么？')"
            >
              对公账户账号
            </el-tag>
            <el-tag
              size="small"
              class="prompt-pill"
              @click="handleSend('我想报名近期的留学宣讲会')"
            >
              我要报名宣讲会
            </el-tag>
            <el-tag
              size="small"
              class="prompt-pill"
              @click="handleSend('初中学历可以报德国双元制预科或者国内工学交替班吗？')"
            >
              初中学历升学路径
            </el-tag>
          </div>
        </div>

        <!-- 输入文本框与发送按钮 -->
        <div class="input-area-wrap">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="输入您关心的升学问题，或咨询中德双元制与近期讲座... (Enter 发送，Shift+Enter 换行)"
            class="chat-textarea"
            :disabled="isSending"
            @keydown="handleKeyDown"
          />
          <div class="send-action-bar">
            <span class="input-hint">Enter 发送 / Shift+Enter 换行</span>
            <el-button
              type="primary"
              class="send-btn"
              :loading="isSending"
              :disabled="!inputMessage.trim() || isSending"
              @click="() => handleSend()"
            >
              <el-icon><Promotion /></el-icon>
              <span>发送咨询</span>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- FAQ 抽屉 -->
    <FaqDrawer
      v-model="faqDrawerVisible"
      @select-question="handleSelectFaqQuestion"
    />

    <!-- 访客意向登记弹窗 -->
    <el-dialog
      v-model="visitorDialogVisible"
      title="登记您的留学/升学咨询意向"
      width="420px"
      destroy-on-close
      append-to-body
    >
      <div class="dialog-tips">
        填写您的联系方式，我们将为您指派专属顾问老师提供 1v1 免费规划方案：
      </div>
      <el-form label-position="top">
        <el-form-item label="您的姓名">
          <el-input v-model="visitorForm.name" placeholder="例如：张同学 / 李家长" />
        </el-form-item>
        <el-form-item label="联系电话 / 微信">
          <el-input v-model="visitorForm.contact" placeholder="用于顾问老师回访与方案发送" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visitorDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveVisitorInfo">确认保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cs-container {
  height: calc(100vh - 130px);
  min-height: 600px;
  display: flex;
  flex-direction: column;
}

.chat-card {
  flex: 1;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 12px rgba(0, 21, 41, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部 Header */
.chat-header {
  height: 68px;
  border-bottom: 1px solid #ebeef5;
  background: #ffffff;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-wrap {
  position: relative;
}

.cs-avatar {
  background: linear-gradient(135deg, #c41e1e, #e24b4b);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(196, 30, 30, 0.25);
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background: #67c23a;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.cs-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cs-name {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.brand-tag {
  background: #c41e1e;
  border-color: #c41e1e;
  font-size: 11px;
}

.online-tag {
  font-size: 11px;
}

.cs-subtitle {
  font-size: 12px;
  color: #909399;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.faq-btn {
  background: #c41e1e;
  border-color: #c41e1e;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.faq-btn:hover {
  background: #d95454;
  border-color: #d95454;
}

.visitor-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 消息滚动区 */
.chat-body {
  flex: 1;
  background: #f8fafc;
  padding: 18px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 欢迎向导卡片 */
.welcome-guide-panel {
  background: #ffffff;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 6px;
}

.guide-title {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  margin-bottom: 8px;
}

.quick-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-chip {
  background: #f4f6f8;
  border: 1px solid #e1e4e8;
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  color: #409eff;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.quick-chip:hover {
  background: #ecf5ff;
  border-color: #b3d8ff;
  transform: translateY(-1px);
}

/* 消息行 */
.message-row {
  display: flex;
  gap: 12px;
  max-width: 86%;
}

.message-row.is-user {
  align-self: flex-end;
  flex-direction: row;
}

.message-row.is-assistant {
  align-self: flex-start;
}

.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

.assistant-avatar {
  background: linear-gradient(135deg, #c41e1e, #e24b4b);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(196, 30, 30, 0.2);
}

.user-avatar {
  background: #303133;
  color: #ffffff;
}

.msg-bubble-wrap {
  display: flex;
  flex-direction: column;
}

.assistant-meta-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.intent-badge {
  font-size: 11px;
  height: 20px;
  line-height: 18px;
}

.metric-text {
  font-size: 11px;
  color: #909399;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.msg-time {
  font-size: 11px;
  color: #c0c4cc;
}

.user-meta-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

/* 气泡样式 */
.msg-bubble {
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  position: relative;
}

.is-assistant .msg-bubble {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  color: #303133;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.is-user .msg-bubble {
  background: #c41e1e;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(196, 30, 30, 0.2);
}

.msg-content {
  white-space: pre-wrap;
}

/* 加载动画 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
}

.typing-indicator .dot {
  width: 6px;
  height: 6px;
  background: #c41e1e;
  border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out;
}

.typing-indicator .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator .dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 业务卡片外壳 */
.card-container {
  margin-top: 12px;
  border-top: 1px dashed #ebeef5;
  padding-top: 10px;
}

.card-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.card-section-title .el-icon {
  color: #67c23a;
}

/* 报名成功卡片 */
.register-success-card {
  margin-top: 12px;
  background: #f0f9eb;
  border: 1px solid #c2e7b0;
  border-radius: 6px;
  padding: 12px 16px;
}

.success-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.success-icon {
  color: #67c23a;
  font-size: 18px;
}

.success-title {
  font-size: 14px;
  font-weight: 600;
  color: #67c23a;
}

.success-detail {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.success-notice {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

/* 来源引用区 */
.citations-wrapper {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
}

.citation-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

/* 底部输入区 */
.chat-footer {
  border-top: 1px solid #ebeef5;
  background: #ffffff;
  padding: 12px 20px 16px;
  flex-shrink: 0;
}

.prompt-pills-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}

.pills-label {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.pills-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.prompt-pill {
  cursor: pointer;
  user-select: none;
  border-color: #f2b8b8;
  color: #c41e1e;
  background-color: #fdecec;
  transition: all 0.2s ease;
}

.prompt-pill:hover {
  background-color: #fbdada;
  transform: translateY(-1px);
}

.input-area-wrap {
  position: relative;
}

.chat-textarea :deep(.el-textarea__inner) {
  padding-bottom: 38px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
}

.chat-textarea :deep(.el-textarea__inner:focus) {
  border-color: #c41e1e;
  box-shadow: 0 0 0 1px #c41e1e;
}

.send-action-bar {
  position: absolute;
  right: 12px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-hint {
  font-size: 11px;
  color: #909399;
}

.send-btn {
  background: #c41e1e;
  border-color: #c41e1e;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.send-btn:hover {
  background: #d95454;
  border-color: #d95454;
}

.dialog-tips {
  font-size: 13px;
  color: #606266;
  margin-bottom: 12px;
  background: #f4f6f8;
  padding: 8px 12px;
  border-radius: 4px;
}
</style>
