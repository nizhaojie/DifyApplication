import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App, ConfigProvider, Input, Modal } from 'antd'
import type { InputRef } from 'antd'
import { yuejiaoLocale, yuejiaoTheme } from '@/theme/antdTheme'

// 等价迁移自 Element Plus 的 ElMessage / ElMessageBox.confirm / ElMessageBox.prompt。
// FeedbackBridge 需挂在 ConfigProvider 内,给 message 桥接上主题上下文;
// confirmBox/promptBox 通过独立 ReactDOM root 渲染并手动包裹 ConfigProvider,同样保有主题。

type ToastApi = {
  success: (content: string) => void
  error: (content: string) => void
  warning: (content: string) => void
  info: (content: string) => void
}

let bridged: ToastApi | null = null

export function FeedbackBridge() {
  const { message } = App.useApp()
  bridged = message as unknown as ToastApi
  return null
}

export const toast: ToastApi = {
  success: (content) => bridged?.success(content),
  error: (content) => bridged?.error(content),
  warning: (content) => bridged?.warning(content),
  info: (content) => bridged?.info(content),
}

export interface ConfirmOptions {
  title: string
  content?: string
  okText?: string
  cancelText?: string
}

/** 对齐 ElMessageBox.confirm:resolve(true) = 点了确定 */
export function confirmBox(options: ConfirmOptions): Promise<boolean> {
  return openDialog({
    title: options.title,
    content: options.content,
    okText: options.okText,
    cancelText: options.cancelText,
    input: null,
  }).then((result) => result === true)
}

export interface PromptOptions {
  title: string
  content?: string
  okText?: string
  cancelText?: string
  placeholder?: string
  inputType?: 'text' | 'textarea'
  /** 提供后即「必填」语义:为空拦截提交并提示(对齐 Vue 中 prompt + 空值警告) */
  emptyHint?: string
}

/** 对齐 ElMessageBox.prompt:resolve(string) = 确定;resolve(null) = 取消 */
export function promptBox(options: PromptOptions): Promise<string | null> {
  return openDialog({
    title: options.title,
    content: options.content,
    okText: options.okText,
    cancelText: options.cancelText,
    input: {
      type: options.inputType ?? 'text',
      placeholder: options.placeholder ?? '',
      emptyHint: options.emptyHint,
    },
  }).then((result) => (typeof result === 'string' ? result : null))
}

interface DialogSpec {
  title: string
  content?: string
  okText?: string
  cancelText?: string
  input: {
    type: 'text' | 'textarea'
    placeholder: string
    emptyHint?: string
  } | null
}

function openDialog(spec: DialogSpec): Promise<string | null | boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const finish = (result: string | null | boolean) => {
      resolve(result)
      // 等 Modal 关闭动画后再卸载
      window.setTimeout(() => {
        root.unmount()
        container.remove()
      }, 200)
    }

    function Dialog() {
      const [open, setOpen] = useState(true)
      const [value, setValue] = useState('')
      const [hint, setHint] = useState('')
      const inputRef = useRef<InputRef>(null)

      const close = (result: string | null | boolean) => {
        setOpen(false)
        finish(result)
      }

      const onOk = () => {
        if (spec.input) {
          const trimmed = value.trim()
          if (!trimmed) {
            setHint(spec.input.emptyHint ?? '内容不能为空')
            inputRef.current?.focus()
            return
          }
          close(trimmed)
          return
        }
        close(true)
      }

      React.useEffect(() => {
        if (spec.input) inputRef.current?.focus()
      }, [])

      return (
        <ConfigProvider locale={yuejiaoLocale} theme={yuejiaoTheme}>
          <Modal
            open={open}
            title={spec.title}
            okText={spec.okText ?? '确定'}
            cancelText={spec.cancelText ?? '取消'}
            onOk={onOk}
            onCancel={() => close(spec.input ? null : false)}
            destroyOnHidden
            width={420}
          >
            {spec.content ? <p style={{ margin: '0 0 12px' }}>{spec.content}</p> : null}
            {spec.input ? (
              <>
                {spec.input.type === 'textarea' ? (
                  <Input.TextArea
                    ref={inputRef as never}
                    value={value}
                    placeholder={spec.input.placeholder}
                    onChange={(e) => {
                      setValue(e.target.value)
                      if (hint) setHint('')
                    }}
                    rows={3}
                  />
                ) : (
                  <Input
                    ref={inputRef}
                    value={value}
                    placeholder={spec.input.placeholder}
                    onChange={(e) => {
                      setValue(e.target.value)
                      if (hint) setHint('')
                    }}
                    onPressEnter={onOk}
                  />
                )}
                {hint ? <div style={{ color: '#c41e1e', fontSize: 12, marginTop: 6 }}>{hint}</div> : null}
              </>
            ) : null}
          </Modal>
        </ConfigProvider>
      )
    }

    root.render(<Dialog />)
  })
}
