import { toast } from 'sonner'

/** 统一的成功 / 失败 / 提示反馈（sonner，深色浮层样式） */
export function showToast(message: string, tone: 'success' | 'error' | 'info' = 'success') {
  if (tone === 'success') toast.success(message)
  else if (tone === 'error') toast.error(message)
  else toast(message)
}
