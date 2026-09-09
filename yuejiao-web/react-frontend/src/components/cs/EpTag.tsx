import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { Tag } from 'antd'

/**
 * 等价迁移自 Element Plus `el-tag` 的 type/effect 配色(移植 cs 模块时的共用薄封装)。
 * primary 一组色值取本项目主题红(见 src/theme/antdTheme.ts 的 EP 色阶),
 * success/warning/danger/info 使用 EP 默认主题的 light-8 / light-9 色阶。
 */

export type EpTagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
export type EpTagEffect = 'light' | 'plain' | 'dark'

const TAG_BASE_COLOR: Record<EpTagType, string> = {
  primary: '#c41e1e',
  success: '#67c23a',
  warning: '#e6a23c',
  danger: '#f56c6c',
  info: '#909399',
}

const TAG_LIGHT_BG: Record<EpTagType, string> = {
  primary: '#fdecec',
  success: '#f0f9eb',
  warning: '#fdf6ec',
  danger: '#fef0f0',
  info: '#f4f4f5',
}

const TAG_LIGHT_BORDER: Record<EpTagType, string> = {
  primary: '#f2b8b8',
  success: '#e1f3d8',
  warning: '#faecd8',
  danger: '#fde2e2',
  info: '#e9e9eb',
}

export function epTagStyle(type: EpTagType = 'primary', effect: EpTagEffect = 'light'): CSSProperties {
  const base = TAG_BASE_COLOR[type]
  if (effect === 'dark') {
    return { color: '#ffffff', background: base, borderColor: base }
  }
  if (effect === 'plain') {
    return { color: base, background: '#ffffff', borderColor: TAG_LIGHT_BORDER[type] }
  }
  return { color: base, background: TAG_LIGHT_BG[type], borderColor: TAG_LIGHT_BORDER[type] }
}

interface EpTagProps {
  type?: EpTagType
  effect?: EpTagEffect
  className?: string
  style?: CSSProperties
  title?: string
  onClick?: MouseEventHandler<HTMLSpanElement>
  children?: ReactNode
}

export function EpTag({ type = 'primary', effect = 'light', className, style, title, onClick, children }: EpTagProps) {
  return (
    <Tag className={className} style={{ ...epTagStyle(type, effect), ...style }} title={title} onClick={onClick}>
      {children}
    </Tag>
  )
}
