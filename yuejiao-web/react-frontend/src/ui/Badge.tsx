import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet'

interface BadgeProps {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}

export function Badge({ tone = 'neutral', dot = false, children }: BadgeProps) {
  return (
    <span className={['badge', tone !== 'neutral' ? `badge--${tone}` : ''].filter(Boolean).join(' ')}>
      {dot && <i aria-hidden />}
      {children}
    </span>
  )
}

/** 单色小圆点 + 文本（面板内轻量状态标注） */
export function LiveDot({ children = '在线' }: { children?: ReactNode }) {
  return (
    <span className="live-dot">
      <i aria-hidden />
      {children}
    </span>
  )
}
