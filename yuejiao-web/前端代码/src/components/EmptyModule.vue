<script setup lang="ts">
defineProps<{
  title: string
  hint: string
}>()
</script>

<template>
  <section class="empty-module">
    <h1>{{ title }}</h1>
    <p class="hint">{{ hint }}</p>
    <el-empty description="空白模版，还没有业务内容" />
  </section>
</template>
