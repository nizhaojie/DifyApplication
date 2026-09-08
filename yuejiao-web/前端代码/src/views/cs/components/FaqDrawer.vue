<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChatDotRound, Search } from '@element-plus/icons-vue'
import { csApi } from '../api/csApi'
import type { FaqItem } from '../types/csTypes'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'selectQuestion', question: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('全部')
const faqs = ref<FaqItem[]>([])

const categories = [
  '全部',
  '企业概况与合作背景',
  '德国双元制核心政策',
  '赴德双元制项目详情',
  '新加坡/海外交流项目',
  '国内研学与职业素养培训',
  '报名与咨询流程',
]

onMounted(async () => {
  await loadFaqs()
})

async function loadFaqs() {
  loading.value = true
  try {
    const list = await csApi.getFaqs()
    if (list && list.length) {
      faqs.value = list
    }
  } catch (err) {
    console.error('Failed to load faqs:', err)
  } finally {
    loading.value = false
  }
}

const filteredFaqs = computed(() => {
  let list = faqs.value

  if (selectedCategory.value !== '全部') {
    list = list.filter((item) => item.category === selectedCategory.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.toLowerCase().includes(q)),
    )
  }

  return list
})

function handleAsk(question: string) {
  emit('selectQuestion', question)
  visible.value = false
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="常见咨询问题库 (36条标准FAQ)"
    size="520px"
    direction="rtl"
    destroy-on-close
    class="faq-drawer"
  >
    <div class="faq-container">
      <!-- 搜索栏 -->
      <div class="faq-search-wrap">
        <el-input
          v-model="searchQuery"
          placeholder="搜索政策、专业、费用、签证等关键词..."
          clearable
          :prefix-icon="Search"
        />
      </div>

      <!-- 分类标签切换 -->
      <div class="category-tabs">
        <el-tag
          v-for="cat in categories"
          :key="cat"
          :type="selectedCategory === cat ? 'danger' : 'info'"
          :effect="selectedCategory === cat ? 'dark' : 'plain'"
          class="cat-chip"
          @click="selectedCategory = cat"
        >
          {{ cat }}
        </el-tag>
      </div>

      <!-- 问答列表 -->
      <div v-loading="loading" class="faq-list">
        <div v-if="filteredFaqs.length === 0" class="empty-faq">
          未检索到相关常见问题，您可直接在聊天窗口向客服提问。
        </div>

        <el-collapse v-else accordion class="faq-collapse">
          <el-collapse-item
            v-for="(item, idx) in filteredFaqs"
            :key="item.id || idx"
            :name="idx"
            class="faq-item"
          >
            <template #title>
              <div class="faq-question-title">
                <span class="faq-idx">{{ idx + 1 }}.</span>
                <span class="faq-q-text">{{ item.question }}</span>
              </div>
            </template>

            <div class="faq-answer-wrap">
              <div class="faq-answer-text">{{ item.answer }}</div>
              <div class="faq-action-row">
                <el-button
                  type="primary"
                  link
                  size="small"
                  class="ask-btn"
                  @click.stop="handleAsk(item.question)"
                >
                  <el-icon><ChatDotRound /></el-icon>
                  发送至聊天框详细咨询
                </el-button>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.faq-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.faq-search-wrap {
  margin-bottom: 12px;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.cat-chip {
  cursor: pointer;
  user-select: none;
  font-size: 12px;
}

.faq-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.empty-faq {
  padding: 30px 10px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.faq-question-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 12px;
  line-height: 1.4;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.faq-idx {
  color: var(--el-color-primary, #c41e1e);
  font-weight: 700;
}

.faq-answer-wrap {
  background: #fdfdfd;
  padding: 10px 12px;
  border-radius: 4px;
  border-left: 3px solid var(--el-color-primary, #c41e1e);
}

.faq-answer-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
}

.faq-action-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.ask-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-primary, #c41e1e);
}
</style>
