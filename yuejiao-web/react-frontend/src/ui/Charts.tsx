interface BarChartItem {
  label: string
  value: number
}

interface BarChartProps {
  items: BarChartItem[]
  /** min visible width (%) so zero-ish values stay readable */
  min?: number
  className?: string
}

/**
 * Single-hue horizontal bar list (dataviz: magnitude -> one hue,
 * direct labels, no legend). Values animate once on mount.
 */
export function BarChart({ items, min = 4, className }: BarChartProps) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div className={['chart', className].filter(Boolean).join(' ')} role="list">
      {items.map((item, index) => (
        <div key={item.label} role="listitem" aria-label={`${item.label} ${item.value}`}>
          <div className="chart-row-label">
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
          <div className="chart-track">
            <i
              className="chart-fill"
              style={{
                width: `${item.value ? Math.max(min, (item.value / max) * 100) : 0}%`,
                animationDelay: `${index * 55}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
