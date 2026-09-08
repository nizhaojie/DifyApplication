<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { clearMemory, fetchMemory, type MemoryMessage } from '@/api/enterprise'

const router = useRouter()
const loading = ref(false)
const lastPerson = ref<string | null>(null)
const total = ref(0)
const messages = ref<MemoryMessage[]>([])

const recentAsks = computed(() => messages.value.filter((item) => item.role === 'user').slice(-3).reverse())

async function load() {
  loading.value = true
  try {
    const data = await fetchMemory()
    lastPerson.value = data.last_person
    total.value = data.total
    messages.value = data.messages || []
  } finally {
    loading.value = false
  }
}

async function reset() {
  await ElMessageBox.confirm('清空后对话工作台不会再看到刚才的聊天。', '开始新对话', { type: 'warning' })
  await clearMemory()
  ElMessage.success('已清空')
  await load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section v-loading="loading" class="ent-page">
    <header class="ent-head">
      <div>
        <h1>对话记忆</h1>
        <p class="hint">只看摘要。完整对话在工作台。刷新页面也不会丢。</p>
      </div>
      <div class="head-actions">
        <el-button @click="router.push('/enterprise')">回对话</el-button>
        <el-button type="danger" plain :disabled="!total" @click="reset">清空记忆</el-button>
      </div>
    </header>

    <div class="stat-row compact">
      <article class="stat-card">
        <small>最近客户</small>
        <strong>{{ lastPerson || '还没有' }}</strong>
      </article>
      <article class="stat-card">
        <small>已记条数</small>
        <strong>{{ total }}</strong>
      </article>
    </div>

    <div class="chart-card">
      <h3>最近三问</h3>
      <el-empty v-if="!recentAsks.length" description="还没有记忆。去对话工作台说一句就会记下来。" />
      <ol v-else class="ask-list">
        <li v-for="(item, index) in recentAsks" :key="index">
          <small>{{ item.create_time }}</small>
          <p>{{ item.content }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
