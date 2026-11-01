import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, BookOpen, CalendarCheck2, CheckCircle2, Clock, FolderKanban, Layers,
  Loader2, RotateCcw, Target, TrendingUp,
} from 'lucide-react'
import {
  Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts'
import toast from 'react-hot-toast'
import api, { errorMessage, formatDate, relativeTime, titleCase } from '../api/client'
import {
  Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, ProgressBar, StatCard,
  StatusBadge, Tabs,
} from '../components/ui'

const STATUS_COLORS = {
  completed: '#10b981',
  current: '#4f46e5',
  pending: '#cbd5e1',
  locked: '#f59e0b',
}

const STATUS_ORDER = ['completed', 'current', 'pending', 'locked']

function PhaseProgress({ nodes }) {
  const phases = useMemo(() => {
    const map = new Map()
    nodes.forEach((node) => {
      if (!node.phase_number) return
      if (!map.has(node.phase_number)) map.set(node.phase_number, [])
      if (['course', 'project', 'assessment'].includes(node.node_type)) map.get(node.phase_number).push(node)
    })
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [nodes])

  if (!phases.length) return <p className="py-6 text-center text-xs text-slate-400">No phased steps recorded.</p>

  return (
    <div className="space-y-3">
      {phases.map(([phase, items]) => {
        const done = items.filter((item) => item.status === 'completed').length
        const percent = items.length ? Math.round((done / items.length) * 100) : 0
        return (
          <div key={phase}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Phase {phase}</span>
              <span className="text-slate-500">{done}/{items.length} steps · {percent}%</span>
            </div>
            <ProgressBar value={percent} tone={percent === 100 ? 'emerald' : percent > 0 ? 'brand' : 'slate'} />
          </div>
        )
      })}
    </div>
  )
}

export default function Progress() {
  const [data, setData] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('courses')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const [progressResponse, milestonesResponse, activityResponse] = await Promise.all([
        api.get('/progress'),
        api.get('/progress/milestones').catch(() => ({ data: [] })),
        api.get('/students/activity', { params: { limit: 15 } }).catch(() => ({ data: [] })),
      ])
      setData(progressResponse.data)
      setMilestones(milestonesResponse.data || [])
      setActivity(activityResponse.data || [])
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load progress.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const nodeCounts = useMemo(() => {
    const counts = { completed: 0, current: 0, pending: 0, locked: 0 }
    ;(data?.nodes || []).forEach((node) => {
      if (Object.prototype.hasOwnProperty.call(counts, node.status)) counts[node.status] += 1
    })
    return counts
  }, [data])

  const pieData = useMemo(
    () => STATUS_ORDER.map((status) => ({
      name: status === 'current' ? 'In progress' : titleCase(status),
      value: nodeCounts[status],
      status,
    })).filter((item) => item.value > 0),
    [nodeCounts],
  )

  async function resetCourse(row) {
    setBusy(`course-${row.course_id}`)
    try {
      await api.delete(`/progress/course/${row.course_id}`)
      toast.success('Course progress reset.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not reset this course.'))
    } finally {
      setBusy('')
    }
  }

  async function resetProject(row) {
    setBusy(`project-${row.project_id}`)
    try {
      await api.delete(`/progress/project/${row.project_id}`)
      toast.success('Project progress reset.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not reset this project.'))
    } finally {
      setBusy('')
    }
  }

  async function completeCourse(row) {
    setBusy(`course-${row.course_id}`)
    try {
      await api.post('/progress/course', { course_id: row.course_id, status: 'completed', progress_percent: 100 })
      toast.success('Course marked complete.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update this course.'))
    } finally {
      setBusy('')
    }
  }

  async function completeProject(row) {
    setBusy(`project-${row.project_id}`)
    try {
      await api.post('/progress/project', { project_id: row.project_id, status: 'completed' })
      toast.success('Project marked complete.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update this project.'))
    } finally {
      setBusy('')
    }
  }

  if (loading) return <Loading label="Loading your progress…" />

  if (!data) {
    return <EmptyState icon={Activity} title="Progress unavailable" description="Refresh the page or check that the API is running." />
  }

  const roadmap = data.roadmap
  const counts = data.counts || {}
  const hours = data.hours || {}

  return (
    <>
      <PageHeader
        eyebrow="Learning progress"
        title="Your momentum, tracked"
        description="Every completed course, project and checkpoint is recalculated against your roadmap. Reset an item if you want to redo it."
        actions={<Link to="/roadmap" className="btn-secondary"><Layers className="h-4 w-4" /> Open roadmap</Link>}
      />

      {!data.has_roadmap ? (
        <EmptyState
          icon={Target}
          title="No active roadmap"
          description="Generate a roadmap first, then your course and project progress will roll up here."
          action={<Link to="/roadmap" className="btn-primary">Open roadmap</Link>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Roadmap progress" value={`${Math.round(roadmap.progress_percent || 0)}%`} hint={roadmap.career_goal} icon={TrendingUp} />
            <StatCard label="Courses completed" value={`${counts.completed_courses || 0}/${counts.total_courses || 0}`} hint={`${counts.pending_courses || 0} remaining`} icon={BookOpen} tone="emerald" />
            <StatCard label="Projects completed" value={`${counts.completed_projects || 0}/${counts.total_projects || 0}`} hint="Portfolio artefacts" icon={FolderKanban} tone="violet" />
            <StatCard label="Learning hours" value={`${Math.round(hours.completed || 0)}h`} hint={`${Math.round(hours.remaining || 0)}h remaining of ${Math.round(hours.total || 0)}h`} icon={Clock} tone="amber" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <Card className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">Step status</h3>
                <Badge tone="slate" className="ml-auto">{data.nodes?.length || 0} nodes</Badge>
              </div>
              {pieData.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                      {pieData.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="py-12 text-center text-xs text-slate-400">No step data yet.</p>}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">Phase completion</h3>
                <span className="ml-auto text-[11px] text-slate-400">Current phase {roadmap.current_phase || '—'}</span>
              </div>
              <PhaseProgress nodes={data.nodes || []} />
            </Card>
          </div>

          <Card className="mt-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: 'courses', label: 'Courses', count: data.courses?.length || 0 },
                  { value: 'projects', label: 'Projects', count: data.projects?.length || 0 },
                  { value: 'steps', label: 'Roadmap steps', count: data.nodes?.length || 0 },
                  { value: 'milestones', label: 'Milestones', count: milestones.length },
                ]}
              />
            </div>

            <div className="p-4">
              {tab === 'courses' ? (
                data.courses?.length ? (
                  <div className="space-y-2">
                    {data.courses.map((row) => (
                      <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${row.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{row.course?.title || row.course_id}</p>
                          <p className="text-[11px] text-slate-500">
                            {row.course?.platform || 'Catalogue'} · {row.progress_percent || 0}% complete
                            {row.completed_at ? ` · completed ${formatDate(row.completed_at)}` : ''}
                          </p>
                          <ProgressBar value={row.progress_percent || (row.status === 'completed' ? 100 : 0)} className="mt-1.5 max-w-sm" tone={row.status === 'completed' ? 'emerald' : 'brand'} />
                        </div>
                        <StatusBadge status={row.status} />
                        <div className="flex items-center gap-1">
                          {row.status !== 'completed' ? (
                            <Button size="sm" variant="success" loading={busy === `course-${row.course_id}`} onClick={() => completeCourse(row)} icon={CheckCircle2}>
                              Complete
                            </Button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => resetCourse(row)}
                            disabled={busy === `course-${row.course_id}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title="Reset course progress"
                          >
                            {busy === `course-${row.course_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No course progress recorded yet.</p>
                    <Link to="/courses" className="mt-2 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-800">Browse the catalogue →</Link>
                  </div>
                )
              ) : null}

              {tab === 'projects' ? (
                data.projects?.length ? (
                  <div className="space-y-2">
                    {data.projects.map((row) => (
                      <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${row.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                          <FolderKanban className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{row.project?.title || row.project_id}</p>
                          <p className="text-[11px] text-slate-500">
                            {row.hours_spent ? `${row.hours_spent}h logged · ` : ''}
                            {row.repository_url ? (
                              <a href={row.repository_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 hover:underline">repository</a>
                            ) : 'no repository yet'}
                            {row.completed_at ? ` · completed ${formatDate(row.completed_at)}` : ''}
                          </p>
                          {row.notes ? <p className="mt-0.5 text-[11px] text-slate-400">{row.notes}</p> : null}
                        </div>
                        <StatusBadge status={row.status} />
                        <div className="flex items-center gap-1">
                          {row.status !== 'completed' ? (
                            <Button size="sm" variant="success" loading={busy === `project-${row.project_id}`} onClick={() => completeProject(row)} icon={CheckCircle2}>
                              Complete
                            </Button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => resetProject(row)}
                            disabled={busy === `project-${row.project_id}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title="Reset project progress"
                          >
                            {busy === `project-${row.project_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No project progress recorded yet.</p>
                    <Link to="/projects" className="mt-2 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-800">Find a project →</Link>
                  </div>
                )
              ) : null}

              {tab === 'steps' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(data.nodes || []).map((node) => (
                    <div key={node.node_key} className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${node.status === 'completed' ? 'bg-emerald-500' : node.status === 'current' ? 'bg-brand-500' : node.status === 'locked' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{node.title}</p>
                        <p className="text-[10px] text-slate-400">{titleCase(node.node_type)}{node.phase_number ? ` · Phase ${node.phase_number}` : ''}</p>
                      </div>
                      <StatusBadge status={node.status} />
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'milestones' ? (
                milestones.length ? (
                  <div className="space-y-2">
                    {milestones.map((milestone, index) => (
                      <div key={`${milestone.title}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${milestone.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          <CalendarCheck2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{milestone.title}</p>
                          <p className="text-[11px] text-slate-500">Due {formatDate(milestone.due)} · week {milestone.week}</p>
                        </div>
                        {typeof milestone.progress === 'number' ? (
                          <div className="w-28"><ProgressBar value={milestone.progress} showLabel /></div>
                        ) : null}
                        <StatusBadge status={milestone.status} />
                      </div>
                    ))}
                  </div>
                ) : <p className="py-8 text-center text-xs text-slate-400">No milestones yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="mt-6 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
              <Link to="/planner" className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-800">Study planner →</Link>
            </div>
            {activity.length ? (
              <div className="space-y-2">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <p className="flex-1 text-slate-600">
                      <span className="font-semibold text-slate-800">{titleCase(item.action)}</span>
                      {item.detail ? <span className="text-slate-500"> · {item.detail}</span> : null}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Alert tone="info">Activity appears here as you complete courses, projects and checkpoints.</Alert>
            )}
          </Card>
        </>
      )}
    </>
  )
}
