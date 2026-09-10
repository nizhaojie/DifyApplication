// 等价移植自 Vue 版 前端代码/src/views/report/NameTable.vue:
// 原生 table、sticky 表头、max-height 320 内滚、td white-space:pre-line。
export interface NameTableColumn {
  key: string
  label: string
}

export function NameTable({
  columns,
  rows,
}: {
  columns: NameTableColumn[]
  rows: Record<string, string | number>[]
}) {
  return (
    <div className="roster">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
