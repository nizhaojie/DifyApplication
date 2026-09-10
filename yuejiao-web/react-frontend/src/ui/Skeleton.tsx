import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  className?: string
  style?: CSSProperties
}

export function Skeleton({ width, height = 12, radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
    />
  )
}

/** 多行文本骨架 */
export function SkeletonLines({ rows = 3, width }: { rows?: number; width?: number | string }) {
  return (
    <span style={{ display: 'grid', gap: 9 }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={11} width={index === rows - 1 ? '62%' : width ?? '100%'} />
      ))}
    </span>
  )
}
