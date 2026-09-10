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
  Notebook,
  OfficeBuilding,
  Odometer,
  Reading,
  Setting,
  TrendCharts,
  User,
} from '@element-plus/icons-vue'
import CsFloatWidget from '@/components/cs-widget/CsFloatWidget.vue'
import { useTagsStore } from '@/stores/tags'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const tags = useTagsStore()
const users = useUserStore()
const collapsed = ref(false)

function logout() {
  users.logout()
  void router.push('/login')
}

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
        :key="collapsed ? 'fold' : 'open'"
        :default-active="route.path"
        :default-openeds="collapsed ? [] : ['enterprise']"
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
        <el-sub-menu index="enterprise">
          <template #title>
            <el-icon><Briefcase /></el-icon>
            <span>企业助手</span>
          </template>
          <el-menu-item index="/enterprise">
            <el-icon><ChatDotRound /></el-icon>
            <span>对话工作台</span>
          </el-menu-item>
          <el-menu-item index="/enterprise/company">
            <el-icon><OfficeBuilding /></el-icon>
            <span>公司简介</span>
          </el-menu-item>
          <el-menu-item index="/enterprise/guide">
            <el-icon><Reading /></el-icon>
            <span>新人指南</span>
          </el-menu-item>
          <el-menu-item index="/enterprise/board">
            <el-icon><TrendCharts /></el-icon>
            <span>客户看板</span>
          </el-menu-item>
          <el-menu-item index="/enterprise/memory">
            <el-icon><Notebook /></el-icon>
            <span>对话记忆</span>
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="student">
          <template #title>
            <el-icon><User /></el-icon>
            <span>学生助手</span>
          </template>
          <el-menu-item index="/student"><el-icon><Reading /></el-icon><span>学生服务总览</span></el-menu-item>
          <el-menu-item index="/student/psych"><el-icon><ChatDotRound /></el-icon><span>心理关怀</span></el-menu-item>
          <el-menu-item index="/student/life"><el-icon><Odometer /></el-icon><span>海外生活支持</span></el-menu-item>
          <el-menu-item index="/student/program"><el-icon><TrendCharts /></el-icon><span>升学项目咨询</span></el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="report">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>智能报告</span>
          </template>
          <el-menu-item index="/report">
            <span>报告入口</span>
          </el-menu-item>
          <el-menu-item index="/report/customer-ops">
            <span>全域客户经营分析</span>
          </el-menu-item>
          <el-menu-item index="/report/daily-summary">
            <span>员工日报智能汇总</span>
          </el-menu-item>
          <el-menu-item index="/report/psych-weekly">
            <span>学生心理健康周报</span>
          </el-menu-item>
          <el-menu-item index="/report/complaint-weekly">
            <span>投诉处理周报</span>
          </el-menu-item>
        </el-sub-menu>
        <div v-if="!collapsed" class="menu-cap">系统</div>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
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
          <el-avatar :size="28" style="background: #c41e1e">{{ users.displayName.slice(0, 1) }}</el-avatar>
          <span>{{ users.displayName }}</span>
          <el-button text @click="logout">退出</el-button>
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
    <CsFloatWidget />
  </el-container>
</template>
