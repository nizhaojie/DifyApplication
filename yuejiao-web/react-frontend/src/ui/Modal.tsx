import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { IconButton } from '@/ui/Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  width?: number
  children?: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, desc, width, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="modal"
          aria-describedby={undefined}
          style={width ? { width: `min(${width}px, calc(100vw - 40px))` } : undefined}
        >
          <header className="modal-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Dialog.Title className="modal-title">{title}</Dialog.Title>
              {desc ? <Dialog.Description className="modal-desc">{desc}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <IconButton label="关闭" size="sm"><X size={16} /></IconButton>
            </Dialog.Close>
          </header>
          {children ? <div className="modal-body">{children}</div> : null}
          {footer ? <footer className="modal-foot">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
