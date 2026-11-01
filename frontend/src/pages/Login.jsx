import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CheckCircle2, Eye, EyeOff,
  LockKeyhole, Mail, Route, ShieldCheck, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { Button, Field } from '../components/ui'
import Logo from '../components/Logo'
import { errorMessage } from '../api/client'

const HIGHLIGHTS = [
  { icon: BrainCircuit, text: 'Prerequisite-aware skill gap analysis' },
  { icon: Route, text: 'Interactive React Flow roadmap' },
  { icon: BookOpen, text: '104 curated courses with honest link badges' },
  { icon: BarChart3, text: 'Progress, weekly plans and monthly milestones' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (searchParams.get('expired')) {
      toast.error('Your session expired. Please sign in again.')
    }
  }, [searchParams])

  function afterLogin(user) {
    const requested = location.state?.from
    if (user?.role === 'admin') {
      navigate(requested && requested !== '/login' ? requested : '/admin', { replace: true })
    } else if (!user?.onboarding_completed) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate(requested && requested !== '/login' ? requested : '/dashboard', { replace: true })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const user = await login(form.email.trim(), form.password)
      toast.success(`Welcome back, ${user.full_name?.split(' ')[0] || 'learner'}!`)
      afterLogin(user)
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed. Check your details and try again.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo() {
    setDemoLoading(true)
    try {
      const user = await login('demo@smartlearn.ai', 'Demo@1234')
      toast.success('Signed in to the demo workspace')
      afterLogin(user)
    } catch (err) {
      toast.error(errorMessage(err, 'Demo login failed. Is the backend running?'))
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-slate-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative">
          <Link to="/"><Logo light /></Link>
          <div className="mt-16 max-w-lg">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
              <Sparkles className="h-3.5 w-3.5" /> Personalized learning roadmap generator
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
              Stop guessing what to learn next.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Tell SmartLearn your skills and goals. Get a grounded, phase-by-phase roadmap
              with courses from a stored catalogue, real projects, checkpoints and a schedule
              that respects your weekly availability.
            </p>
            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                    <item.icon className="h-4 w-4 text-brand-300" />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="relative flex items-center gap-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Course links are never invented. Unverified pages are clearly marked.</span>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/"><Logo /></Link>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Sign in to SmartLearn AI</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Continue with your personalized roadmap, progress and assistant.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            <Field label="Email address" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="you@example.com"
                  className="input pl-10"
                />
              </div>
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="Your password"
                  className="input pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or try it instantly</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            loading={demoLoading}
            onClick={handleDemo}
            icon={Sparkles}
          >
            Explore the demo workspace
          </Button>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-600">Demo accounts</p>
            <p className="mt-1">Student: demo@smartlearn.ai · Demo@1234</p>
            <p>Admin: admin@smartlearn.ai · Admin@1234</p>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            New here?
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-slate-400">
            By continuing you agree that course details must be verified on the provider page.
          </p>
        </div>
      </div>
    </div>
  )
}
