import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { CircleAlert } from 'lucide-react'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {error ? (
        <span className="field-error"><CircleAlert size={13} />{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={['input', className].filter(Boolean).join(' ')} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={['select', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={['textarea', className].filter(Boolean).join(' ')} {...rest} />
}
