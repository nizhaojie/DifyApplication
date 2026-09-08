<script setup lang="ts">
import { computed } from 'vue'
import { ChatLineRound, Timer, UserFilled } from '@element-plus/icons-vue'
import type { CourseProjectItem } from '../types/csTypes'

const props = defineProps<{
  course: CourseProjectItem
}>()

const emit = defineEmits<{
  (e: 'consult', courseName: string): void
}>()

const formattedPrice = computed(() => {
  if (props.course.price === undefined || props.course.price === null) {
    return '详情请咨询'
  }
  if (props.course.price === 0) {
    return '免学费 / 公费培养'
  }
  return `¥ ${props.course.price.toLocaleString()} 起`
})

function handleConsult() {
  emit('consult', props.course.project_name)
}
</script>

<template>
  <div class="course-card">
    <div class="course-header">
      <div class="title-wrap">
        <el-tag size="small" type="danger" effect="dark" class="category-tag">
          {{ course.category || '精选项目' }}
        </el-tag>
        <span class="course-title">{{ course.project_name }}</span>
      </div>
      <div class="price-badge">{{ formattedPrice }}</div>
    </div>

    <div v-if="course.description" class="course-desc">
      {{ course.description }}
    </div>

    <div class="course-meta">
      <div v-if="course.duration" class="meta-item">
        <el-icon><Timer /></el-icon>
        <span>周期：{{ course.duration }}</span>
      </div>
      <div v-if="course.target_audience" class="meta-item">
        <el-icon><UserFilled /></el-icon>
        <span>适合：{{ course.target_audience }}</span>
      </div>
    </div>

    <div v-if="course.tags && course.tags.length" class="tag-row">
      <el-tag
        v-for="tag in course.tags"
        :key="tag"
        size="small"
        effect="plain"
        class="feature-tag"
      >
        {{ tag }}
      </el-tag>
    </div>

    <div class="course-footer">
      <el-button
        type="primary"
        size="small"
        class="consult-btn"
        @click="handleConsult"
      >
        <el-icon><ChatLineRound /></el-icon>
        立即咨询此项目
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.course-card {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-left: 4px solid var(--el-color-primary, #c41e1e);
  border-radius: 6px;
  padding: 14px 16px;
  margin-top: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(196, 30, 30, 0.12);
}

.course-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.category-tag {
  background-color: var(--el-color-primary, #c41e1e);
  border-color: var(--el-color-primary, #c41e1e);
  font-weight: 500;
}

.course-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.price-badge {
  font-size: 14px;
  font-weight: 700;
  color: #e6a23c;
  white-space: nowrap;
}

.course-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 10px;
}

.course-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.feature-tag {
  border-color: #f2b8b8;
  color: #9d1818;
  background-color: #fdf6ec;
}

.course-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px dashed #ebeef5;
  padding-top: 8px;
}

.consult-btn {
  background: var(--el-color-primary, #c41e1e);
  border-color: var(--el-color-primary, #c41e1e);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.consult-btn:hover {
  background: var(--el-color-primary-light-3, #d95454);
  border-color: var(--el-color-primary-light-3, #d95454);
}
</style>
