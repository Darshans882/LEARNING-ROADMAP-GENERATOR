import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Award, BookOpen, Briefcase, CheckCircle2, Compass, ExternalLink,
  GraduationCap, Layers, Loader2, Search, Sparkles, Target, TrendingUp, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage, pretty, titleCase } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, ProgressBar,
  Select, VerifiedBadge,
} from '../components/ui'

function MatchCard({ match, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-brand-300 bg-brand-50/60 shadow-sm ring-2 ring-brand-200'
          : 'border-slate-200 bg-white hover:border-brand-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{match.role.title}</p>
          <p className="text-[11px] text-slate-500">{match.role.category}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-extrabold text-brand-700 ring-1 ring-brand-100">
          {Math.round(match.match_score)}%
        </span>
      </div>
      <ProgressBar
        value={match.match_score}
        tone={match.match_score >= 70 ? 'emerald' : match.match_score >= 40 ? 'brand' : 'amber'}
        className="mt-3"
      />
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
        {match.reasons?.[0] || match.role.description}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {match.matched_skills?.length || 0} matched
        </span>
        <span className="inline-flex items-center gap-1">
          <Target className="h-3 w-3 text-amber-500" /> {match.missing_skills?.length || 0} gaps
        </span>
      </div>
    </button>
  )
}

function RoleCard({ role, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        active ? 'border-brand-300 bg-brand-50/70' : 'border-slate-200 bg-white hover:border-brand-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{role.title}</p>
          <p className="text-[11px] text-slate-500">{role.category}</p>
        </div>
        <Badge tone={active ? 'brand' : 'slate'}>{role.required_skills?.length || 0} skills</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{role.description}</p>
    </button>
  )
}

