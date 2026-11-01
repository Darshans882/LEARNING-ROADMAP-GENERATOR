import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CheckCircle2, CircleDot, Compass,
  Layers, Lightbulb, Loader2, Target, TrendingUp, TriangleAlert,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import toast from 'react-hot-toast'
import api, { errorMessage, titleCase } from '../api/client'
import {
  Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, ProgressBar, Select,
} from '../components/ui'

function ScoreRing({ value, label = 'Role readiness' }) {
  const rounded = Math.round(value || 0)
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-32 w-32 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#4f46e5 ${rounded * 3.6}deg, #e2e8f0 0deg)` }}
      >
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
          <span className="text-3xl font-extrabold tracking-tight text-slate-900">{rounded}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ready</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{label}</p>
    </div>
  )
}

export default function SkillAnalysis() {
  const [analysis, setAnalysis] = useState(null)
  const [matches, setMatches] = useState([])
  const [roles, setRoles] = useState([])
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)

  const loadAnalysis = useCallback(async (nextRoleId, quiet = false) => {
    if (!quiet) setSwitching(true)
    try {
      const params = nextRoleId ? { role_id: nextRoleId } : {}
      const { data } = await api.get('/students/analysis', { params })
      setAnalysis(data)
      setRoleId(data.role_id)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not analyze this role.'))
    } finally {
      setSwitching(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [analysisResponse, matchesResponse, rolesResponse] = await Promise.all([
          api.get('/students/analysis'),
          api.get('/students/career-matches', { params: { limit: 6 } }).catch(() => ({ data: [] })),
          api.get('/careers'),
        ])
        if (cancelled) return
        setAnalysis(analysisResponse.data)
        setRoleId(analysisResponse.data.role_id)
        setMatches(matchesResponse.data || [])
        setRoles(rolesResponse.data || [])
      } catch (error) {
        toast.error(errorMessage(error, 'Could not load your skill analysis.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const radarData = useMemo(
    () => (analysis?.gaps_by_category || []).map((item) => ({
      category: titleCase(item.category),
      current: item.current,
      required: item.required,
    })),
    [analysis],
  )

  async function handleRoleChange(value) {
    setRoleId(value)
    if (value) await loadAnalysis(value)
  }

  async function makeGoal() {
    if (!analysis) return
    setSavingGoal(true)
    try {
      await api.put('/students/profile', { career_role_id: analysis.role_id })
      toast.success(`${analysis.role_title} set as your career goal. Your roadmap was regenerated.`)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update your career goal.'))
    } finally {
      setSavingGoal(false)
    }
  }

  if (loading) return <Loading label="Analyzing your skills against the role requirements…" />

  if (!analysis) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Analysis unavailable"
        description="Choose a career goal in your profile, then reload this page."
        action={<Link to="/profile" className="btn-primary">Open profile</Link>}
      />
    )
  }

  const coverage = analysis.total_required ? Math.round((analysis.total_matched / analysis.total_required) * 100) : 0

  return (
    <>
      <PageHeader
        eyebrow="Skill gap analysis"
        title={`Readiness for ${analysis.role_title}`}
        description={analysis.summary}
        actions={
          <>
            <Select value={roleId} onChange={(event) => handleRoleChange(event.target.value)} className="min-w-[230px]">
              {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.title}</option>)}
            </Select>
            <Button onClick={makeGoal} loading={savingGoal} icon={Target}>Use as my goal</Button>
          </>
        }
      />

      {switching ? <div className="mb-4 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Recalculating against the selected role…</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="flex flex-col items-center justify-center p-6">
          <ScoreRing value={analysis.readiness} />
          <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-lg font-extrabold text-slate-900">{analysis.total_matched}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Matched</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-lg font-extrabold text-slate-900">{analysis.missing_skills.length}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Gaps</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-lg font-extrabold text-slate-900">{coverage}%</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Coverage</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            <Badge tone="brand">{analysis.current_level} → {analysis.target_level}</Badge>
            <Badge tone="slate">{analysis.total_required} required skills</Badge>
          </div>
          <Link to="/roadmap" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
            See these gaps in your roadmap <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Skills by category</h3>
              <p className="text-xs text-slate-500">Evidenced skills vs the target role requirement.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          {radarData.length ? (
            <ResponsiveContainer width="100%" height={290}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Radar name="You" dataKey="current" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.35} />
                <Radar name="Required" dataKey="required" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <div className="flex h-[290px] items-center justify-center text-xs text-slate-400">No category data.</div>}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900">Your strengths</h3>
            <Badge tone="emerald" className="ml-auto">{analysis.matched_skills.length}</Badge>
          </div>
          {analysis.matched_skills.length ? (
            <div className="flex flex-wrap gap-2">
              {analysis.matched_skills.map((skill) => (
                <span key={skill.skill_id} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> {skill.skill_name}
                  <span className="text-[10px] text-emerald-500">{titleCase(skill.level)}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="py-5 text-xs text-slate-400">
              No skills are evidenced yet. Add programming languages, frameworks and coursework
              in your profile to get credit.
            </p>
          )}
          {analysis.strengths?.length ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Highlights</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {analysis.strengths.slice(0, 5).map((item) => (
                  <li key={item} className="flex gap-1.5"><CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-brand-400" />{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Gap breakdown by category</h3>
          </div>
          <div className="space-y-3">
            {(analysis.gaps_by_category || []).map((item) => {
              const missing = Math.max(0, (item.required || 0) - (item.current || 0))
              return (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{titleCase(item.category)}</span>
                    <span className="text-slate-500">{item.current}/{item.required} · {Math.round(item.coverage)}%</span>
                  </div>
                  <ProgressBar value={item.coverage} tone={item.coverage >= 80 ? 'emerald' : item.coverage >= 40 ? 'brand' : 'amber'} />
                  {missing ? <p className="mt-0.5 text-[10px] text-slate-400">{missing} skill{missing > 1 ? 's' : ''} still missing</p> : null}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-slate-900">Missing skills & prerequisites</h3>
          <Badge tone="amber" className="ml-auto">{analysis.missing_skills.length} gaps</Badge>
        </div>
        {analysis.missing_skills.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {analysis.missing_skills.map((skill) => (
              <div key={skill.skill_id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{skill.skill_name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{titleCase(skill.category)} · {titleCase(skill.level)}</p>
                  </div>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Target className="h-3.5 w-3.5" />
                  </span>
                </div>
                {skill.reason ? <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{skill.reason}</p> : null}
                {skill.missing_prerequisites?.length ? (
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-amber-700">
                    <TriangleAlert className="h-3 w-3" /> Needs first: {skill.missing_prerequisites.join(', ')}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <Alert tone="success" title="No skill gaps for this role">
            Your profile evidences every required skill. Regenerate your roadmap to focus on
            advanced projects and the final checkpoint.
          </Alert>
        )}
      </Card>

      {analysis.prerequisites?.length ? (
        <Card className="mt-6 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Prerequisite path</h3>
            <p className="ml-auto text-xs text-slate-400">Learn these before the target skill</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.prerequisites.slice(0, 12).map((item, index) => (
              <div key={`${item.skill_id || index}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{item.skill_name || item.skill_id || 'Skill'}</span>
                {item.prerequisite_name ? <span className="text-slate-400"> ← after {item.prerequisite_name}</span> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Compass className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-slate-900">Career matches from your current profile</h3>
          <Link to="/careers" className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-700">Explore careers</Link>
        </div>
        {matches.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <div key={match.role.role_id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{match.role.title}</p>
                    <p className="text-[11px] text-slate-500">{match.role.category}</p>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">{Math.round(match.match_score)}%</span>
                </div>
                <ProgressBar value={match.match_score} className="mt-3" />
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{match.reasons?.[0] || match.role.description}</p>
                {match.missing_skills?.length ? (
                  <p className="mt-2 text-[10px] text-slate-400">{match.missing_skills.length} skills to add</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : <p className="py-5 text-center text-xs text-slate-400">No career matches available yet.</p>}
      </Card>
    </>
  )
}
