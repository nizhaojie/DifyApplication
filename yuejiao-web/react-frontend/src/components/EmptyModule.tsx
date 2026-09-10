import { Empty } from 'antd'

// 等价迁移自 components/EmptyModule.vue
export function EmptyModule({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="empty-module">
      <h1>{title}</h1>
      <p className="hint">{hint}</p>
      <Empty description="空白模版，还没有业务内容" />
    </section>
  )
}
