<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownText from '@/components/MarkdownText.vue'
import { fetchGuideCatalog } from '@/api/enterprise'

const router = useRouter()
const loading = ref(false)
const items = ref<{ title: string; excerpt: string; content?: string }[]>([])

function ask(title: string) {
  void router.push({ path: '/enterprise', query: { q: title } })
}

onMounted(async () => {
  loading.value = true
  try {
    items.value = await fetchGuideCatalog()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section v-loading="loading" class="ent-page">
    <header class="ent-head">
      <div>
        <h1>新人指南</h1>
        <p class="hint">入职办公、IT、楼层设施。展开看全文，或丢给助手追问。</p>
      </div>
      <el-button type="primary" @click="router.push('/enterprise')">去对话里问</el-button>
    </header>

    <el-collapse accordion>
      <el-collapse-item v-for="item in items" :key="item.title" :title="item.title" :name="item.title">
        <MarkdownText :text="item.content || item.excerpt" />
        <el-button size="small" text type="primary" @click="ask(item.title)">问助手</el-button>
      </el-collapse-item>
    </el-collapse>
  </section>
</template>
