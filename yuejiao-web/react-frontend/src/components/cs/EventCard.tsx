import { useState } from 'react'
import { Button, Input, Modal } from 'antd'
import { Calendar, Check, Location, Ticket, User } from '@/components/elementIcons'
import { toast } from '@/components/feedback'
import { csApi } from '@/api/cs'
import { EpTag } from './EpTag'
import type { EventLectureItem } from '@/api/csTypes'
import './EventCard.css'

/** 等价迁移自 Vue 版 views/cs/components/EventCard.vue */
export function EventCard({
  event,
  onRegistered,
}: {
  event: EventLectureItem
  onRegistered: (eventName: string) => void
}) {
  const [dialogVisible, setDialogVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hasRegistered, setHasRegistered] = useState(false)
  const [form, setForm] = useState({ customerName: '', contactInfo: '', remark: '' })

  let formattedTime = '时间待定'
  if (event.start_time) {
    const d = new Date(event.start_time)
    if (!isNaN(d.getTime())) {
      const month = d.getMonth() + 1
      const day = d.getDate()
      const hours = String(d.getHours()).padStart(2, '0')
      const mins = String(d.getMinutes()).padStart(2, '0')
      formattedTime = `${month}月${day}日 ${hours}:${mins}`
    } else {
      formattedTime = event.start_time
    }
  }

  let seatRatio = '充足'
  if (event.max_participants) {
    const left = Math.max(0, event.max_participants - event.current_participants)
    seatRatio = `剩余 ${left} 席`
  }

  async function handleRegisterSubmit() {
    if (!form.customerName.trim()) {
      toast.warning('请填写您的姓名')
      return
    }
    if (!form.contactInfo.trim()) {
      toast.warning('请填写联系电话或微信号')
      return
    }

    setSubmitting(true)
    try {
      const res = await csApi.registerEvent({
        event_id: event.id,
        customer_name: form.customerName.trim(),
        contact_info: form.contactInfo.trim(),
        remark: form.remark.trim() || undefined,
      })

      if (res.is_success) {
        toast.success(`恭喜！${event.event_name} 预约成功！`)
        setHasRegistered(true)
        setDialogVisible(false)
        onRegistered(event.event_name)
      } else {
        toast.error(res.message || '预约未成功，请稍后再试')
      }
    } catch (err: any) {
      toast.error(err?.message || '网络连接异常，预约失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="event-card">
      <div className="event-header">
        <div className="title-wrap">
          <EpTag type={event.event_type === '讲座' ? 'danger' : 'warning'} effect="dark">
            {event.event_type}
          </EpTag>
          <span className="event-title">{event.event_name}</span>
        </div>
        <EpTag
          type={event.has_available_seats ? 'success' : 'info'}
          effect="light"
          className="seat-tag"
        >
          {event.has_available_seats ? seatRatio : '已约满'}
        </EpTag>
      </div>

      {event.description ? <div className="event-desc">{event.description}</div> : null}

      <div className="event-info-grid">
        <div className="info-row">
          <Calendar size={12} />
          <span>时间：{formattedTime}</span>
        </div>
        <div className="info-row">
          <Location size={12} />
          <span>地点：{event.location || '线上专场 / 校区招办'}</span>
        </div>
      </div>

      <div className="event-footer">
        {/* Vue 的「已成功预约」为 el-button type="success"(EP 绿色实心按钮) */}
        {!hasRegistered ? (
          <Button
            type="primary"
            size="small"
            className="register-btn"
            disabled={!event.has_available_seats}
            onClick={() => setDialogVisible(true)}
          >
            <Ticket size={12} />
            {event.has_available_seats ? '一键预约席位' : '名额已满'}
          </Button>
        ) : (
          <Button size="small" disabled className="registered-btn" style={{ color: '#ffffff', background: '#67c23a', borderColor: '#67c23a' }}>
            <Check size={12} />
            已成功预约
          </Button>
        )}
      </div>

      {/* 预约弹窗 */}
      <Modal
        open={dialogVisible}
        title={`预约活动：${event.event_name}`}
        width={440}
        destroyOnHidden
        onCancel={() => setDialogVisible(false)}
        footer={
          <div className="dialog-footer">
            <Button onClick={() => setDialogVisible(false)}>取消</Button>
            <Button type="primary" loading={submitting} onClick={() => void handleRegisterSubmit()}>
              确认提交预约
            </Button>
          </div>
        }
      >
        <div className="dialog-tips">
          请留下您的联系方式，我们的顾问老师将提前发送会议室链接与入场指南。
        </div>

        {/* Vue 用 el-form label-position="top" + required 必填;此处按约定用受控输入 + 手写校验 */}
        <div className="register-form">
          <div className="register-form-item">
            <label className="register-form-label">
              <span className="required-mark">*</span>姓名 *
            </label>
            <Input
              value={form.customerName}
              placeholder="例如：李同学 / 王家长"
              maxLength={30}
              prefix={<User size={14} style={{ color: '#c0c4cc' }} />}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </div>

          <div className="register-form-item">
            <label className="register-form-label">
              <span className="required-mark">*</span>联系电话 / 微信 *
            </label>
            <Input
              value={form.contactInfo}
              placeholder="用于接收讲座提醒短信或活动入场码"
              maxLength={50}
              onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
            />
          </div>

          <div className="register-form-item">
            <label className="register-form-label">感兴趣的方向 / 备注</label>
            <Input.TextArea
              value={form.remark}
              rows={2}
              maxLength={150}
              showCount
              placeholder="例如：想了解德国双元制机械类、新加坡高中插班..."
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
