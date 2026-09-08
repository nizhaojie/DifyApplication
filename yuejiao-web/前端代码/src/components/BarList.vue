<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  items: { label: string; value: number; color?: string }[]
}>()

const palette = ['#c41e1e', '#9d1818', '#1d1e1f', '#d95454', '#606266']
const max = computed(() => Math.max(1, ...props.items.map((item) => Number(item.value) || 0)))
</script>

<template>
  <div class="bar-list">
    <div v-for="(item, index) in items" :key="item.label" class="bar-row">
      <span class="funnel-label">{{ item.label }}</span>
      <div class="funnel-track">
        <div
          class="funnel-bar"
          :style="{
            width: `${((Number(item.value) || 0) / max) * 100}%`,
            background: item.color || palette[index % palette.length],
          }"
        />
      </div>
      <strong>{{ item.value }}</strong>
    </div>
  </div>
</template>
