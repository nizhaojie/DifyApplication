// 等价迁移自 components/BarList.vue
const PALETTE = ['#c41e1e', '#9d1818', '#1d1e1f', '#d95454', '#606266']

export interface BarListItem {
  label: string
  value: number
  color?: string
}

export function BarList({ items }: { items: BarListItem[] }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0))
  return (
    <div className="bar-list">
      {items.map((item, index) => (
        <div key={item.label} className="bar-row">
          <span className="funnel-label">{item.label}</span>
          <div className="funnel-track">
            <div
              className="funnel-bar"
              style={{
                width: `${((Number(item.value) || 0) / max) * 100}%`,
                background: item.color || PALETTE[index % PALETTE.length],
              }}
            />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}
