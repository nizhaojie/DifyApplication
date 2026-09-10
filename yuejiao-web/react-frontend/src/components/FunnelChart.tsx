// 等价迁移自 components/FunnelChart.vue(clip-path 梯形漏斗)
export interface FunnelItem {
  label: string
  value: number
  color?: string
}

export function FunnelChart({ items }: { items: FunnelItem[] }) {
  return (
    <div className="funnel-chart">
      {items.map((item, index) => (
        <div key={item.label} className="funnel-stage">
          <div
            className="funnel-shape"
            style={{
              width: `${Math.max(28, 100 - index * 14)}%`,
              background: item.color || '#c41e1e',
            }}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}
