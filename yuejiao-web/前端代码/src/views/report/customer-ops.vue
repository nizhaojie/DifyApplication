<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportRecord,
} from '@/api/report'
import { periodRangeLabel, resolveWeekPeriod, shanghaiDate } from './period'

const KIND = 'customer_ops' as const

const STATUS_LABEL: Record<string, string> = {
  new: '新分配',
  contacting: '跟进中',
  qualified: '已合格',
  signed: '已成交',
  lost: '已流失',
}

const weekDate = ref(shanghaiDate())
const isGenerating = ref(false)
const isLoading = ref(false)
const failure = ref('')
const current = ref<ReportRecord | null>(null)
const history = ref<ReportRecord[]>([])

const resolvedPeriod = computed(() => resolveWeekPeriod(weekDate.value))
const periodStart = computed(() => resolvedPeriod.value.start)
const periodLabel = computed(() => periodRangeLabel(resolvedPeriod.value))
const numbers = computed(() => current.value?.content?.numbers as Record<string, any> | undefined)
const insight = computed(() => current.value?.content?.insight as Record<string, string> | undefined)
const intent = computed(() => numbers.value?.intent as Record<string, any> | undefined)
const signed = computed(() => numbers.value?.signed as Record<string, any> | undefined)
const lost = computed(() => numbers.value?.lost as Record<string, any> | undefined)

function statusLabel(status: string) {
  return STATUS_LABEL[status] || status
}

