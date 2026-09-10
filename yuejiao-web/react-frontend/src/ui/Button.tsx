import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block ? 'btn--block' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <LoaderCircle size={size === 'sm' ? 13 : 15} className="spinner" /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md'
  tipSide?: 'bottom' | 'left'
}

export function IconButton({ label, size = 'md', tipSide, className, ...rest }: IconButtonProps) {
  const classes = [
    'icon-btn',
    size === 'sm' ? 'icon-btn--sm' : '',
    tipSide === 'left' ? 'tip-left' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" aria-label={label} title={label} className={classes} {...rest} />
}
