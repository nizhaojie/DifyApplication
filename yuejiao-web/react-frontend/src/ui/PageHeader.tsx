import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  desc?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, desc, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <div className="page-header-eyebrow">{eyebrow}</div> : null}
        <h1 className="page-header-title">{title}</h1>
        {desc ? <p className="page-header-desc">{desc}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  )
}
