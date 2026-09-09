// 等价移植自 Vue 版 前端代码/src/views/report/CountChart.vue:
// 竖柱(≤6,grid --bar-count)/ 横条(>6 单色)/ SVG 环图(CX=CY=80、OUTER=68、INNER=40,
// 占比 <0.18 标签外移、单一片退化整圆 stroke、total=0 画空环)与 INK 4 色板逐行照搬。
import type { CSSProperties, ReactNode } from 'react'
import type { ReportChart } from './charts'

const INK = ['#c41e1e', '#2f3a4a', '#8a4b4b', '#5c6b7a']
const CX = 80
const CY = 80
const OUTER = 68
const INNER = 40

interface RingArc {
  path: string
  color: string
  count: number
  name: string
  labelX: number
  labelY: number
  isFull: boolean
  isOutside: boolean
}

function donutPath(startAngle: number, endAngle: number, isFullCircle: boolean) {
  if (isFullCircle) {
    return ''
  }
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  const outerStart = polar(OUTER, startAngle)
  const outerEnd = polar(OUTER, endAngle)
  const innerStart = polar(INNER, endAngle)
  const innerEnd = polar(INNER, startAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER} ${OUTER} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${INNER} ${INNER} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

function polar(radius: number, angle: number) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  }
}

export function CountChart({ chart }: { chart: ReportChart }) {
  const maxCount = Math.max(...chart.slices.map((slice) => slice.count), 1)
  const isPackedBars = chart.slices.length > 6

  const barColumns = chart.slices.map((slice, index) => ({
    ...slice,
    sizePercent: (slice.count / maxCount) * 100,
    color: isPackedBars ? INK[0] : INK[index % INK.length],
  }))

  const ringDrawing = (() => {
    const slices = chart.slices
    const total = slices.reduce((sum, slice) => sum + slice.count, 0)
    if (total === 0) {
      const step = (Math.PI * 2) / Math.max(slices.length, 1)
      const arcs = slices.map((slice, index) => {
        const mid = -Math.PI / 2 + step * (index + 0.5)
        return {
          path: '',
          color: INK[index % INK.length],
          count: slice.count,
          name: slice.name,
          labelX: CX + Math.cos(mid) * (OUTER + 14),
          labelY: CY + Math.sin(mid) * (OUTER + 14),
          isFull: false,
          isOutside: true,
        } satisfies RingArc
      })
      return { isEmpty: true as const, arcs }
    }
    let startAngle = -Math.PI / 2
    const arcs = slices.map((slice, index) => {
      const fraction = slice.count / total
      const sweep = fraction * Math.PI * 2
      const endAngle = startAngle + sweep
      const mid = startAngle + sweep / 2
      const isOutside = fraction < 0.18
      const labelRadius = isOutside ? OUTER + 18 : (OUTER + INNER) / 2
      const arc: RingArc = {
        path: donutPath(startAngle, endAngle, fraction >= 1),
        color: INK[index % INK.length],
        count: slice.count,
        name: slice.name,
        labelX: CX + Math.cos(mid) * labelRadius,
        labelY: CY + Math.sin(mid) * labelRadius,
        isFull: fraction >= 1,
        isOutside,
      }
      startAngle = endAngle
      return arc
    })
    return { isEmpty: false as const, arcs }
  })()

  const summaryText = chart.slices.map((slice) => `${slice.name} ${slice.count}`).join('，')

  let body: ReactNode
  if (chart.shape === 'bar' && !isPackedBars) {
    body = (
      <div
        className="bars"
        style={{ '--bar-count': chart.slices.length } as CSSProperties}
      >
        {barColumns.map((column, index) => (
          <div key={column.name + '-' + index} className="bar-col">
            <span className="bar-count">{column.count}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ height: column.sizePercent + '%', background: column.color }}
              />
            </div>
            <span className="bar-name">{column.name}</span>
          </div>
        ))}
      </div>
    )
  } else if (chart.shape === 'bar') {
    body = (
      <div className="hbars">
        {barColumns.map((column, index) => (
          <div key={column.name + '-' + index} className="hbar-row">
            <span className="hbar-name">{column.name}</span>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: column.sizePercent + '%', background: column.color }}
              />
            </div>
            <span className="hbar-count">{column.count}</span>
          </div>
        ))}
      </div>
    )
  } else {
    body = (
      <div className="ring-wrap">
        <svg viewBox="0 0 160 160" className="ring" aria-hidden="true">
          <circle cx={80} cy={80} r={68} fill="none" stroke="#e4e7ed" strokeWidth={28} />
          {ringDrawing.isEmpty ? (
            ringDrawing.arcs.map((arc) => (
              <text
                key={arc.name + '-z'}
                x={arc.labelX}
                y={arc.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="slice-count outside"
              >
                {arc.count}
              </text>
            ))
          ) : (
            <>
              {ringDrawing.arcs.some((arc) => arc.isFull) && (
                <circle
                  cx={80}
                  cy={80}
                  r={54}
                  fill="none"
                  stroke={ringDrawing.arcs.find((arc) => arc.isFull)?.color}
                  strokeWidth={28}
                />
              )}
              {ringDrawing.arcs
                .filter((item) => !item.isFull && item.count > 0)
                .map((arc) => (
                  <path key={arc.name} d={arc.path} fill={arc.color} />
                ))}
              {ringDrawing.arcs
                .filter((item) => item.count > 0)
                .map((arc) => (
                  <text
                    key={arc.name + '-n'}
                    x={arc.labelX}
                    y={arc.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={arc.isOutside ? 'slice-count outside' : 'slice-count'}
                  >
                    {arc.count}
                  </text>
                ))}
            </>
          )}
          {chart.centerLabel && (
            <text x={80} y={80} textAnchor="middle" dominantBaseline="middle" className="ring-center">
              {chart.centerLabel}
            </text>
          )}
        </svg>
        <ul className="ring-legend">
          {chart.slices.map((slice, index) => (
            <li key={slice.name}>
              <i style={{ background: INK[index % INK.length] }} />
              {slice.name}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <figure className="count-chart">
      <p className="sr-only">
        {chart.title}：{summaryText}
      </p>
      {body}
      <figcaption>{chart.title}</figcaption>
    </figure>
  )
}
