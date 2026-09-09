<script setup lang="ts">
import { computed } from 'vue'
import type { ReportChart } from './charts'

const props = defineProps<{ chart: ReportChart }>()

const INK = ['#c41e1e', '#2f3a4a', '#8a4b4b', '#5c6b7a']
const CX = 80
const CY = 80
const OUTER = 68
const INNER = 40

const maxCount = computed(() => Math.max(...props.chart.slices.map((slice) => slice.count), 1))
const isPackedBars = computed(() => props.chart.slices.length > 6)

const barColumns = computed(() =>
  props.chart.slices.map((slice, index) => ({
    ...slice,
    sizePercent: (slice.count / maxCount.value) * 100,
    color: isPackedBars.value ? INK[0] : INK[index % INK.length],
  })),
)

const ringDrawing = computed(() => {
  const slices = props.chart.slices
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  if (total === 0) {
    const step = (Math.PI * 2) / Math.max(slices.length, 1)
    const arcs = slices.map((slice, index) => {
      const mid = -Math.PI / 2 + step * (index + 0.5)
      return {
        path: '',
        color: INK[index % INK.length],
        count: slice.count,
        name: slice.name,
        labelX: CX + Math.cos(mid) * (OUTER + 14),
        labelY: CY + Math.sin(mid) * (OUTER + 14),
        isFull: false,
        isOutside: true,
      } satisfies RingArc
    })
    return { isEmpty: true, arcs }
  }
  let startAngle = -Math.PI / 2
  const arcs = slices.map((slice, index) => {
    const fraction = slice.count / total
    const sweep = fraction * Math.PI * 2
    const endAngle = startAngle + sweep
    const mid = startAngle + sweep / 2
    const isOutside = fraction < 0.18
    const labelRadius = isOutside ? OUTER + 18 : (OUTER + INNER) / 2
    const arc: RingArc = {
      path: donutPath(startAngle, endAngle, fraction >= 1),
      color: INK[index % INK.length],
      count: slice.count,
      name: slice.name,
      labelX: CX + Math.cos(mid) * labelRadius,
      labelY: CY + Math.sin(mid) * labelRadius,
      isFull: fraction >= 1,
      isOutside,
    }
    startAngle = endAngle
    return arc
  })
  return { isEmpty: false, arcs }
})

const summaryText = computed(() =>
  props.chart.slices.map((slice) => `${slice.name} ${slice.count}`).join('，'),
)

interface RingArc {
  path: string
  color: string
  count: number
  name: string
  labelX: number
  labelY: number
  isFull: boolean
  isOutside: boolean
}

function donutPath(startAngle: number, endAngle: number, isFullCircle: boolean) {
  if (isFullCircle) {
    return ''
  }
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  const outerStart = polar(OUTER, startAngle)
  const outerEnd = polar(OUTER, endAngle)
  const innerStart = polar(INNER, endAngle)
  const innerEnd = polar(INNER, startAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER} ${OUTER} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${INNER} ${INNER} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

function polar(radius: number, angle: number) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  }
}
</script>

