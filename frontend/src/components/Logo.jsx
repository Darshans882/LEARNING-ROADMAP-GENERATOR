import { GraduationCap } from 'lucide-react'

export default function Logo({ size = 'md', light = false, compact = false }) {
  const sizes = {
    sm: { box: 'h-8 w-8', icon: 'h-4 w-4', text: 'text-base' },
    md: { box: 'h-10 w-10', icon: 'h-5 w-5', text: 'text-lg' },
    lg: { box: 'h-12 w-12', icon: 'h-6 w-6', text: 'text-xl' },
  }
  const s = sizes[size] || sizes.md
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex ${s.box} items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/20`}
      >
        <GraduationCap className={s.icon} />
      </span>
      {!compact ? (
        <span className={`${s.text} font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
          SmartLearn <span className={light ? 'text-brand-300' : 'text-brand-600'}>AI</span>
        </span>
      ) : null}
    </div>
  )
}
