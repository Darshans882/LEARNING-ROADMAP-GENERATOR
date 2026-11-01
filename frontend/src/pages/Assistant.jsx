import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Bot, Compass, GraduationCap, Route, ShieldCheck, Sparkles, Target,
} from 'lucide-react'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import ChatPanel from '../components/ChatPanel'
import { Badge, Card, PageHeader, ProgressBar } from '../components/ui'
import toast from 'react-hot-toast'

const ABILITIES = [
  {
    icon: Route,
    title: 'Explain your next step',
    body: 'It reads your roadmap order, prerequisites and completed nodes before answering.',
  },
  {
    icon: Target,
    title: 'Break down skill gaps',
    body: 'Missing skills and their required levels come from the stored skill analysis, not guesses.',
  },
  {
    icon: Compass,
    title: 'Use the verified catalogue',
    body: 'Course links are pulled from the database. Unverified catalogue/search pages are labelled.',
  },
  {
    icon: GraduationCap,
    title: 'Plan around your time',
    body: 'Weekly capacity, assignment overhead and milestones are taken from your planner.',
  },
]

export default function Assistant() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.get('/students/roadmap-summary'), api.get('/students/profile')])
      .then(([summaryResult, profileResult]) => {
        if (cancelled) return
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data)
        if (profileResult.status === 'fulfilled') setProfile(profileResult.value.data)
      })
      .catch((error) => toast.error(errorMessage(error)))
    return () => {
      cancelled = true
    }
  }, [])

  const targetRole = profile?.desired_role || summary?.career_goal
  const progress = Number(summary?.progress_percent) || 0

  return (
    <>
      <PageHeader
        eyebrow="AI Assistant"
        title="Ask about your learning plan"
        description="A grounded assistant that only uses your saved profile, roadmap, progress and the course catalogue. It never invents links, prices, ratings or progress."
        actions={
          <Link to="/roadmap" className="btn-secondary">
            <Route className="h-4 w-4" /> Open roadmap
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[calc(100vh-12.5rem)] min-h-[580px]">
          <ChatPanel full />
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-br from-brand-600 to-violet-700 px-4 py-4 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/80">
                <Sparkles className="h-3.5 w-3.5" /> Grounded context
              </div>
              <p className="mt-1 text-lg font-bold">{user?.full_name || 'Learner'}</p>
              <p className="text-xs text-white/75">{targetRole || 'No career goal selected yet'}</p>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Roadmap progress</span>
                <span className="font-bold text-slate-900">{progress.toFixed(0)}%</span>
              </div>
              <ProgressBar value={progress} className="mt-2" tone={progress >= 100 ? 'emerald' : 'brand'} />
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Current phase</dt>
                  <dd className="font-medium text-slate-800">{summary?.current_phase || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Expected completion</dt>
                  <dd className="font-medium text-slate-800">{summary?.expected_completion || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Weekly capacity</dt>
                  <dd className="font-medium text-slate-800">
                    {profile?.hours_per_day && profile?.days_per_week
                      ? `${profile.hours_per_day}h × ${profile.days_per_week} days`
                      : 'Not set'}
                  </dd>
                </div>
              </dl>
              {!summary?.has_roadmap ? (
                <Link
                  to="/onboarding"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  Complete onboarding <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  to="/planner"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  View this week plan <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Bot className="h-4 w-4 text-brand-600" /> What it can do
            </h3>
            <ul className="mt-3 space-y-3">
              {ABILITIES.map((ability) => (
                <li key={ability.title} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <ability.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{ability.title}</p>
                    <p className="text-[11px] leading-relaxed text-slate-500">{ability.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-900">Honesty rules</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-800">
              The assistant may say &ldquo;I don&rsquo;t know&rdquo;. It will not fabricate a course, URL, rating,
              completion percentage or milestone. Always confirm details on the provider page.
            </p>
            <Badge tone="emerald" className="mt-2">Course links come from the catalogue</Badge>
          </Card>
        </aside>
      </div>
    </>
  )
}
