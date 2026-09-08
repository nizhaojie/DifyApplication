<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'

defineProps<{
  source: string
}>()
</script>

<template>
  <div class="citation-badge" :title="`权威参考来源：${source}`">
    <el-icon class="citation-icon"><Document /></el-icon>
    <span class="citation-text">知识来源：{{ source.replace(/【|】|知识来源[:：]/g, '') }}</span>
  </div>
</template>

<style scoped>
.citation-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f4f6f8;
  border: 1px solid #e1e4e8;
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 11px;
  color: #606266;
  margin-top: 6px;
  margin-right: 6px;
  transition: all 0.2s ease;
  user-select: none;
}

.citation-badge:hover {
  background: #eef1f6;
  border-color: #c41e1e;
  color: #c41e1e;
}

.citation-icon {
  font-size: 12px;
  color: #909399;
}

.citation-badge:hover .citation-icon {
  color: #c41e1e;
}

.citation-text {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