function wowText() {
  const wow = numbers.value?.wow
  if (!wow || wow.label === '样本不足') return '样本不足'
  return `较上期 ${wow.delta}（上期新增意向 ${wow.prior_count}）`
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
        <h1>全域客户经营分析</h1>
        <p>选定周期后手动生成。人数是期末存量，洞察只写分组共性、路径、归因与建议，不改写人数。报告出客户姓名，不跳转详情。</p>
      </div>
      <div class="actions">
        <div class="period-control">
          <span class="period-range">{{ periodLabel }}</span>
          <el-date-picker
            v-model="weekDate"
            class="period-picker"
            type="week"
            :first-day-of-week="1"
            placeholder="选择周期"
            :clearable="false"
            @change="loadCurrent"
          />
        </div>
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
            <h3>总览</h3>
            <p class="lead">意向 {{ numbers?.intent_count ?? 0 }} · 成交 {{ numbers?.signed_count ?? 0 }} · 流失 {{ numbers?.lost_count ?? 0 }}</p>
            <p>新增意向 {{ numbers?.new_intent_count ?? 0 }} 人</p>
            <p>环比：{{ wowText() }}</p>
            <p>同比：{{ numbers?.yoy?.label === '样本不足' ? '样本不足' : numbers?.yoy?.label }}</p>
            <p v-if="insight?.overview_narrative" class="narrative">{{ insight.overview_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>意向</h3>
            <p>新增进入漏斗</p>
            <ul v-if="intent?.new_intent?.length" class="plain">
              <li v-for="(item, index) in intent.new_intent" :key="'new-' + index">
                {{ item.name }} · {{ item.entered_on }}
              </li>
            </ul>
            <p v-else>本周期没有新增意向。</p>
            <p>特征分组</p>
            <p class="sub">意向国家</p>
            <ul v-if="intent?.feature_groups?.intended_country?.length" class="plain">
              <li v-for="item in intent.feature_groups.intended_country" :key="'ic-' + item.name">
                {{ item.name }} {{ item.count }}
              </li>
            </ul>
            <p v-else>暂无意向国家可分组。</p>
            <p class="sub">学历</p>
            <ul v-if="intent?.feature_groups?.education_level?.length" class="plain">
              <li v-for="item in intent.feature_groups.education_level" :key="'ed-' + item.name">
                {{ item.name }} {{ item.count }}
              </li>
            </ul>
            <p v-else>暂无学历可分组。</p>
            <p class="sub">来源渠道</p>
            <ul v-if="intent?.feature_groups?.source_channel?.length" class="plain">
              <li v-for="item in intent.feature_groups.source_channel" :key="'ch-' + item.name">
                {{ item.name }} {{ item.count }}
              </li>
            </ul>
            <p v-else>暂无来源渠道可分组。</p>
            <p>流失预警（跟进停滞满 14 天）</p>
            <ul v-if="intent?.churn_warnings?.length" class="plain">
              <li v-for="(item, index) in intent.churn_warnings" :key="'warn-' + index">
                {{ item.name }} · 最近联系 {{ item.last_contact_on }} · 已停滞 {{ item.stalled_days }} 天
              </li>
            </ul>
            <p v-else>没有跟进停滞满 14 天的意向客户。</p>
            <p v-if="insight?.intent_narrative" class="narrative">{{ insight.intent_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>成交</h3>
            <p>期末存量 {{ numbers?.signed_count ?? 0 }} 人</p>
            <ul v-if="signed?.customers?.length" class="plain">
              <li v-for="(item, index) in signed.customers" :key="'signed-' + index">
                {{ item.name }} · {{ statusLabel(item.status) }}
              </li>
            </ul>
            <p v-else>没有成交客户。</p>
            <p>转化路径</p>
            <ul v-if="signed?.conversion_paths?.length" class="paths">
              <li v-for="(path, index) in signed.conversion_paths" :key="'path-' + index">
                <strong>{{ path.name }} · {{ statusLabel(path.status) }}</strong>
                <ul v-if="path.follow_ups?.length" class="plain nested">
                  <li v-for="(step, stepIndex) in path.follow_ups" :key="stepIndex">
                    {{ step.at }} · {{ step.content }}
                  </li>
                </ul>
                <p v-else class="hint-inline">没有跟进记录，仅有当前状态。</p>
              </li>
            </ul>
            <p>高价值特征</p>
            <p class="sub">意向国家</p>
            <ul v-if="signed?.feature_groups?.intended_country?.length" class="plain">
              <li v-for="item in signed.feature_groups.intended_country" :key="'sic-' + item.name">
                {{ item.name }} {{ item.count }}
              </li>
            </ul>
            <p v-else>成交样本不足以按意向国家归纳。</p>
            <p class="sub">学历</p>
            <ul v-if="signed?.feature_groups?.education_level?.length" class="plain">
              <li v-for="item in signed.feature_groups.education_level" :key="'sed-' + item.name">
                {{ item.name }} {{ item.count }}
              </li>
            </ul>
            <p v-else>成交样本不足以按学历归纳。</p>
            <p class="sub">来源渠道</p>
            <ul v-if="signed?.feature_groups?.source_channel?.length" class="plain">
              <li v-for="item in signed.feature_groups.source_channel" :key="'sch-' + item.name">
                {{ item.name }} {{ item.count }}
              </li>
            </ul>
            <p v-else>成交样本不足以按来源渠道归纳。</p>
            <p v-if="insight?.signed_narrative" class="narrative">{{ insight.signed_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>流失</h3>
            <p>期末存量 {{ numbers?.lost_count ?? 0 }} 人</p>
            <ul v-if="lost?.customers?.length" class="plain">
              <li v-for="(item, index) in lost.customers" :key="'lost-' + index">
                {{ item.name }} · {{ item.lost_reason || '原因未记录' }}
              </li>
            </ul>
            <p v-else>没有流失客户。</p>
            <p v-if="insight?.lost_narrative" class="narrative">{{ insight.lost_narrative }}</p>
          </section>

          <section class="chapter">
            <h3>建议动作</h3>
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
        <p v-if="!history.length" class="hint">还没有已完成的全域客户经营分析。</p>
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

.sub {
  margin: 10px 0 4px;
  color: #606266;
  font-size: 13px;
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

.paths {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.paths > li {
  margin-bottom: 10px;
}

.paths strong {
  font-size: 13px;
}

.nested {
  margin-top: 4px;
  padding-left: 12px;
}

.hint-inline {
  margin: 4px 0 0;
  color: #909399;
  font-size: 12px;
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
