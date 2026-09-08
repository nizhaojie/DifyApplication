<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import {
  assessByFile,
  assessByText,
  fetchProfileDetail,
  fetchProfiles,
  type AssessResult,
  type ProfileRecord,
} from '@/api/profile'

// ---------- 研判工作台 ----------
const activeTab = ref('text')
const inputText = ref('')
const pickedFile = ref<File | null>(null)
const assessing = ref(false)
const result = ref<AssessResult | null>(null)

const RESULT_META: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  matched: { label: '匹配', type: 'success' },
  partial: { label: '部分匹配', type: 'warning' },
  not_matched: { label: '不匹配', type: 'danger' },
}

function resultMeta(v?: string | null) {
  return (v && RESULT_META[v]) || { label: v || '-', type: 'info' as const }
}

function onFileChange(file: { raw?: File }) {
  pickedFile.value = file.raw ?? null
}

async function submitAssess() {
  if (activeTab.value === 'text' && !inputText.value.trim()) {
    ElMessage.warning('请粘贴客户信息文本')
    return
  }
  if (activeTab.value === 'file' && !pickedFile.value) {
    ElMessage.warning('请选择 PDF 简历或 Excel 文件')
    return
  }
  assessing.value = true
  result.value = null
  try {
    result.value =
      activeTab.value === 'text'
        ? await assessByText(inputText.value.trim())
        : await assessByFile(pickedFile.value!)
    ElMessage.success('研判完成')
    loadRecords()
  } catch (e) {
    // http 拦截器已弹错误提示
  } finally {
    assessing.value = false
  }
}

// ---------- 研判记录 ----------
const records = ref<ProfileRecord[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10, match_result: '' })
const loadingRecords = ref(false)

async function loadRecords() {
  loadingRecords.value = true
  try {
    const resp = await fetchProfiles({
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      match_result: query.match_result || undefined,
    })
    records.value = resp.data ?? []
    total.value = resp.total ?? records.value.length
  } finally {
    loadingRecords.value = false
  }
}

// ---------- 详情抽屉 ----------
const detailVisible = ref(false)
const detail = ref<AssessResult | null>(null)
const detailLoading = ref(false)

async function openDetail(row: any) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await fetchProfileDetail(row.id)
  } finally {
    detailLoading.value = false
  }
}

function fmtScore(v?: number | null): string {
  return v == null ? '-' : `${Number(v).toFixed(1)} 分`
}

onMounted(loadRecords)
</script>

