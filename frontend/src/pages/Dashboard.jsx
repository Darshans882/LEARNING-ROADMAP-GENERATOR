import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, ArrowRight, BookOpen, CalendarCheck2, CheckCircle2, Clock, Flame,
  FolderKanban, Gauge, Layers, Route as RouteIcon, Sparkles, Target, TrendingUp,
  TriangleAlert, Trophy,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import api, { errorMessage, formatDate, relativeTime } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Alert, Badge, Card, EmptyState, Loading, PageHeader, ProgressBar, StatCard, StatusBadge,
} from '../components/ui'
import toast from 'react-hot-toast'

const PIE_COLORS = ['#10b981', '#4f46e5', '#cbd5e1', '#f59e0b']

function ChartCard({ title, description, action, children, className = '' }) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function EmptyChart({ label = 'No data yet' }) {
  return <div className="flex h-[220px] items-center justify-center text-xs text-slate-400">{label}</div>
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: payload } = await api.get('/students/dashboard')
        if (!cancelled) setData(payload)
      } catch (error) {
        toast.error(errorMessage(error, 'Could not load your dashboard.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Loading label="Loading your learning dashboard…" />

  if (!data) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Dashboard unavailable"
        description="We could not load your dashboard. Refresh the page or check that the backend is running."
      />
    )
  }

  if (!data.has_roadmap) {
    return (
      <>
        <PageHeader
          eyebrow="Welcome"
          title={`Hi ${user?.full_name?.split(' ')[0] || 'there'} 👋`}
          description="Your profile is ready. Generate a personalized roadmap to unlock the dashboard, planner and progress charts."
          actions={<Badge tone="brand" icon={Sparkles}>Curated AI engine</Badge>}
        />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="relative overflow-hidden p-8">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand-50" />
            <div className="relative">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
                <RouteIcon className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">
                Build your first roadmap
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                {data.career_goal
                  ? `Your target is ${data.career_goal}. We will analyze your skill gaps and build phased courses, projects and checkpoints.`
                  : 'Pick a career goal, then let the engine sequence skills, courses, projects and checkpoints around your weekly availability.'}
              </p>
              <Link
                to="/roadmap"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Open roadmap generator <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-xs text-slate-400">
                Profile completeness: {data.profile_completeness ?? 0}%. You can add more detail in Profile.
              </p>
            </div>
          </Card>
          <div className="space-y-4">
            <StatCard label="Career goal" value={data.career_goal || 'Not selected'} hint="Change it anytime from Career Explorer" icon={Target} />
            <StatCard label="Profile completeness" value={`${data.profile_completeness ?? 0}%`} hint="Higher detail improves skill evidence" icon={Gauge} tone="emerald" />
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-900">Before you generate</p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> Confirm your weekly study hours in Profile.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> Add skills you already have to avoid redundant courses.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> Set a target date only if it is realistic — we check feasibility.</li>
              </ul>
            </Card>
          </div>
        </div>
      </>
    )
  }

  const charts = data.charts || {}
  const statusData = (charts.status_pie || []).filter((item) => item.value > 0)
  const radarData = (charts.skill_radar || []).map((item) => ({
    category: (item.category || '').replace('_', ' '),
    current: item.current,
    required: item.required,
  }))
  const phaseData = (charts.phase_progress || []).map((item) => ({
    name: item.phase,
    title: item.title,
    progress: item.progress,
    status: item.status,
  }))
  const weeklyData = charts.weekly_hours || []

  return (
    <>
      <PageHeader
        eyebrow={`${data.current_level || 'Learner'} → ${data.career_goal || 'target role'}`}
        title={`Welcome back, ${data.full_name?.split(' ')[0] || 'learner'}`}
        description={
          data.current_phase
            ? `You are in Phase ${data.current_phase}${data.current_phase_title ? ` — ${data.current_phase_title}` : ''}. ${data.skill_summary || ''}`
            : data.skill_summary || 'Keep going — your roadmap is active.'
        }
        actions={
          <>
            <Badge tone="brand" icon={Flame}>{data.total_weeks} weeks</Badge>
            <Link to="/roadmap" className="btn-primary">Open roadmap <ArrowRight className="h-4 w-4" /></Link>
          </>
        }
      />

      {data.warnings?.length ? (
        <Alert tone="warning" title="Schedule note" className="mb-5">
          <ul className="space-y-1">
            {data.warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Roadmap progress" value={`${data.progress_percent ?? 0}%`} hint={`${data.completed_courses}/${data.total_courses} courses completed`} icon={TrendingUp} />
        <StatCard label="Role readiness" value={`${Math.round(data.readiness ?? 0)}%`} hint={`${charts.skill_gap?.matched ?? 0} of ${charts.skill_gap?.total ?? 0} skills evidenced`} icon={Gauge} tone="emerald" />
        <StatCard label="Learning hours" value={`${Math.round(data.learning_hours?.completed ?? 0)}h`} hint={`of ${Math.round(data.learning_hours?.total ?? 0)}h total effort`} icon={Clock} tone="violet" />
        <StatCard label="Expected completion" value={formatDate(data.expected_completion)} hint={`Week ${data.current_week} of ${data.total_weeks}`} icon={CalendarCheck2} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current phase" value={data.current_phase ? `Phase ${data.current_phase}` : '—'} hint={data.current_phase_title || 'All phases complete'} icon={Layers} tone="sky" />
        <StatCard label="Courses remaining" value={data.pending_courses ?? 0} hint={`${data.completed_courses ?? 0} completed`} icon={BookOpen} />
        <StatCard label="Projects" value={`${data.completed_projects ?? 0}/${data.total_projects ?? 0}`} hint="Portfolio projects completed" icon={FolderKanban} tone="emerald" />
        <StatCard label="Plan feasibility" value={data.feasibility?.on_track ? 'On track' : 'Tight'} hint={data.feasibility?.message || 'Based on your weekly capacity'} icon={Activity} tone={data.feasibility?.on_track ? 'emerald' : 'amber'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Planned vs completed study hours"
          description="Next eight weeks based on course hours, assignments, revision and projects."
          action={<Badge tone="slate">{data.feasibility?.weekly_capacity ?? 0}h/week capacity</Badge>}
        >
          {weeklyData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="planned" name="Planned" fill="#c7d2fe" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Node status" description="Every phase, course, project and checkpoint.">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                  {statusData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard title="Skill coverage by category" description="Current evidenced skills vs the role requirement.">
          {radarData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Radar name="You" dataKey="current" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.35} />
                <Radar name="Required" dataKey="required" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Phase progress" description="Completion inside each roadmap phase." className="lg:col-span-2">
          {phaseData.length ? (
            <div className="space-y-3">
              {phaseData.map((phase) => (
                <div key={phase.name}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-slate-700">{phase.name}</span>
                      <span className="truncate text-slate-400">{phase.title}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-slate-600">{phase.progress}%</span>
                  </div>
                  <ProgressBar value={phase.progress} tone={phase.progress === 100 ? 'emerald' : phase.status === 'current' ? 'brand' : 'sky'} />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                <StatusBadge status="current" /> <span>current phase</span>
                <StatusBadge status="completed" /> <span>completed</span>
                <StatusBadge status="locked" /> <span>locked</span>
              </div>
            </div>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upcoming milestones</h3>
              <p className="text-xs text-slate-500">Phases and the final readiness review.</p>
            </div>
            <Link to="/progress" className="text-xs font-semibold text-brand-600 hover:text-brand-700">View progress</Link>
          </div>
          {data.upcoming_milestones?.length ? (
            <ul className="space-y-3">
              {data.upcoming_milestones.map((item) => (
                <li key={`${item.title}-${item.week}`} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <CalendarCheck2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Week {item.week} · {formatDate(item.due)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-xs text-slate-400">All milestones completed.</p>}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
              <p className="text-xs text-slate-500">Real completions recorded in your account.</p>
            </div>
            <Link to="/progress" className="text-xs font-semibold text-brand-600 hover:text-brand-700">All activity</Link>
          </div>
          {data.recent_activity?.length ? (
            <ul className="space-y-3">
              {data.recent_activity.map((item) => (
                <li key={`${item.title}-${item.date}`} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.type === 'project' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {item.type === 'project' ? <FolderKanban className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700">{item.title}</p>
                    <p className="text-xs text-slate-400">{relativeTime(item.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              No completions yet. Mark your first course complete from the roadmap.
            </div>
          )}
          <Link to="/courses" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
            Browse recommended courses <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      {charts.monthly_progress?.length ? (
        <ChartCard className="mt-6" title="Monthly effort plan" description="Planned study hours and the phase milestone due each month.">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={charts.monthly_progress} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="monthlyHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                formatter={(value, name) => [name === 'hours' ? `${value}h` : value, name === 'hours' ? 'Planned hours' : 'Milestone']}
              />
              <Area type="monotone" dataKey="hours" stroke="#4f46e5" strokeWidth={2} fill="url(#monthlyHours)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </>
  )
}
