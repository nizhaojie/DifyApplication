import type { ReactNode } from 'react'

interface EmptyProps {
  icon?: ReactNode
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
  tight?: boolean
  className?: string
}

export function Empty({ icon, title, desc, action, tight, className }: EmptyProps) {
  return (
    <div className={['empty', tight ? 'empty--tight' : '', className].filter(Boolean).join(' ')}>
      {icon ? <span className="empty-icon">{icon}</span> : null}
      <p className="empty-title">{title}</p>
      {desc ? <p className="empty-desc">{desc}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}
