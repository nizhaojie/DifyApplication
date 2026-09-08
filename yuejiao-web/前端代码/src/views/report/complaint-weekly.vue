<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportRecord,
} from '@/api/report'

const KIND = 'complaint_weekly' as const

const weekDate = ref(new Date())
const generating = ref(false)
const loading = ref(false)
const failure = ref('')
const current = ref<ReportRecord | null>(null)
const history = ref<ReportRecord[]>([])

function isoDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const periodStart = computed(() => isoDate(weekDate.value))
const numbers = computed(() => current.value?.content?.numbers as Record<string, any> | undefined)
const insight = computed(() => current.value?.content?.insight as Record<string, string> | undefined)

async function loadCurrent() {
  loading.value = true
  try {
    current.value = await fetchCurrentReport(KIND, periodStart.value)
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  history.value = await fetchReportHistory(KIND)
}

async function onGenerate() {
  generating.value = true
  failure.value = ''
  try {
    const result = await generateReport(KIND, periodStart.value)
    if (result.status === 'failed') {
      failure.value = result.error_message || '生成失败'
    } else {
      ElMessage.success('已生成当前报告')
    }
    await Promise.all([loadCurrent(), loadHistory()])
  } catch (error) {
    failure.value = error instanceof Error ? error.message : '生成失败'
  } finally {
    generating.value = false
  }
}

async function openHistory(item: ReportRecord) {
  weekDate.value = new Date(`${item.period_start}T00:00:00+08:00`)
  failure.value = ''
  await loadCurrent()
}

onMounted(async () => {
  await Promise.all([loadCurrent(), loadHistory()])
})
</script>

<template>
  <section class="report-page">
    <header class="toolbar">
      <div>
        <h1>投诉处理周报</h1>
        <p>选定周期后手动生成。数字来自工单表，叙述与建议来自洞察。</p>
      </div>
      <div class="actions">
        <el-date-picker
          v-model="weekDate"
          type="week"
          format="YYYY 第 ww 周"
          placeholder="选择周期"
          :clearable="false"
          @change="loadCurrent"
        />
        <el-button type="primary" :loading="generating" @click="onGenerate">手动生成</el-button>
      </div>
    </header>

    <el-alert
      v-if="failure"
      class="fail"
      type="error"
      :title="failure"
      :closable="false"
      show-icon
    />

    <div class="workspace">
      <article v-loading="loading || generating" class="paper">
        <template v-if="current">
          <header class="paper-head">
            <p class="eyebrow">当前报告</p>
            <h2>{{ current.title }}</h2>
            <p class="period">{{ current.period_start }} 至 {{ current.period_end }}</p>
          </header>

          <section class="chapter">
            <h3>本期新建总量与环比</h3>
            <p class="lead">本期投诉 {{ numbers?.period_complaint_count ?? 0 }} 件</p>
            <p>环比：{{ numbers?.wow?.label === '样本不足' ? '样本不足' : `较上期 ${numbers?.wow?.delta}（上期 ${numbers?.wow?.prior_count}）` }}</p>
            <p>同比：{{ numbers?.yoy?.label === '样本不足' ? '样本不足' : numbers?.yoy?.label }}</p>
            <p v-if="insight?.volume_narrative" class="narrative">{{ insight.volume_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>分类</h3>
            <ul v-if="numbers?.categories?.length" class="plain">
              <li v-for="item in numbers.categories" :key="item.name">{{ item.name }} {{ item.count }}</li>
            </ul>
            <p v-else>本期无分类可计。</p>
            <p v-if="insight?.category_narrative" class="narrative">{{ insight.category_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>处理状态与时效</h3>
            <p>已解决/已关闭 {{ numbers?.handling?.resolved_or_closed_count ?? 0 }}，未决 {{ numbers?.handling?.open_count ?? 0 }}</p>
            <ul v-if="numbers?.handling?.items?.length" class="plain">
              <li v-for="(item, index) in numbers.handling.items" :key="index">
                {{ item.student_name }} · {{ item.status }} · 已耗时 {{ item.elapsed_days }} 天
              </li>
            </ul>
            <p v-if="insight?.handling_narrative" class="narrative">{{ insight.handling_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>未决预警</h3>
            <ul v-if="numbers?.open_complaints?.length" class="plain">
              <li v-for="(item, index) in numbers.open_complaints" :key="index">
                {{ item.student_name }} · {{ item.category }} · 已耗时 {{ item.elapsed_days }} 天
              </li>
            </ul>
            <p v-else>没有超过 3 天的未决投诉。</p>
            <p v-if="insight?.open_alert_narrative" class="narrative">{{ insight.open_alert_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>满意度</h3>
            <p v-if="numbers?.satisfaction?.label === '暂无评价'">暂无评价</p>
            <p v-else>
              已评价平均 {{ numbers?.satisfaction?.average }} 分；未评价 {{ numbers?.satisfaction?.unrated_count }} 条
            </p>
            <p v-if="insight?.satisfaction_narrative" class="narrative">{{ insight.satisfaction_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>薄弱环节建议</h3>
            <p>{{ insight?.suggested_action }}</p>
          </section>
        </template>
        <el-empty v-else description="这一周期还没有当前报告，选定周期后手动生成。" />
      </article>

      <aside class="history">
        <h2>报告历史</h2>
        <p class="hint">打开同一种类的旧周期</p>
        <button
          v-for="item in history"
          :key="item.id"
          class="history-item"
          :class="{ on: current?.id === item.id }"
          type="button"
          @click="openHistory(item)"
        >
          <strong>{{ item.period_start }} 至 {{ item.period_end }}</strong>
          <span>{{ item.title }}</span>
        </button>
        <p v-if="!history.length" class="hint">还没有已完成的投诉处理周报。</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.report-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 16px 20px;
}

.toolbar h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.toolbar p {
  margin: 6px 0 0;
  color: #909399;
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.fail {
  border-radius: 4px;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  align-items: start;
}

.paper,
.history {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.paper {
  min-height: 520px;
  padding: 28px 32px 40px;
}

.paper-head {
  padding-bottom: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #909399;
}

.paper-head h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.period {
  margin: 8px 0 0;
  color: #606266;
  font-size: 13px;
}

.chapter {
  border-top: 1px solid #e4e7ed;
  padding: 18px 0 8px;
}

.chapter h3 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
}

.lead {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
}

.chapter p {
  margin: 0 0 8px;
  line-height: 1.7;
  color: #303133;
}

.narrative {
  color: #606266;
  font-size: 13px;
}

.plain {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.plain li {
  padding: 6px 0;
  border-bottom: 1px dashed #ebeef5;
  font-size: 13px;
}

.history {
  padding: 16px 14px 20px;
}

.history h2 {
  margin: 0;
  font-size: 15px;
}

.hint {
  margin: 6px 0 12px;
  color: #909399;
  font-size: 12px;
}

.history-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid #e4e7ed;
  background: #fff;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}

.history-item strong,
.history-item span {
  display: block;
}

.history-item strong {
  font-size: 13px;
}

.history-item span {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.history-item.on {
  border-color: #f0b4b4;
  background: #fdecec;
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
