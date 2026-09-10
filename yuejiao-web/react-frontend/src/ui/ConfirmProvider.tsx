import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal } from '@/ui/Modal'
import { Button } from '@/ui/Button'

export interface ConfirmOptions {
  title: ReactNode
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: 'default' | 'danger'
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm 必须在 ConfirmProvider 内使用')
  return confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOptions(next)
        setOpen(true)
      }),
    [],
  )

  const settle = useCallback((result: boolean) => {
    setOpen(false)
    resolver.current?.(result)
    resolver.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {options?.cancelText ?? '取消'}
            </Button>
            <Button
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => settle(true)}
            >
              {options?.confirmText ?? '确认'}
            </Button>
          </>
        }
      >
        {options?.description ? (
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-3)' }}>{options.description}</p>
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  )
}
