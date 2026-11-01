import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, ShieldCheck, X, Info } from 'lucide-react'

export function cn(...values) {
  return values.filter(Boolean).join(' ')
}

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className = '',
  type = 'button',
  ...props
}) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' }
  return (
    <button
      type={type}
      className={cn(VARIANTS[variant] || VARIANTS.primary, sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  )
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function Badge({ children, tone = 'slate', className = '', icon: Icon }) {
  return (
    <span className={cn('chip border', TONES[tone] || TONES.slate, className)}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    completed: { tone: 'emerald', label: 'Completed', icon: CheckCircle2 },
    current: { tone: 'brand', label: 'In progress', icon: Loader2 },
    in_progress: { tone: 'brand', label: 'In progress', icon: Loader2 },
    pending: { tone: 'slate', label: 'Pending' },
    not_started: { tone: 'slate', label: 'Not started' },
    locked: { tone: 'amber', label: 'Locked' },
    active: { tone: 'emerald', label: 'Active' },
    archived: { tone: 'slate', label: 'Archived' },
    failed: { tone: 'rose', label: 'Failed' },
  }
  const item = map[status] || { tone: 'slate', label: status || 'Unknown' }
  return (
    <Badge tone={item.tone} icon={item.icon}>
      {item.label}
    </Badge>
  )
}

export function VerifiedBadge({ verified, linkType = 'direct', className = '' }) {
  const isDirect = verified && linkType === 'direct'
  return (
    <Badge tone={isDirect ? 'emerald' : 'amber'} className={className} icon={isDirect ? ShieldCheck : AlertCircle}>
      {isDirect ? 'Verified direct page' : linkType === 'search' ? 'Catalogue search — verify' : 'Catalogue link — verify'}
    </Badge>
  )
}

export function ProgressBar({ value = 0, className = '', tone = 'brand', showLabel = false }) {
  const tones = {
    brand: 'bg-brand-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
  }
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? <p className="mt-1 text-right text-xs font-medium text-slate-500">{clamped.toFixed(0)}%</p> : null}
    </div>
  )
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cn(className, 'animate-spin text-brand-600')} />
}

export function Loading({ label = 'Loading…', className = '' }) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-500', className)}>
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className = '' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </Card>
  )
}

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <div className={className}>
      {label ? (
        <label className="label">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  )
}

export function Select({ children, className = '', ...props }) {
  return (
    <div className="relative">
      <select className={cn('input appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

export function Textarea({ className = '', rows = 3, ...props }) {
  return <textarea rows={rows} className={cn('input resize-y', className)} {...props} />
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Type and press Enter',
  suggestions = [],
  id,
}) {
  const [draft, setDraft] = useState('')
  const list = Array.isArray(value) ? value : []
  const suffix = id ? `${id}-listbox` : undefined

  function add(raw) {
    const items = String(raw)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!items.length) return
    const next = [...list]
    items.forEach((item) => {
      if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) next.push(item)
    })
    onChange(next)
    setDraft('')
  }

  function remove(item) {
    onChange(list.filter((existing) => existing !== item))
  }

  return (
    <div>
      <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
        {list.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
          >
            {item}
            <button type="button" onClick={() => remove(item)} className="text-brand-400 hover:text-brand-700" aria-label={`Remove ${item}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          list={suffix}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add(draft)
            } else if (event.key === 'Backspace' && !draft && list.length) {
              remove(list[list.length - 1])
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={list.length ? 'Add another…' : placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      </div>
      {suggestions.length ? (
        <datalist id={suffix}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      {suggestions.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={cn('max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', sizes[size])}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center', className)}>
      {Icon ? (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon className="h-7 w-7" />
        </span>
      ) : null}
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Alert({ tone = 'info', title, children, className = '', action }) {
  const tones = {
    info: { wrap: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info, iconClass: 'text-sky-500' },
    warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertCircle, iconClass: 'text-amber-500' },
    success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, iconClass: 'text-emerald-500' },
    danger: { wrap: 'border-rose-200 bg-rose-50 text-rose-900', icon: AlertCircle, iconClass: 'text-rose-500' },
  }
  const toneConfig = tones[tone] || tones.info
  const Icon = toneConfig.icon
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', toneConfig.wrap, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', toneConfig.iconClass)} />
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-0.5', 'leading-relaxed')}>{children}</div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={cn('flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-600">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function useOutsideClick(callback) {
  const ref = useRef(null)
  useEffect(() => {
    function handler(event) {
      if (ref.current && !ref.current.contains(event.target)) callback(event)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [callback])
  return ref
}
