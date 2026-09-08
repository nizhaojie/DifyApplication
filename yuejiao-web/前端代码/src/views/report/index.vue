<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const items = [
  {
    path: '/report/customer-ops',
    title: '全域客户经营分析',
    hint: '意向、成交、流失与跟进停滞。',
  },
  {
    path: '/report/daily-summary',
    title: '员工日报智能汇总',
    hint: '按日或按周汇总提交覆盖与风险。',
  },
  {
    path: '/report/psych-weekly',
    title: '学生心理健康周报',
    hint: '情绪、预警与临近学业节点。',
  },
  {
    path: '/report/complaint-weekly',
    title: '投诉处理周报',
    hint: '工单量、类别、时效与满意度。',
  },
]
</script>

<template>
  <section class="report-hub">
    <h1>智能报告</h1>
    <p class="hint">选一种报告手动生成，生成结果会落库，可回看历史。</p>
    <div class="cards">
      <button
        v-for="item in items"
        :key="item.path"
        class="card"
        type="button"
        @click="router.push(item.path)"
      >
        <strong>{{ item.title }}</strong>
        <span>{{ item.hint }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.report-hub h1 {
  margin: 0;
  font-size: 20px;
}

.hint {
  margin: 8px 0 16px;
  color: #909399;
  font-size: 13px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.card {
  text-align: left;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
  cursor: pointer;
}

.card:hover {
  border-color: #c41e1e;
}

.card strong {
  display: block;
  font-size: 15px;
}

.card span {
  display: block;
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}

@media (max-width: 900px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