<template>
  <figure class="count-chart">
    <p class="sr-only">{{ chart.title }}：{{ summaryText }}</p>
    <div v-if="chart.shape === 'bar' && !isPackedBars" class="bars" :style="{ '--bar-count': chart.slices.length }">
      <div v-for="(column, index) in barColumns" :key="column.name + '-' + index" class="bar-col">
        <span class="bar-count">{{ column.count }}</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ height: column.sizePercent + '%', background: column.color }" />
        </div>
        <span class="bar-name">{{ column.name }}</span>
      </div>
    </div>
    <div v-else-if="chart.shape === 'bar'" class="hbars">
      <div v-for="(column, index) in barColumns" :key="column.name + '-' + index" class="hbar-row">
        <span class="hbar-name">{{ column.name }}</span>
        <div class="hbar-track">
          <div class="hbar-fill" :style="{ width: column.sizePercent + '%', background: column.color }" />
        </div>
        <span class="hbar-count">{{ column.count }}</span>
      </div>
    </div>
    <div v-else class="ring-wrap">
      <svg viewBox="0 0 160 160" class="ring" aria-hidden="true">
        <circle cx="80" cy="80" r="68" fill="none" stroke="#e4e7ed" stroke-width="28" />
        <template v-if="ringDrawing.isEmpty">
          <text
            v-for="arc in ringDrawing.arcs"
            :key="arc.name + '-z'"
            :x="arc.labelX"
            :y="arc.labelY"
            text-anchor="middle"
            dominant-baseline="middle"
            class="slice-count outside"
          >
            {{ arc.count }}
          </text>
        </template>
        <template v-else>
          <circle
            v-if="ringDrawing.arcs.some((arc) => arc.isFull)"
            cx="80"
            cy="80"
            r="54"
            fill="none"
            :stroke="ringDrawing.arcs.find((arc) => arc.isFull)?.color"
            stroke-width="28"
          />
          <path
            v-for="arc in ringDrawing.arcs.filter((item) => !item.isFull && item.count > 0)"
            :key="arc.name"
            :d="arc.path"
            :fill="arc.color"
          />
          <text
            v-for="arc in ringDrawing.arcs.filter((item) => item.count > 0)"
            :key="arc.name + '-n'"
            :x="arc.labelX"
            :y="arc.labelY"
            text-anchor="middle"
            dominant-baseline="middle"
            :class="arc.isOutside ? 'slice-count outside' : 'slice-count'"
          >
            {{ arc.count }}
          </text>
        </template>
        <text v-if="chart.centerLabel" x="80" y="80" text-anchor="middle" dominant-baseline="middle" class="ring-center">
          {{ chart.centerLabel }}
        </text>
      </svg>
      <ul class="ring-legend">
        <li v-for="(slice, index) in chart.slices" :key="slice.name">
          <i :style="{ background: INK[index % INK.length] }" />
          {{ slice.name }}
        </li>
      </ul>
    </div>
    <figcaption>{{ chart.title }}</figcaption>
  </figure>
</template>

<style scoped>
.count-chart {
  margin: 0 0 12px;
  pointer-events: none;
  user-select: none;
  max-width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.bars {
  display: grid;
  grid-template-columns: repeat(var(--bar-count), minmax(0, 1fr));
  gap: 10px;
  align-items: end;
  height: 168px;
  padding: 0 4px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  min-width: 0;
}

.bar-count {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #303133;
  line-height: 1;
  margin-bottom: 6px;
}

.bar-track {
  flex: 1;
  width: 28px;
  background: #f2f3f5;
  border-radius: 2px 2px 0 0;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  min-height: 0;
  border-radius: 2px 2px 0 0;
}

.bar-name {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
  text-align: center;
  line-height: 1.3;
  word-break: break-all;
}

.hbars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 520px;
}

.hbar-row {
  display: grid;
  grid-template-columns: minmax(72px, 140px) minmax(80px, 1fr) 36px;
  gap: 8px;
  align-items: center;
}

.hbar-name {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hbar-track {
  height: 10px;
  background: #f2f3f5;
  border-radius: 1px;
}

.hbar-fill {
  height: 100%;
  min-width: 0;
  border-radius: 1px;
}

.hbar-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #303133;
  text-align: right;
}

.ring-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ring {
  width: 168px;
  height: 168px;
  flex: 0 0 168px;
}

.slice-count {
  fill: #fff;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.slice-count.outside {
  fill: #303133;
}

.ring-center {
  fill: #303133;
  font-size: 11px;
  font-weight: 600;
}

.ring-legend {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: #303133;
}

.ring-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}

.ring-legend i {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  flex: 0 0 8px;
}

figcaption {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  letter-spacing: 0.04em;
}
</style>
