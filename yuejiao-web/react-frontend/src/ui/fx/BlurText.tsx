import { useMemo } from 'react'
import { motion } from 'motion/react'

/**
 * Ported from react-bits `BlurText`, adapted for CJK:
 * per-character segments by default (Chinese has no spaces),
 * reduced-motion renders static text.
 */
interface BlurTextProps {
  text: string
  className?: string
  /** seconds before the first segment */
  delay?: number
  animateBy?: 'characters' | 'words'
  /** seconds between segments */
  stagger?: number
}

export function BlurText({ text, className, delay = 0, animateBy = 'characters', stagger = 0.03 }: BlurTextProps) {
  const segments = useMemo(
    () => (animateBy === 'words' ? text.split(/(\s+)/).filter(Boolean) : Array.from(text)),
    [text, animateBy],
  )

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className} aria-label={text} style={{ display: 'inline-block' }}>
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          aria-hidden
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: delay + index * stagger, ease: [0.19, 1, 0.22, 1] }}
          style={{ display: 'inline-block', willChange: 'transform, opacity, filter' }}
        >
          {segment === ' ' ? ' ' : segment}
        </motion.span>
      ))}
    </span>
  )
}
