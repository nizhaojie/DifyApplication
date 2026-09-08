<script setup lang="ts">
defineProps<{
  items: { label: string; value: number; color?: string }[]
}>()
</script>

<template>
  <div class="funnel-chart">
    <div v-for="(item, index) in items" :key="item.label" class="funnel-stage">
      <div
        class="funnel-shape"
        :style="{
          width: `${Math.max(28, 100 - index * 14)}%`,
          background: item.color || '#c41e1e',
        }"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
  </div>
</template>
