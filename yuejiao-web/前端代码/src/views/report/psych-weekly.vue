<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportRecord,
} from '@/api/report'

const KIND = 'psych_weekly' as const

const RISK_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

function shanghaiIsoDate(when = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when)
}

function shanghaiDate(when = new Date()) {
  return new Date(`${shanghaiIsoDate(when)}T00:00:00+08:00`)
}

const weekDate = ref(shanghaiDate())
const isGenerating = ref(false)
const isLoading = ref(false)
const failure = ref('')
const current = ref<ReportRecord | null>(null)
const history = ref<ReportRecord[]>([])

const periodStart = computed(() => shanghaiIsoDate(weekDate.value))
const numbers = computed(() => current.value?.content?.numbers as Record<string, any> | undefined)
const insight = computed(() => current.value?.content?.insight as Record<string, string> | undefined)

function riskLabel(level: string) {
  return RISK_LABEL[level] || level
}

async function loadCurrent() {
  isLoading.value = true
  try {
    current.value = await fetchCurrentReport(KIND, periodStart.value)
  } finally {
    isLoading.value = false
  }
}

async function loadHistory() {
  history.value = await fetchReportHistory(KIND)
}

async function onGenerate() {
  isGenerating.value = true
  failure.value = ''
  try {
    const generatedReport = await generateReport(KIND, periodStart.value)
    if (generatedReport.status === 'failed') {
      failure.value = generatedReport.error_message || '生成失败'
    } else {
      ElMessage.success('已生成当前报告')
    }
    await Promise.all([loadCurrent(), loadHistory()])
  } catch (error) {
    failure.value = error instanceof Error ? error.message : '生成失败'
  } finally {
    isGenerating.value = false
  }
}

async function openHistory(item: ReportRecord) {
  weekDate.value = shanghaiDate(new Date(`${item.period_start}T00:00:00+08:00`))
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
        <h1>学生心理健康周报</h1>
        <p>选定周期后手动生成。数字来自心理记录与预警，叙述与疏导建议来自洞察。报告只出姓名，不出原话。</p>
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
        <el-button type="primary" :loading="isGenerating" @click="onGenerate">手动生成</el-button>
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
      <article v-loading="isLoading || isGenerating" class="paper">
        <template v-if="current">
          <header class="paper-head">
            <p class="eyebrow">当前报告</p>
            <h2>{{ current.title }}</h2>
            <p class="period">{{ current.period_start }} 至 {{ current.period_end }}</p>
          </header>

          <section class="chapter">
            <h3>整体态势</h3>
            <p class="lead">本周有心理记录 {{ numbers?.recorded_student_count ?? 0 }} 人</p>
            <p v-if="numbers?.average_emotion_score != null">平均情绪分 {{ numbers.average_emotion_score }}</p>
            <p v-else>暂无情绪分可计。</p>
            <ul v-if="numbers?.emotion_tags?.length" class="plain">
              <li v-for="item in numbers.emotion_tags" :key="item.name">{{ item.name }} {{ item.count }}</li>
            </ul>
            <p v-else>本期无情绪标签可计。</p>
            <p v-if="insight?.overview_narrative" class="narrative">{{ insight.overview_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>本周风险学生</h3>
            <p>本周新建且未解除 {{ numbers?.week_risk_count ?? 0 }} 人</p>
            <ul v-if="numbers?.week_risk_students?.length" class="plain">
              <li v-for="(item, index) in numbers.week_risk_students" :key="index">
                {{ item.student_name }} · {{ riskLabel(item.risk_level) }} · {{ item.emotion_tag || '无标签' }}
              </li>
            </ul>
            <p v-else>本周没有未解除的风险学生。</p>
            <p v-if="insight?.week_risk_narrative" class="narrative">{{ insight.week_risk_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>持续关注</h3>
            <p>画像中/高风险 {{ numbers?.watchlist_count ?? 0 }} 人</p>
            <ul v-if="numbers?.watchlist_students?.length" class="plain">
              <li v-for="(item, index) in numbers.watchlist_students" :key="index">
                {{ item.student_name }} · {{ riskLabel(item.risk_level) }} · {{ item.emotion_tag || '无标签' }}
              </li>
            </ul>
            <p v-else>没有需要持续关注的学生。</p>
            <p v-if="insight?.watchlist_narrative" class="narrative">{{ insight.watchlist_narrative }}</p>
          </section>

          <section v-if="numbers?.approaching_nodes?.length" class="chapter">
            <h3>节点临近</h3>
            <ul class="plain">
              <li v-for="(item, index) in numbers.approaching_nodes" :key="index">
                {{ item.student_name }} · {{ item.title }} · {{ item.deadline }}
              </li>
            </ul>
            <p v-if="insight?.approaching_node_narrative" class="narrative">{{ insight.approaching_node_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>疏导建议</h3>
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
        <p v-if="!history.length" class="hint">还没有已完成的学生心理健康周报。</p>
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
