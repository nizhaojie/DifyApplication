<script setup lang="ts">
export interface NameTableColumn {
  key: string
  label: string
}

defineProps<{
  columns: NameTableColumn[]
  rows: Record<string, string | number>[]
}>()
</script>

<template>
  <div class="roster">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <td v-for="column in columns" :key="column.key">{{ row[column.key] }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.roster {
  max-height: 320px;
  overflow: auto;
  margin: 0 0 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  line-height: 1.5;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fafafa;
  color: #606266;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
}

td {
  border-bottom: 1px dashed #ebeef5;
  color: #303133;
  white-space: pre-line;
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>
