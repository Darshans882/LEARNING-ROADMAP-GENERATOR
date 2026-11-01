import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, BookOpen, CalendarDays, CalendarRange, CheckCircle2, ChevronDown,
  ChevronRight, Clock, FolderKanban, Gauge, Layers, Sparkles,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'
import api, { errorMessage, formatDate, titleCase } from '../api/client'
import {
  Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, ProgressBar, StatCard,
  StatusBadge, Tabs,
} from '../components/ui'

const TYPE_ICON = { course: BookOpen, project: FolderKanban, assessment: CheckCircle2 }

function WeekCard({ week, open, onToggle, current }) {
  const completed = (week.items || []).filter((item) => item.status === 'completed').length
  const total = week.items?.length || 0
  return (
    <Card className={`overflow-hidden ${current ? 'border-brand-300 ring-1 ring-brand-200' : ''}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-[9px] font-bold uppercase ${current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          <span className="text-[8px]">week</span>
          <span className="text-sm leading-none">{week.week}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">Week {week.week}</p>
            {current ? <Badge tone="brand">This week</Badge> : null}
            <Badge tone="slate" icon={Clock}>{week.planned_hours}h / {week.capacity_hours}h</Badge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{week.focus}</p>
          <p className="text-[10px] text-slate-400">{formatDate(week.start_date)} → {formatDate(week.end_date)}</p>
        </div>
        <div className="hidden w-28 sm:block">
          <ProgressBar value={total ? (completed / total) * 100 : 0} tone={completed === total && total ? 'emerald' : 'brand'} />
          <p className="mt-1 text-right text-[10px] text-slate-400">{completed}/{total} done</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {week.items?.length ? (
            <div className="space-y-2">
              {week.items.map((item) => {
                const Icon = TYPE_ICON[item.type] || BookOpen
                return (
                  <div key={`${item.node_key}-${item.type}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{item.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {titleCase(item.type)} · Phase {item.phase} · {item.hours}h
                        {item.continues ? ' · continued' : ''}{item.finishes ? ' · finishes' : ''}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs text-slate-400"><Sparkles className="h-3.5 w-3.5" /> Rest, revision and consolidation week.</p>
          )}
        </div>
      ) : null}
    </Card>
  )
}

function MonthCard({ month }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">{month.label}</p>
        <Badge tone="slate" icon={Clock}>{month.hours}h</Badge>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">Weeks {month.weeks?.join(', ')}</p>
      {month.milestone ? (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-slate-600">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {month.milestone}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-400">Building towards the next milestone.</p>
      )}
    </div>
  )
}

export default function Planner() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openWeek, setOpenWeek] = useState(null)
  const [view, setView] = useState('all')

  useEffect(() => {
    let cancelled = false
    api.get('/progress/planner')
      .then(({ data: payload }) => {
        if (cancelled) return
        setData(payload)
        setOpenWeek(payload.current_week || 1)
      })
      .catch((error) => toast.error(errorMessage(error, 'Could not load your study plan.')))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const weeks = useMemo(() => {
    if (!data?.weeks) return []
    if (view === 'current') return data.weeks.filter((week) => week.week >= (data.current_week || 1))
    if (view === 'upcoming') return data.weeks.filter((week) => week.week > (data.current_week || 1))
    return data.weeks
  }, [data, view])

  const chartData = useMemo(
    () => (data?.weeks || []).slice(0, 16).map((week) => ({
      week: `W${week.week}`,
      planned: week.planned_hours,
      capacity: week.capacity_hours,
      completed: (week.items || []).filter((item) => item.status === 'completed').reduce((sum, item) => sum + item.hours, 0),
    })),
    [data],
  )

  if (loading) return <Loading label="Building your weekly study plan…" />

  if (!data || !data.weeks?.length) {
    return (
      <>
        <PageHeader eyebrow="Study planner" title="Your weekly plan" description="A week-by-week schedule generated from your roadmap and availability." />
        <EmptyState
          icon={CalendarRange}
          title="No study plan yet"
          description={data?.message || 'Generate a roadmap first and your weekly schedule will be built automatically.'}
          action={<Link to="/roadmap" className="btn-primary">Open roadmap</Link>}
        />
      </>
    )
  }

  const feasibility = data.feasibility || {}
  const currentWeek = data.weeks.find((week) => week.week === data.current_week)
  const totalHours = data.weeks.reduce((sum, week) => sum + (week.planned_hours || 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Study planner"
        title="Your weekly learning schedule"
        description="Generated from your roadmap hours, assignment/revision overhead and the time you said you can study."
        actions={<Link to="/progress" className="btn-secondary"><Gauge className="h-4 w-4" /> Track progress</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current week" value={`W${data.current_week} / ${data.total_weeks}`} hint={currentWeek ? currentWeek.focus : ''} icon={CalendarDays} />
        <StatCard label="Weekly capacity" value={`${data.capacity}h`} hint={`${data.hours_per_day}h/day × ${data.days_per_week} days`} icon={Gauge} tone="sky" />
        <StatCard label="Planned hours" value={`${Math.round(totalHours)}h`} hint={`${data.weeks.length} scheduled weeks`} icon={Clock} tone="violet" />
        <StatCard label="Feasibility" value={feasibility.on_track === false ? 'Tight' : 'On track'} hint={feasibility.required_hours_per_day ? `~${feasibility.required_hours_per_day}h/day needed` : 'Matches your capacity'} icon={AlertTriangle} tone={feasibility.on_track === false ? 'amber' : 'emerald'} />
      </div>

      {data.warnings?.length || feasibility.on_track === false ? (
        <div className="mt-4 space-y-2">
          {(data.warnings || []).map((warning) => <Alert key={warning} tone="warning" title="Plan note">{warning}</Alert>)}
          {feasibility.on_track === false ? (
            <Alert tone="info" title="Target date is aggressive">
              {feasibility.message} The planner still schedules content sequentially to avoid overlap.
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Planned vs capacity</h3>
            <Badge tone="slate" className="ml-auto">first 16 weeks</Badge>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="planned" name="Planned" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="capacity" name="Capacity" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Monthly milestones</h3>
          </div>
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {(data.months || []).map((month) => <MonthCard key={`${month.month}-${month.label}`} month={month} />)}
            {!data.months?.length ? <p className="text-xs text-slate-400">No monthly milestones.</p> : null}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'all', label: 'Full plan', count: data.weeks.length },
            { value: 'current', label: 'Current & upcoming' },
            { value: 'upcoming', label: 'Upcoming only' },
          ]}
        />
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpenWeek(openWeek ? null : data.current_week)}
          >
            {openWeek ? 'Collapse weeks' : 'Expand current week'}
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {weeks.map((week) => (
          <WeekCard
            key={week.week}
            week={week}
            current={week.week === data.current_week}
            open={openWeek === week.week}
            onToggle={() => setOpenWeek(openWeek === week.week ? null : week.week)}
          />
        ))}
      </div>
    </>
  )
}
