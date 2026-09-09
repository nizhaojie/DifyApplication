<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportKind,
  type ReportRecord,
} from '@/api/report'
import CountChart from './CountChart.vue'
import NameTable from './NameTable.vue'
import { indexReportCharts } from './charts'
import {
  periodRangeLabel,
  resolveDayPeriod,
  resolveWeekPeriod,
  shanghaiDate,
} from './period'

type PeriodGrain = 'week' | 'day'

const periodGrain = ref<PeriodGrain>('week')
const selectedDate = ref(shanghaiDate())
const generating = ref(false)
const loading = ref(false)
const failure = ref('')
const current = ref<ReportRecord | null>(null)
const history = ref<ReportRecord[]>([])

const kind = computed<ReportKind>(() => (periodGrain.value === 'day' ? 'daily_summary' : 'weekly_summary'))
const resolvedPeriod = computed(() =>
  periodGrain.value === 'day'
    ? resolveDayPeriod(selectedDate.value)
    : resolveWeekPeriod(selectedDate.value),
)
const periodStart = computed(() => resolvedPeriod.value.start)
const periodLabel = computed(() => periodRangeLabel(resolvedPeriod.value))
const coverage = computed(() => current.value?.content?.numbers?.coverage as Record<string, any> | undefined)
const insight = computed(() => current.value?.content?.insight as Record<string, string> | undefined)
const submittedNames = computed(() => {
  const rows = coverage.value?.submitted as { name: string }[] | undefined
  if (!rows?.length) return []
  return [...new Set(rows.map((row) => row.name))]
})
const missingRows = computed(() => {
  const rows = coverage.value?.missing as { name: string }[] | undefined
  if (!rows?.length) return []
  return rows.map((row) => ({ name: row.name }))
})
const charts = computed(() => indexReportCharts(kind.value, current.value?.content?.numbers))

async function loadCurrent() {
  loading.value = true
  try {
    current.value = await fetchCurrentReport(kind.value, periodStart.value)
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  const [weekly, daily] = await Promise.all([
    fetchReportHistory('weekly_summary'),
    fetchReportHistory('daily_summary'),
  ])
  history.value = [...weekly, ...daily]
    .filter((item) => Boolean((item.content?.numbers as { coverage?: unknown } | undefined)?.coverage))
    .sort((left, right) => right.id - left.id)
}

async function onGenerate() {
  generating.value = true
  failure.value = ''
  try {
    const result = await generateReport(kind.value, periodStart.value)
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
  periodGrain.value = item.kind === 'daily_summary' ? 'day' : 'week'
  selectedDate.value = shanghaiDate(new Date(`${item.period_start}T00:00:00+08:00`))
  failure.value = ''
  await loadCurrent()
}

watch([kind, periodStart], () => {
  loadCurrent()
})

onMounted(async () => {
  await Promise.all([loadCurrent(), loadHistory()])
})
</script>

<template>
  <section class="report-page">
    <header class="toolbar">
      <div>
        <h1>员工日报智能汇总</h1>
        <p>默认看进行中的本周，可切今日。数字来自日报表，叙述与建议来自洞察。</p>
      </div>
      <div class="actions">
        <el-radio-group v-model="periodGrain" @change="selectedDate = shanghaiDate()">
          <el-radio-button label="week">本周</el-radio-button>
          <el-radio-button label="day">今日</el-radio-button>
        </el-radio-group>
        <div v-if="periodGrain === 'week'" class="period-control">
          <span class="period-range">{{ periodLabel }}</span>
          <el-date-picker
            v-model="selectedDate"
            class="period-picker"
            type="week"
            :first-day-of-week="1"
            placeholder="选择周期"
            :clearable="false"
          />
        </div>
        <el-date-picker
          v-else
          v-model="selectedDate"
          type="date"
          format="YYYY-MM-DD"
          placeholder="选择日期"
          :clearable="false"
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
            <h3>覆盖率</h3>
            <CountChart v-if="charts.coverage" :chart="charts.coverage" />
            <p v-if="missingRows.length">未提交</p>
            <NameTable
              v-if="missingRows.length"
              :columns="[{ key: 'name', label: '姓名' }]"
              :rows="missingRows"
            />
            <p v-else>没有未提交人员。</p>
            <p v-if="insight?.coverage_narrative" class="narrative">{{ insight.coverage_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>核心进展</h3>
            <p v-if="submittedNames.length">{{ submittedNames.join('、') }}</p>
            <p v-else>没有已提交日报可提炼核心进展。</p>
            <p v-if="insight?.progress_narrative" class="narrative">{{ insight.progress_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>关键产出</h3>
            <p v-if="submittedNames.length">{{ submittedNames.join('、') }}</p>
            <p v-else>没有已提交日报可提炼关键产出。</p>
            <p v-if="insight?.output_narrative" class="narrative">{{ insight.output_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>潜在风险</h3>
            <p v-if="submittedNames.length">{{ submittedNames.join('、') }}</p>
            <p v-else>没有已提交日报可识别潜在风险。</p>
            <p v-if="insight?.risk_narrative" class="narrative">{{ insight.risk_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>资源与协调建议</h3>
            <p>{{ insight?.suggested_action }}</p>
          </section>
        </template>
        <el-empty v-else description="这一周期还没有当前报告。默认本周，可切今日后手动生成。" />
      </article>

      <aside class="history">
        <h2>报告历史</h2>
        <p class="hint">打开同一种类的旧周期（日或周）</p>
        <button
          v-for="item in history"
          :key="item.id"
          class="history-item"
          :class="{ on: current?.id === item.id }"
          type="button"
          @click="openHistory(item)"
        >
          <strong>{{ item.period_start }} 至 {{ item.period_end }}</strong>
          <span>{{ item.kind === 'daily_summary' ? '日' : '周' }} · {{ item.title }}</span>
        </button>
        <p v-if="!history.length" class="hint">还没有已完成的员工日报智能汇总。</p>
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

.period-control {
  position: relative;
  min-width: 240px;
  height: 32px;
  overflow: hidden;
}

.period-range {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  color: #606266;
}

.period-control :deep(.el-date-editor) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
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