export default function CareerExploration() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [courses, setCourses] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [rolesResponse, matchesResponse, profileResponse] = await Promise.all([
          api.get('/careers'),
          api.get('/careers/matches', { params: { limit: 8 } }).catch(() => ({ data: [] })),
          api.get('/students/profile').catch(() => ({ data: null })),
        ])
        if (cancelled) return
        const list = rolesResponse.data || []
        setRoles(list)
        setMatches(matchesResponse.data || [])
        const goal = profileResponse.data?.career_role_id
        const fallback = matchesResponse.data?.[0]?.role?.role_id || list[0]?.role_id || ''
        setSelectedId(goal && list.some((r) => r.role_id === goal) ? goal : fallback)
      } catch (error) {
        toast.error(errorMessage(error, 'Could not load career roles.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const loadDetail = useCallback(async (roleId) => {
    if (!roleId) return
    setDetailLoading(true)
    try {
      const [skillsResponse, coursesResponse] = await Promise.all([
        api.get(`/careers/${roleId}/skills`),
        api.get(`/careers/${roleId}/courses`, { params: { limit: 12 } }).catch(() => ({ data: [] })),
      ])
      setDetail(skillsResponse.data)
      setCourses(coursesResponse.data || [])
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load this career role.'))
      setDetail(null)
      setCourses([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const categories = useMemo(
    () => Array.from(new Set(roles.map((r) => r.category).filter(Boolean))).sort(),
    [roles],
  )

  const filteredRoles = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return roles.filter((role) => {
      if (category && role.category !== category) return false
      if (!needle) return true
      return (
        role.title.toLowerCase().includes(needle) ||
        role.category.toLowerCase().includes(needle) ||
        (role.description || '').toLowerCase().includes(needle) ||
        (role.keywords || '').toLowerCase().includes(needle)
      )
    })
  }, [roles, search, category])

  const role = roles.find((r) => r.role_id === selectedId) || detail
  const matchForRole = matches.find((m) => m.role.role_id === selectedId)
  const isCurrentGoal = (user?.career_role_id || '') === selectedId

  async function setAsGoal() {
    if (!selectedId) return
    setSaving(true)
    try {
      await api.put('/students/profile', { career_role_id: selectedId })
      await refreshUser?.()
      toast.success(`${role?.title || 'Career goal'} set. Your roadmap was regenerated.`)
      navigate('/roadmap')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update your career goal.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading label="Loading career roles and your matches…" />

  return (
    <>
      <PageHeader
        eyebrow="Career exploration"
        title="Find the role that fits you"
        description="Every match is scored against your saved profile skills. Set a goal and the roadmap regenerates around the missing skills."
        actions={
          <Link to="/skills" className="btn-secondary">
            <Compass className="h-4 w-4" /> Full skill analysis
          </Link>
        }
      />

      {matches.length ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">Top matches for your profile</h2>
            <Badge tone="brand" className="ml-auto">{matches.length} roles scored</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {matches.slice(0, 8).map((match) => (
              <MatchCard
                key={match.role.role_id}
                match={match}
                active={match.role.role_id === selectedId}
                onSelect={() => setSelectedId(match.role.role_id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles, skills, industries…"
                className="input pl-9"
              />
            </div>
            <Select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2">
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <p className="mt-2 text-[11px] text-slate-400">
              Showing {filteredRoles.length} of {roles.length} career roles
            </p>
          </Card>

          <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {filteredRoles.map((item) => (
              <RoleCard
                key={item.role_id}
                role={item}
                active={item.role_id === selectedId}
                onSelect={() => setSelectedId(item.role_id)}
              />
            ))}
            {!filteredRoles.length ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                No roles match this search.
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          {detailLoading ? (
            <Card className="flex min-h-[400px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> Loading role detail…
              </div>
            </Card>
          ) : role ? (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-brand-900 px-5 py-6 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{role.category}</Badge>
                        {isCurrentGoal ? <Badge tone="emerald" icon={CheckCircle2}>Your current goal</Badge> : null}
                        {matchForRole ? (
                          <Badge tone="sky" icon={TrendingUp}>{Math.round(matchForRole.match_score)}% match</Badge>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{role.title}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{role.description}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button onClick={setAsGoal} loading={saving} disabled={isCurrentGoal} icon={Target}>
                        {isCurrentGoal ? 'Current goal' : 'Set as my goal'}
                      </Button>
                      {detail?.phases?.length ? (
                        <span className="text-center text-[10px] text-slate-400">{detail.phases.length} phases</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
                  {[
                    { label: 'Required skills', value: role.required_skills?.length || 0, icon: Layers },
                    { label: 'Core skills', value: role.core_skills?.length || 0, icon: Award },
                    { label: 'Advanced skills', value: role.advanced_skills?.length || 0, icon: GraduationCap },
                    { label: 'Learning phases', value: detail?.phases?.length || role.phase_titles?.length || 0, icon: BookOpen },
                  ].map((stat) => (
                    <div key={stat.label} className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <stat.icon className="h-3 w-3" /> {stat.label}
                      </div>
                      <p className="mt-1 text-xl font-extrabold text-slate-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {matchForRole ? (
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-600" />
                    <h3 className="text-sm font-bold text-slate-900">Why you match this role</h3>
                    <span className="ml-auto text-xs font-bold text-brand-700">{Math.round(matchForRole.match_score)}%</span>
                  </div>
                  <ProgressBar value={matchForRole.match_score} className="mt-3" />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                        Skills you already evidence
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(matchForRole.matched_skills || []).slice(0, 14).map((skill) => (
                          <span key={skill} className="chip border border-emerald-100 bg-emerald-50 text-emerald-700">{skill}</span>
                        ))}
                        {!matchForRole.matched_skills?.length ? (
                          <span className="text-xs text-slate-400">None yet — add skills in your profile.</span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Skills to build</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(matchForRole.missing_skills || []).slice(0, 14).map((skill) => (
                          <span key={skill} className="chip border border-amber-100 bg-amber-50 text-amber-700">{skill}</span>
                        ))}
                        {!matchForRole.missing_skills?.length ? (
                          <span className="text-xs text-slate-400">No missing skills — focus on projects.</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {matchForRole.reasons?.length ? (
                    <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                      {matchForRole.reasons.map((reason) => (
                        <li key={reason} className="flex gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-brand-400" /> {reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              ) : null}

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">Skill build path</h3>
                  <Badge tone="slate" className="ml-auto">phased</Badge>
                </div>
                <div className="mt-4 space-y-4">
                  {(detail?.phases || []).map((phase) => (
                    <div key={phase.phase} className="relative border-l-2 border-brand-100 pl-4">
                      <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          Phase {phase.phase}: {phase.title}
                        </p>
                        <Badge tone="slate">{phase.skills?.length || 0} skills</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(phase.skills || []).map((skill) => (
                          <span key={skill.skill_id} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-100">
                            {skill.skill_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!detail?.phases?.length ? (
                    <p className="text-xs text-slate-400">No phased skill map stored for this role.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">Recommended courses for this role</h3>
                  <Badge tone="slate" className="ml-auto">{courses.length}</Badge>
                </div>
                <Alert tone="info" className="mt-3">
                  Course details come from the stored catalogue. “Catalogue” and “search” links are
                  landing pages — open them to confirm the exact course, price and duration.
                </Alert>
                <div className="mt-4 space-y-2">
                  {courses.map((recommendation) => {
                    const course = recommendation.course
                    return (
                      <div key={course.course_id} className="rounded-xl border border-slate-200 p-3.5 transition hover:border-brand-200">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{course.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {course.platform} · {titleCase(course.difficulty)} ·{' '}
                              {course.duration_hours ? `${Math.round(course.duration_hours)}h` : 'duration n/a'}
                              {course.duration_is_estimate && course.duration_hours ? ' (estimate)' : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={course.price_type === 'Free' ? 'emerald' : 'slate'}>
                              {course.price_type === 'Free' ? 'Free' : course.price_type}
                              {course.price_usd ? ` · $${course.price_usd}` : ''}
                            </Badge>
                            <VerifiedBadge verified={course.verified} linkType={course.link_type} />
                          </div>
                        </div>
                        {recommendation.reasons?.length ? (
                          <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-500">{recommendation.reasons[0]}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1">
                            {(course.skills || []).slice(0, 5).map((skill) => (
                              <span key={skill} className="chip border border-slate-100 bg-slate-50 text-slate-500">{pretty(skill)}</span>
                            ))}
                          </div>
                          <a
                            href={course.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                          >
                            Open provider <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                  {!courses.length ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      No catalogue recommendations for this role yet. Generate the roadmap to see its curated course set.
                    </p>
                  ) : null}
                </div>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="flex items-center gap-2 text-sm text-brand-900">
                  <Users className="h-4 w-4" />
                  Ready to commit? Your roadmap and weekly plan will be rebuilt for {role.title}.
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => navigate('/skills')}>Compare gaps</Button>
                  <Button onClick={setAsGoal} loading={saving} disabled={isCurrentGoal} icon={ArrowRight}>
                    {isCurrentGoal ? 'Already your goal' : 'Build this roadmap'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="Choose a career role"
              description="Pick a role from the list to see its skill phases, readiness match and recommended courses."
            />
          )}
        </div>
      </div>
    </>
  )
}
