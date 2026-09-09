<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Bell,
  Briefcase,
  ChatDotRound,
  DataAnalysis,
  Document,
  Expand,
  Fold,
  Odometer,
  Setting,
  User,
} from '@element-plus/icons-vue'
import { useTagsStore } from '@/stores/tags'

const route = useRoute()
const router = useRouter()
const tags = useTagsStore()
const collapsed = ref(false)

const title = computed(() => String(route.meta.title ?? '工作台'))

watch(
  () => route.path,
  (path) => {
    tags.add({ path, title: title.value })
  },
  { immediate: true },
)

function openTag(path: string) {
  void router.push(path)
}

function closeTag(path: string) {
  if (path === '/dashboard') return
  const current = route.path === path
  tags.remove(path)
  if (current) {
    const last = tags.visited[tags.visited.length - 1]
    void router.push(last?.path ?? '/dashboard')
  }
}
</script>

<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="logo">
        <span class="mark">粤</span>
        <strong v-show="!collapsed">粤教服务</strong>
      </div>
      <el-menu
        :default-active="route.path"
        :default-openeds="['report']"
        :collapse="collapsed"
        router
        background-color="#1d1e1f"
        text-color="#cfd3dc"
        active-text-color="#ffffff"
      >
        <div v-if="!collapsed" class="menu-cap">工作台</div>
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <div v-if="!collapsed" class="menu-cap">业务模块 · 后接</div>
        <el-menu-item index="/profile">
          <el-icon><DataAnalysis /></el-icon>
          <span>客户研判</span>
        </el-menu-item>
        <el-menu-item index="/cs">
          <el-icon><ChatDotRound /></el-icon>
          <span>客服 Agent</span>
        </el-menu-item>
        <el-menu-item index="/enterprise">
          <el-icon><Briefcase /></el-icon>
          <span>企业助手</span>
        </el-menu-item>
        <el-menu-item index="/student">
          <el-icon><User /></el-icon>
          <span>学生助手</span>
        </el-menu-item>
        <el-sub-menu index="report">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>智能报告</span>
          </template>
          <el-menu-item index="/report/customer-ops">全域客户经营分析</el-menu-item>
          <el-menu-item index="/report/daily-summary">员工日报智能汇总</el-menu-item>
          <el-menu-item index="/report/psych-weekly">学生心理健康周报</el-menu-item>
          <el-menu-item index="/report/complaint-weekly">投诉处理周报</el-menu-item>
        </el-sub-menu>
        <div v-if="!collapsed" class="menu-cap">系统</div>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container class="content-pane">
      <el-header class="header" height="56px">
        <el-button text @click="collapsed = !collapsed">
          <el-icon :size="18">
            <Expand v-if="collapsed" />
            <Fold v-else />
          </el-icon>
        </el-button>
        <div class="crumb">粤教 / 控制台 / <b>{{ title }}</b></div>
        <el-input class="search" placeholder="搜索菜单 / 客户 / 工单" disabled />
        <el-badge is-dot>
          <el-button text>
            <el-icon :size="18"><Bell /></el-icon>
          </el-button>
        </el-badge>
        <div class="header-user">
          <el-avatar :size="28" style="background: #c41e1e">可</el-avatar>
          <span>瞿可为</span>
        </div>
      </el-header>
      <div class="tags">
        <el-tag
          v-for="tag in tags.visited"
          :key="tag.path"
          :type="tag.path === route.path ? 'danger' : 'info'"
          :effect="tag.path === route.path ? 'light' : 'plain'"
          :closable="tag.path !== '/dashboard'"
          @click="openTag(tag.path)"
          @close="closeTag(tag.path)"
        >
          {{ tag.title }}
        </el-tag>
      </div>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
