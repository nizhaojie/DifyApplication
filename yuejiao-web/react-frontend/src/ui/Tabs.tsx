import type { ReactNode } from 'react'
import { Fragment } from 'react'

export interface TabItem<K extends string = string> {
  key: K
  label: ReactNode
  count?: number
}

interface TabsProps<K extends string = string> {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
}

export function Tabs<K extends string = string>({ items, value, onChange, className }: TabsProps<K>) {
  return (
    <div role="tablist" className={['tabs', className].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <Fragment key={item.key}>
          <button
            type="button"
            role="tab"
            aria-selected={value === item.key}
            className={['tab', value === item.key ? 'active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(item.key)}
          >
            {item.label}
            {item.count != null && <span className="tab-count">{item.count}</span>}
          </button>
        </Fragment>
      ))}
    </div>
  )
}

interface SegmentedProps<K extends string = string> {
  items: { key: K; label: ReactNode }[]
  value: K
  onChange: (key: K) => void
  className?: string
}

export function Segmented<K extends string = string>({ items, value, onChange, className }: SegmentedProps<K>) {
  return (
    <div className={['segmented', className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          className={value === item.key ? 'active' : ''}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
