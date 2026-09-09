<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const users = useUserStore()
const loading = ref(false)
const form = reactive({
  username: 'emp01',
  password: '123456',
})

async function submit() {
  loading.value = true
  try {
    await users.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/enterprise'
    await router.replace(redirect)
  } catch {
    /* interceptor already toasts */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-card">
      <div class="brand">
        <span class="mark">粤</span>
        <div>
          <h1>粤教服务</h1>
          <p>企业智能助手 · 演示登录</p>
        </div>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="账号">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-button type="primary" :loading="loading" style="width: 100%" native-type="submit">进入控制台</el-button>
      </el-form>
      <p class="hint">演示账号 emp01 / 123456（演示顾问）。后端地址：127.0.0.1:8002。</p>
    </section>
  </div>
</template>
