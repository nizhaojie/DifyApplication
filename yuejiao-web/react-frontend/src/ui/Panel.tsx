import type { ReactNode } from 'react'

interface PanelProps {
  title?: ReactNode
  desc?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  /** render children directly without body padding (tables, chats, charts) */
  flush?: boolean
  /** smaller body padding */
  tight?: boolean
  footer?: ReactNode
  className?: string
  children: ReactNode
}

export function Panel({ title, desc, icon, actions, flush, tight, footer, className, children }: PanelProps) {
  const hasHead = Boolean(title || actions)
  const classes = ['panel', flush ? 'panel--flush' : '', className].filter(Boolean).join(' ')
  return (
    <section className={classes}>
      {hasHead && (
        <header className="panel-head">
          {icon}
          <div className="panel-head-text">
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {desc ? <p className="panel-desc">{desc}</p> : null}
          </div>
          {actions ? <div className="panel-head-actions">{actions}</div> : null}
        </header>
      )}
      {flush ? children : <div className={tight ? 'panel-body panel-body--tight' : 'panel-body'}>{children}</div>}
      {footer}
    </section>
  )
}
