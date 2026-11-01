import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, BookOpen, Bot, BrainCircuit, CheckCircle2, Compass, GitBranch,
  GraduationCap, Map, Route, ShieldCheck, Sparkles, Target, TrendingUp, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import { Button } from '../components/ui'
import { errorMessage } from '../api/client'

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Real skill-gap analysis',
    body: 'Your profile is matched against role requirements and prerequisite graphs — not a generic quiz score.',
  },
  {
    icon: Route,
    title: 'Interactive roadmap',
    body: 'A React Flow flowchart with phases, branches, projects and checkpoints. Drag, zoom and track every node.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest course catalogue',
    body: 'Every course link comes from the stored catalogue. Unverified pages are clearly marked — never invented.',
  },
  {
    icon: BarChart3,
    title: 'Progress you can trust',
    body: 'Weekly plans, monthly milestones and charts computed from your real learning records.',
  },
  {
    icon: Bot,
    title: 'Grounded AI assistant',
    body: 'A context-aware assistant that sees your roadmap and selected node — and refuses to invent facts.',
  },
  {
    icon: Compass,
    title: '17 career paths',
    body: 'From data science and full-stack to UX, cybersecurity, marketing and mechanical engineering.',
  },
]

const STEPS = [
  { number: '01', title: 'Tell us about you', body: 'Personal, academic, skills, goals, experience and weekly availability.' },
  { number: '02', title: 'See your gap', body: 'A prerequisite-aware analysis of what you know and what the role actually needs.' },
  { number: '03', title: 'Follow your roadmap', body: 'Phases, verified courses, assignments, projects and checkpoints — updated as you progress.' },
]

const STATS = [
  { value: '104', label: 'curated courses' },
  { value: '173', label: 'mapped skills' },
  { value: '17', label: 'career roles' },
  { value: '28', label: 'portfolio projects' },
]

export default function Landing() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [demoLoading, setDemoLoading] = useState(false)

  async function tryDemo() {
    setDemoLoading(true)
    try {
      await login('demo@smartlearn.ai', 'Demo@1234')
      toast.success('Signed in to the demo workspace')
      navigate('/dashboard')
    } catch (error) {
      toast.error(errorMessage(error, 'Demo login failed. Is the backend running?'))
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-brand-700">Features</a>
            <a href="#how" className="hover:text-brand-700">How it works</a>
            <a href="#honesty" className="hover:text-brand-700">Our data promise</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">Sign in</Link>
            <Link to="/register" className="btn-primary">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_10%,rgba(99,102,241,0.14),transparent),radial-gradient(40%_40%_at_10%_50%,rgba(139,92,246,0.10),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> AI + RAG, grounded in a real catalogue
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              A learning roadmap that <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">actually fits you</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              SmartLearn AI turns your skills, goals and available hours into a phased roadmap with
              honest course links, assignments, projects and a weekly plan — then adapts as you progress.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary px-6 py-3 text-base">
                Build my roadmap <ArrowRight className="h-5 w-5" />
              </Link>
              <Button variant="secondary" size="lg" loading={demoLoading} onClick={tryDemo} icon={Sparkles}>
                Explore the live demo
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No invented links or ratings</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Works without an API key</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> PostgreSQL ready</span>
            </div>
          </div>

          {/* Product mock */}
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-200/50 via-violet-200/40 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[11px] font-medium text-slate-400">smartlearn.ai / roadmap</span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active roadmap</p>
                    <p className="text-lg font-bold text-slate-900">Data Scientist</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">58% ready</span>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
                    <span>Overall progress</span><span className="font-semibold text-slate-700">34%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[34%] rounded-full bg-gradient-to-r from-brand-500 to-violet-500" /></div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { title: 'Phase 1 · Foundations', meta: '3 items · 1 complete', tone: 'bg-emerald-500', done: true },
                    { title: 'Phase 2 · Core analysis', meta: '4 items · in progress', tone: 'bg-brand-500', done: false },
                    { title: 'Phase 3 · Machine learning', meta: 'locked until Phase 2', tone: 'bg-slate-300', done: false },
                  ].map((row) => (
                    <div key={row.title} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${row.tone}`}>
                        {row.done ? <CheckCircle2 className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-800">{row.title}</p>
                        <p className="text-[10px] text-slate-400">{row.meta}</p>
                      </div>
                      <ChevronArrow />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-brand-50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-brand-500">This week</p>
                    <p className="text-base font-bold text-brand-900">12.5 / 15h</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-violet-500">Next milestone</p>
                    <p className="text-base font-bold text-violet-900">Nov 28</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck className="h-4 w-4" /></span>
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Verified links only</p>
                  <p className="text-[10px] text-slate-400">Catalogue marked when unverified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/70">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-slate-900">{stat.value}</p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Built for real learning</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Everything a plan needs to survive contact with reality</h2>
          <p className="mt-3 text-slate-600">Not another static course list. A working system that analyses, plans, tracks and adapts.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="bg-slate-900 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-300">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Three steps from “I don’t know where to start” to a real plan</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-3xl font-extrabold text-brand-300">{step.number}</p>
                <h3 className="mt-3 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-primary bg-brand-500 px-6 py-3 text-base hover:bg-brand-400">Start free</Link>
            <Button variant="secondary" onClick={tryDemo} loading={demoLoading} icon={Users} className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Use the demo account
            </Button>
          </div>
        </div>
      </section>

      <section id="honesty" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Our data promise</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">We would rather say “verify this” than invent a fact</h2>
            <p className="mt-4 text-slate-600">
              Course URLs, prices, ratings and durations are only shown from the curated catalogue.
              Where a stable direct course page cannot be confirmed, the link is stored as a catalogue
              or search page and clearly flagged in every screen, roadmap node and assistant answer.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'No generated URLs, prices, ratings or completion claims',
                'Missing values stay blank instead of being guessed',
                'Live URL validation available for admins (with SSRF protection)',
                'The AI assistant is constrained to your stored records',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-soft">
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" /> Verified direct page</div>
                <p className="mt-1 text-sm text-emerald-900">freeCodeCamp — Data Analysis with Python</p>
                <p className="mt-1 text-[11px] text-emerald-700">freecodecamp.org · Free · official curriculum page</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800"><Target className="h-4 w-4" /> Catalogue link — verify before enrolling</div>
                <p className="mt-1 text-sm text-amber-900">Coursera — Machine Learning catalogue</p>
                <p className="mt-1 text-[11px] text-amber-700">Course details, price and duration must be confirmed on the provider page.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><TrendingUp className="h-4 w-4 text-brand-500" /> Missing data</div>
                <p className="mt-1 text-sm text-slate-600">Rating: <span className="font-semibold">not published</span> · Duration: <span className="font-semibold">estimate</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-gradient-to-br from-brand-50 via-white to-violet-50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <GraduationCap className="mx-auto h-10 w-10 text-brand-600" />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Your next phase starts with an honest baseline.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Create a profile in a few minutes, see your real skill gap, and get a roadmap your future self can actually follow.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">Create my account <ArrowRight className="h-5 w-5" /></Link>
            <Link to="/login" className="btn-secondary px-6 py-3 text-base">I already have an account</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <Logo size="sm" />
          <p>Built with React, FastAPI, SQLAlchemy, scikit-learn, LangChain & Chroma-ready RAG.</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-brand-700">Sign in</Link>
            <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer" className="hover:text-brand-700">API docs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ChevronArrow() {
  return (
    <span className="text-slate-300">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
    </span>
  )
}
