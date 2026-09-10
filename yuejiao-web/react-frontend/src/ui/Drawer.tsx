import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { IconButton } from '@/ui/Button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  eyebrow?: ReactNode
  title: ReactNode
  width?: number
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({ open, onClose, eyebrow, title, width, children, footer }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay overlay--drawer" />
        <Dialog.Content
          className="drawer"
          aria-describedby={undefined}
          style={width ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined}
        >
          <header className="drawer-head">
            <div className="drawer-title">
              {eyebrow ? <div className="page-header-eyebrow">{eyebrow}</div> : null}
              <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <IconButton label="关闭"><X size={17} /></IconButton>
            </Dialog.Close>
          </header>
          <div className="drawer-body">{children}</div>
          {footer ? <footer className="drawer-foot">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
