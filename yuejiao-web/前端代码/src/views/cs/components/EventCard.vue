<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Calendar, Check, Location, Ticket, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { csApi } from '../api/csApi'
import type { EventLectureItem } from '../types/csTypes'

const props = defineProps<{
  event: EventLectureItem
}>()

const emit = defineEmits<{
  (e: 'registered', eventName: string): void
}>()

const dialogVisible = ref(false)
const submitting = ref(false)
const hasRegistered = ref(false)

const form = reactive({
  customerName: '',
  contactInfo: '',
  remark: '',
})

const formattedTime = computed(() => {
  if (!props.event.start_time) return '时间待定'
  const d = new Date(props.event.start_time)
  if (isNaN(d.getTime())) return props.event.start_time
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hours}:${mins}`
})

const seatRatio = computed(() => {
  if (!props.event.max_participants) return '充足'
  const left = Math.max(0, props.event.max_participants - props.event.current_participants)
  return `剩余 ${left} 席`
})

function openRegisterDialog() {
  dialogVisible.value = true
}

async function handleRegisterSubmit() {
  if (!form.customerName.trim()) {
    ElMessage.warning('请填写您的姓名')
    return
  }
  if (!form.contactInfo.trim()) {
    ElMessage.warning('请填写联系电话或微信号')
    return
  }

  submitting.value = true
  try {
    const res = await csApi.registerEvent({
      event_id: props.event.id,
      customer_name: form.customerName.trim(),
      contact_info: form.contactInfo.trim(),
      remark: form.remark.trim() || undefined,
    })

    if (res.is_success) {
      ElMessage.success(`恭喜！${props.event.event_name} 预约成功！`)
      hasRegistered.value = true
      dialogVisible.value = false
      emit('registered', props.event.event_name)
    } else {
      ElMessage.error(res.message || '预约未成功，请稍后再试')
    }
  } catch (err: any) {
    ElMessage.error(err.message || '网络连接异常，预约失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="event-card">
    <div class="event-header">
      <div class="title-wrap">
        <el-tag
          size="small"
          :type="event.event_type === '讲座' ? 'danger' : 'warning'"
          effect="dark"
        >
          {{ event.event_type }}
        </el-tag>
        <span class="event-title">{{ event.event_name }}</span>
      </div>
      <el-tag
        size="small"
        :type="event.has_available_seats ? 'success' : 'info'"
        effect="light"
        class="seat-tag"
      >
        {{ event.has_available_seats ? seatRatio : '已约满' }}
      </el-tag>
    </div>

    <div v-if="event.description" class="event-desc">
      {{ event.description }}
    </div>

    <div class="event-info-grid">
      <div class="info-row">
        <el-icon><Calendar /></el-icon>
        <span>时间：{{ formattedTime }}</span>
      </div>
      <div class="info-row">
        <el-icon><Location /></el-icon>
        <span>地点：{{ event.location || '线上专场 / 校区招办' }}</span>
      </div>
    </div>

    <div class="event-footer">
      <el-button
        v-if="!hasRegistered"
        type="primary"
        size="small"
        class="register-btn"
        :disabled="!event.has_available_seats"
        @click="openRegisterDialog"
      >
        <el-icon><Ticket /></el-icon>
        {{ event.has_available_seats ? '一键预约席位' : '名额已满' }}
      </el-button>
      <el-button
        v-else
        type="success"
        size="small"
        disabled
        class="registered-btn"
      >
        <el-icon><Check /></el-icon>
        已成功预约
      </el-button>
    </div>

    <!-- 预约弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="`预约活动：${event.event_name}`"
      width="440px"
      append-to-body
      destroy-on-close
    >
      <div class="dialog-tips">
        请留下您的联系方式，我们的顾问老师将提前发送会议室链接与入场指南。
      </div>

      <el-form label-position="top" class="register-form">
        <el-form-item label="姓名 *" required>
          <el-input
            v-model="form.customerName"
            placeholder="例如：李同学 / 王家长"
            maxlength="30"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="联系电话 / 微信 *" required>
          <el-input
            v-model="form.contactInfo"
            placeholder="用于接收讲座提醒短信或活动入场码"
            maxlength="50"
          />
        </el-form-item>

        <el-form-item label="感兴趣的方向 / 备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="例如：想了解德国双元制机械类、新加坡高中插班..."
            maxlength="150"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            @click="handleRegisterSubmit"
          >
            确认提交预约
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.event-card {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 14px 16px;
  margin-top: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.event-card:hover {
  border-color: #dcdfe6;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.event-header {
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

.event-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.seat-tag {
  font-weight: 500;
}

.event-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 10px;
}

.event-info-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #606266;
  background: #fafafa;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-row .el-icon {
  color: var(--el-color-primary, #c41e1e);
}

.event-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px dashed #ebeef5;
  padding-top: 10px;
}

.register-btn {
  background: var(--el-color-primary, #c41e1e);
  border-color: var(--el-color-primary, #c41e1e);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.register-btn:hover {
  background: var(--el-color-primary-light-3, #d95454);
  border-color: var(--el-color-primary-light-3, #d95454);
}

.dialog-tips {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #fdf6ec;
  border-left: 3px solid #e6a23c;
  border-radius: 3px;
}

.register-form {
  margin-top: 8px;
}
</style>