<template>
  <div class="profile-page">
    <!-- 研判工作台 -->
    <el-card shadow="never" class="panel">
      <template #header>
        <div class="panel-header">
          <span class="panel-title">客户研判工作台</span>
          <span class="panel-sub">判断客户是否符合「中德精英人才共建计划 / 新加坡国际本硕升学计划」画像并给出专业推荐</span>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="文本输入" name="text">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="6"
            maxlength="8000"
            show-word-limit
            placeholder="粘贴客户信息文本，例如：王某，22岁，大专毕业，家庭年收入30-50万，英语四级，想去新加坡读专升本…"
          />
        </el-tab-pane>
        <el-tab-pane label="文件上传" name="file">
          <el-upload
            drag
            accept=".pdf,.xlsx,.xls"
            :auto-upload="false"
            :limit="1"
            :on-change="onFileChange"
            :on-remove="() => (pickedFile = null)"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">拖拽 PDF 简历 / Excel 到此处，或<em>点击选择</em></div>
            <template #tip>
              <div class="el-upload__tip">支持 PDF 简历与 Excel（首行为表头，一行一个客户）</div>
            </template>
          </el-upload>
        </el-tab-pane>
      </el-tabs>

      <div class="submit-row">
        <el-button type="primary" :loading="assessing" @click="submitAssess">开始研判</el-button>
      </div>

      <!-- 研判结果 -->
      <template v-if="result">
        <el-divider content-position="left">研判结果</el-divider>
        <div class="result-grid">
          <div class="result-item">
            <span class="result-label">客户</span>
            <span>{{ result.customer_name || '（未识别姓名）' }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">匹配结果</span>
            <el-tag :type="resultMeta(result.match_result).type">{{ resultMeta(result.match_result).label }}</el-tag>
          </div>
          <div class="result-item">
            <span class="result-label">匹配产品线</span>
            <span>{{ result.matched_product || '-' }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">匹配度</span>
            <el-progress
              class="score-bar"
              :percentage="Math.min(100, Math.round(result.match_score ?? 0))"
              :status="result.match_result === 'matched' ? 'success' : result.match_result === 'not_matched' ? 'exception' : undefined"
            />
          </div>
        </div>

        <div v-if="result.match_reason" class="reason-block">
          <span class="result-label">研判依据</span>
          <p>{{ result.match_reason }}</p>
        </div>

        <div v-if="result.recommended_programs?.length" class="reason-block">
          <span class="result-label">推荐专业/项目</span>
          <div>
            <el-tag v-for="p in result.recommended_programs" :key="p" class="prog-tag" type="success" effect="plain">
              {{ p }}
            </el-tag>
          </div>
        </div>

        <el-table
          v-if="result.assessments?.length"
          :data="result.assessments"
          size="small"
          border
          class="assess-table"
        >
          <el-table-column prop="product_line" label="产品线" min-width="150" />
          <el-table-column prop="rule_name" label="规则" min-width="150" show-overflow-tooltip />
          <el-table-column label="结果" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="resultMeta(row.match_result).type">{{ resultMeta(row.match_result).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="得分" width="90">
            <template #default="{ row }">{{ fmtScore(row.match_score) }}</template>
          </el-table-column>
          <el-table-column label="命中规则项" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="l in row.matched_labels" :key="l" size="small" class="hit-tag">{{ l }}</el-tag>
              <span v-if="!row.matched_labels?.length" class="muted">无</span>
            </template>
          </el-table-column>
          <el-table-column label="候选专业/项目" min-width="200">
            <template #default="{ row }">
              <div v-for="c in row.candidate_programs" :key="c.category" class="cand-block">
                <span class="cand-cat">{{ c.category }}：</span>{{ c.programs.join('、') }}
              </div>
              <span v-if="!row.candidate_programs?.length" class="muted">无</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <!-- 研判记录 -->
    <el-card shadow="never" class="panel">
      <template #header>
        <div class="panel-header">
          <span class="panel-title">研判记录</span>
          <el-select
            v-model="query.match_result"
            placeholder="全部结果"
            clearable
            style="width: 140px"
            @change="query.page = 1; loadRecords()"
          >
            <el-option label="匹配" value="matched" />
            <el-option label="部分匹配" value="partial" />
            <el-option label="不匹配" value="not_matched" />
          </el-select>
        </div>
      </template>

      <el-table :data="records" v-loading="loadingRecords" size="small" border>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="客户" width="120">
          <template #default="{ row }">{{ row.customer_name || '（未识别）' }}</template>
        </el-table-column>
        <el-table-column label="匹配结果" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="resultMeta(row.match_result).type">{{ resultMeta(row.match_result).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="matched_product" label="匹配产品线" min-width="170" />
        <el-table-column label="匹配度" width="90">
          <template #default="{ row }">{{ fmtScore(row.match_score) }}</template>
        </el-table-column>
        <el-table-column prop="create_time" label="研判时间" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="query.page"
        :page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pager"
        @current-change="loadRecords"
      />
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="研判详情" size="55%">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <div class="result-grid">
            <div class="result-item">
              <span class="result-label">客户</span>
              <span>{{ detail.customer_name || '（未识别）' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">匹配结果</span>
              <el-tag :type="resultMeta(detail.match_result).type">{{ resultMeta(detail.match_result).label }}</el-tag>
            </div>
            <div class="result-item">
              <span class="result-label">匹配产品线</span>
              <span>{{ detail.matched_product || '-' }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">匹配度</span>
              <span>{{ fmtScore(detail.match_score) }}</span>
            </div>
          </div>
          <div v-if="detail.match_reason" class="reason-block">
            <span class="result-label">研判依据</span>
            <p>{{ detail.match_reason }}</p>
          </div>
          <div v-if="detail.recommended_programs?.length" class="reason-block">
            <span class="result-label">推荐专业/项目</span>
            <div>
              <el-tag v-for="p in detail.recommended_programs" :key="p" class="prog-tag" type="success" effect="plain">
                {{ p }}
              </el-tag>
            </div>
          </div>
          <el-divider content-position="left">按当前规则重算的产品线评估</el-divider>
          <el-table :data="detail.assessments" size="small" border>
            <el-table-column prop="product_line" label="产品线" min-width="150" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="resultMeta(row.match_result).type">{{ resultMeta(row.match_result).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="得分" width="90">
              <template #default="{ row }">{{ fmtScore(row.match_score) }}</template>
            </el-table-column>
            <el-table-column label="命中规则项" min-width="200">
              <template #default="{ row }">
                <el-tag v-for="l in row.matched_labels" :key="l" size="small" class="hit-tag">{{ l }}</el-tag>
                <span v-if="!row.matched_labels?.length" class="muted">无</span>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-title {
  font-weight: 600;
}
.panel-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.submit-row {
  margin-top: 12px;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px 24px;
  margin-top: 4px;
}
.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.result-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  flex-shrink: 0;
}
.score-bar {
  flex: 1;
  max-width: 260px;
}
.reason-block {
  margin-top: 14px;
}
.reason-block p {
  margin: 6px 0 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
.prog-tag {
  margin: 0 8px 6px 0;
}
.assess-table {
  margin-top: 14px;
}
.hit-tag {
  margin: 0 6px 4px 0;
}
.cand-block {
  font-size: 12px;
  line-height: 1.6;
}
.cand-cat {
  color: var(--el-text-color-secondary);
}
.muted {
  color: var(--el-text-color-placeholder);
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
