import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { CountUp } from '@/ui/fx/CountUp'

export interface StatDelta {
  tone: 'up' | 'down' | 'flat'
  text: ReactNode
}

interface StatCardProps {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  delta?: StatDelta
  /** entrance stagger, ms */
  delay?: number
  /** value renders as text instead of a big number */
  textValue?: boolean
}

export function StatCard({ label, value, hint, delta, delay = 0, textValue }: StatCardProps) {
  const DeltaIcon = delta?.tone === 'up' ? ArrowUpRight : delta?.tone === 'down' ? ArrowDownRight : Minus
  const numeric = typeof value === 'number' ? value : null
  return (
    <article className="stat" style={{ animationDelay: `${delay}ms` }}>
      <span className="stat-label">{label}</span>
      <strong className={['stat-value', textValue ? 'stat-value--text' : ''].filter(Boolean).join(' ')}>
        {numeric != null ? <CountUp to={numeric} delay={delay / 1000 + 0.08} /> : value}
      </strong>
      {(hint || delta) && (
        <span className="stat-hint">
          {delta && (
            <span className={`stat-delta stat-delta--${delta.tone}`}>
              <DeltaIcon size={13} />
              {delta.text}
            </span>
          )}
          {delta && hint ? ' · ' : ''}
          {hint}
        </span>
      )}
    </article>
  )
}
