<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { ChatDotRound, Close, Promotion } from '@element-plus/icons-vue'
import { useCsChatStore } from '@/stores/cs_chat'
import { CS_QUICK_QUESTIONS } from '@/stores/cs_quick_questions'

const cs_chat = useCsChatStore()
const draft_text = ref('')
const message_scroller = ref<HTMLElement | null>(null)

async function scroll_to_latest(): Promise<void> {
  await nextTick()
  const scroller = message_scroller.value
  if (!scroller) return
  scroller.scrollTop = scroller.scrollHeight
}

watch(
  () => [cs_chat.is_open, cs_chat.messages.length, cs_chat.is_replying],
  () => {
    void scroll_to_latest()
  },
)

onMounted(() => {
  void scroll_to_latest()
})

async function submit_draft(): Promise<void> {
  const user_text = draft_text.value
  draft_text.value = ''
  await cs_chat.send_user_text(user_text)
}

function submit_quick_question(label: string): void {
  void cs_chat.send_user_text(label)
}
</script>

<template>
  <Teleport to="body">
    <div class="cs-widget">
    <div v-show="cs_chat.is_open" class="cs-panel" role="dialog" aria-label="粤小蜜客服对话">
      <header class="cs-panel-head">
        <div>
          <strong>粤小蜜</strong>
          <span>在线</span>
        </div>
        <el-button text class="cs-close" aria-label="关闭客服窗口" @click="cs_chat.close_panel">
          <el-icon :size="16"><Close /></el-icon>
        </el-button>
      </header>

      <div ref="message_scroller" class="cs-messages">
        <div
          v-for="item in cs_chat.messages"
          :key="item.message_id"
          class="cs-row"
          :class="item.role === 'user' ? 'is-user' : 'is-assistant'"
        >
          <div class="cs-bubble">{{ item.content }}</div>
        </div>
        <div v-if="cs_chat.is_replying" class="cs-row is-assistant">
          <div class="cs-typing">粤小蜜正在输入…</div>
        </div>
        <div v-if="!cs_chat.has_user_message" class="cs-quick">
          <button
            v-for="question in CS_QUICK_QUESTIONS"
            :key="question.question_id"
            type="button"
            class="cs-quick-btn"
            @click="submit_quick_question(question.label)"
          >
            {{ question.label }}
          </button>
        </div>
      </div>

      <form class="cs-composer" @submit.prevent="submit_draft">
        <el-input
          v-model="draft_text"
          type="textarea"
          :rows="2"
          resize="none"
          maxlength="500"
          placeholder="输入想问的事，回车发送"
          :disabled="cs_chat.is_replying"
          @keydown.enter.exact.prevent="submit_draft"
        />
        <el-button
          type="primary"
          :disabled="cs_chat.is_replying || !draft_text.trim()"
          native-type="submit"
        >
          <el-icon><Promotion /></el-icon>
        </el-button>
      </form>
    </div>

    <button
      type="button"
      class="cs-ball"
      :aria-label="cs_chat.is_open ? '收起粤小蜜' : '打开粤小蜜'"
      @click="cs_chat.toggle_panel"
    >
      <el-icon v-if="cs_chat.is_open" :size="22"><Close /></el-icon>
      <el-icon v-else :size="24"><ChatDotRound /></el-icon>
    </button>
  </div>
  </Teleport>
</template>

<style scoped>
.cs-widget {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2000;
}

.cs-ball {
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(196, 30, 30, 0.35);
}

.cs-ball:hover {
  background: var(--el-color-primary-dark-2);
}

.cs-panel {
  position: absolute;
  right: 0;
  bottom: 68px;
  width: 360px;
  height: 520px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 21, 41, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cs-panel-head {
  height: 52px;
  padding: 0 8px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--el-color-primary);
  color: #fff;
}

.cs-panel-head strong {
  font-size: 15px;
  margin-right: 8px;
}

.cs-panel-head span {
  font-size: 12px;
  opacity: 0.85;
}

.cs-close {
  color: #fff;
}

.cs-messages {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  background: #f7f8fa;
}

.cs-row {
  display: flex;
  margin-bottom: 10px;
}

.cs-row.is-user {
  justify-content: flex-end;
}

.cs-bubble {
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.is-assistant .cs-bubble {
  background: #fff;
  border: 1px solid #ebeef5;
  color: #303133;
}

.is-user .cs-bubble {
  background: var(--el-color-primary);
  color: #fff;
}

.cs-typing {
  font-size: 12px;
  color: #909399;
  padding: 4px 8px;
}

.cs-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.cs-quick-btn {
  border: 1px dashed #d3d4d6;
  background: #fff;
  color: #606266;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
}

.cs-quick-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.cs-composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 10px;
  border-top: 1px solid #e4e7ed;
  background: #fff;
}

.cs-composer :deep(.el-textarea__inner) {
  box-shadow: none;
}

@media (max-width: 400px) {
  .cs-widget {
    right: 12px;
    bottom: 12px;
  }

  .cs-panel {
    width: min(360px, calc(100vw - 24px));
    height: min(520px, calc(100vh - 88px));
  }
}
</style>
