<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import FunnelChart from '@/components/FunnelChart.vue'
import BarList from '@/components/BarList.vue'
import { fetchFunnel, fetchLeads, type LeadItem } from '@/api/enterprise'

const loading = ref(false)
const funnel = ref<Record<string, number>>({})
const leads = ref<LeadItem[]>([])

const funnelItems = computed(() => [
  { label: '新线索', value: funnel.value.new ?? 0, color: '#c41e1e' },
  { label: '跟进中', value: funnel.value.contacting ?? 0, color: '#d95454' },
  { label: '已合格', value: funnel.value.qualified ?? 0, color: '#1d1e1f' },
  { label: '已签约', value: funnel.value.signed ?? 0, color: '#9d1818' },
  { label: '已流失', value: funnel.value.lost ?? 0, color: '#909399' },
])

const countryItems = computed(() => {
  const counts: Record<string, number> = {}
  for (const item of leads.value) {
    const key = item.intended_country || '未填'
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
})

const signedRate = computed(() => {
  const total = leads.value.length
  if (!total) return '0%'
  const signed = leads.value.filter((item) => item.status === 'signed').length
  return `${Math.round((signed / total) * 100)}%`
})

onMounted(async () => {
  loading.value = true
  try {
    const [funnelData, leadData] = await Promise.all([fetchFunnel(), fetchLeads({})])
    funnel.value = funnelData
    leads.value = leadData.items
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section v-loading="loading" class="ent-page">
    <header class="ent-head">
      <div>
        <h1>客户看板</h1>
        <p class="hint">漏斗和意向国家来自当前库里的意向客户。</p>
      </div>
      <div class="stat-row compact">
        <article class="stat-card">
          <small>客户总数</small>
          <strong>{{ leads.length }}</strong>
        </article>
        <article class="stat-card">
          <small>签约占比</small>
          <strong>{{ signedRate }}</strong>
        </article>
      </div>
    </header>

    <div class="chart-row">
      <div class="chart-card">
        <h3>线索漏斗</h3>
        <FunnelChart :items="funnelItems" />
      </div>
      <div class="chart-card">
        <h3>意向国家分布</h3>
        <BarList v-if="countryItems.length" :items="countryItems" />
        <el-empty v-else description="还没有客户意向" :image-size="72" />
      </div>
    </div>

    <div class="chart-card">
      <h3>意向客户</h3>
      <el-table :data="leads" size="small">
        <el-table-column prop="customer_name" label="客户" width="120" />
        <el-table-column prop="contact_info" label="电话" width="140" />
        <el-table-column prop="intended_country" label="意向国家" width="120" />
        <el-table-column prop="education_level" label="学历" width="100" />
        <el-table-column prop="status_text" label="状态" width="100" />
        <el-table-column prop="owner_name" label="负责人" />
      </el-table>
    </div>
  </section>
</template>
