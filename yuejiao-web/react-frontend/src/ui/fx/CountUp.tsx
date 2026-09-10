import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'

/**
 * Ported from react-bits `CountUp` (TS variant), tuned for this design system:
 * integer formatting, zh-CN grouping, shorter spring, reduced-motion aware.
 */
interface CountUpProps {
  to: number
  from?: number
  /** seconds */
  duration?: number
  /** seconds */
  delay?: number
  className?: string
  separator?: string
}

export function CountUp({ to, from = 0, duration = 0.9, delay = 0, className, separator = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(from)
  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)
  const springValue = useSpring(motionValue, { damping, stiffness })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (!isInView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      motionValue.set(to)
      return
    }
    const timer = window.setTimeout(() => motionValue.set(to), delay * 1000)
    return () => window.clearTimeout(timer)
  }, [isInView, to, delay, motionValue])

  useEffect(() => {
    const format = (value: number) => {
      const formatted = Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value))
      return separator ? formatted.replace(/,/g, separator) : formatted
    }
    if (ref.current) ref.current.textContent = format(from)
    return springValue.on('change', (latest) => {
      if (ref.current) ref.current.textContent = format(latest)
    })
  }, [springValue, from, separator, to])

  return <span ref={ref} className={className} />
}
