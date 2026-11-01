import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { Button, Field } from '../components/ui'
import Logo from '../components/Logo'
import { errorMessage } from '../api/client'

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { key: 'letter', label: 'Contains a letter', test: (value) => /[a-zA-Z]/.test(value) },
  { key: 'number', label: 'Contains a number', test: (value) => /\d/.test(value) },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const checks = useMemo(
    () => RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password],
  )
  const passwordValid = checks.every((check) => check.passed)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const nextErrors = {}
    if (form.full_name.trim().length < 2) nextErrors.full_name = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!passwordValid) nextErrors.password = 'Your password does not meet the requirements below.'
    if (form.password !== form.confirm) nextErrors.confirm = 'Passwords do not match.'
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors)
      return
    }

    setLoading(true)
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      toast.success('Account created. Let’s build your profile.')
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:px-8">
        <div className="hidden lg:block">
          <Link to="/"><Logo size="lg" /></Link>
          <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-slate-900">
            Your next role, planned in phases that actually fit your life.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-500">
            Onboarding takes about five minutes. We ask about your academics, current skills,
            career goal, experience and weekly study capacity — then generate a roadmap grounded
            in a stored catalogue of courses and projects.
          </p>
          <div className="mt-8 space-y-4">
            {[
              ['Grounded recommendations', 'Courses come from the catalogue with verification badges — never invented.'],
              ['Real duration maths', 'Study hours include assignments, revision, projects and your weekly availability.'],
              ['You stay in control', 'Edit your profile or change your goal at any time; your roadmap regenerates.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-sm text-slate-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs text-brand-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Passwords are hashed with bcrypt. Demo accounts are available on the sign-in page.
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-6 lg:hidden">
            <Link to="/"><Logo /></Link>
          </div>
          <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
            <Sparkles className="h-3.5 w-3.5" /> Step 1 of 2
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Then we’ll build your learner profile and first roadmap.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            <Field label="Full name" required error={fieldErrors.full_name}>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.full_name}
                  onChange={(event) => update('full_name', event.target.value)}
                  placeholder="e.g. Priya Raman"
                  autoComplete="name"
                  className="input pl-10"
                />
              </div>
            </Field>

            <Field label="Email address" required error={fieldErrors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="input pl-10"
                />
              </div>
            </Field>

            <Field label="Password" required error={fieldErrors.password}>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className="input pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <div className="grid gap-1.5 sm:grid-cols-3">
              {checks.map((check) => (
                <span
                  key={check.key}
                  className={`inline-flex items-center gap-1.5 text-[11px] ${check.passed ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {check.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {check.label}
                </span>
              ))}
            </div>

            <Field label="Confirm password" required error={fieldErrors.confirm}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirm}
                onChange={(event) => update('confirm', event.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className="input"
              />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Create account <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
