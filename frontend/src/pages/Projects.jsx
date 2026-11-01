import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, Clock, ExternalLink, FolderKanban, Github, Layers, Play, Search,
  Sparkles, Target, Timer, Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage, pretty, titleCase } from '../api/client'
import {
  Alert, Badge, Button, Card, EmptyState, Field, Loading, Modal, PageHeader, Select,
  StatusBadge,
} from '../components/ui'

const TYPES = ['mini', 'major', 'capstone']
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

function ProjectCard({ project, progressStatus, onOpen }) {
  return (
    <Card className="flex h-full flex-col p-4 transition hover:border-brand-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {titleCase(project.project_type)} project · {titleCase(project.difficulty)}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900">{project.title}</h3>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <FolderKanban className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-500">{project.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="slate" icon={Clock}>{Math.round(project.duration_hours || 0)}h</Badge>
        {progressStatus ? <StatusBadge status={progressStatus} /> : null}
        {project.reference_url ? <Badge tone="sky">reference</Badge> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(project.skills || []).slice(0, 5).map((skill) => (
          <span key={skill} className="chip border border-slate-100 bg-slate-50 text-slate-500">{pretty(skill)}</span>
        ))}
        {(project.skills || []).length > 5 ? <span className="chip text-slate-400">+{project.skills.length - 5}</span> : null}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3">
        <span className="text-[10px] text-slate-400">{pretty(project.career_role)}</span>
        <button type="button" onClick={() => onOpen(project)} className="ml-auto rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">
          Open project
        </button>
      </div>
    </Card>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [recommended, setRecommended] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [projectType, setProjectType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [careerRole, setCareerRole] = useState('')
  const [selected, setSelected] = useState(null)
  const [repoUrl, setRepoUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState('')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const loadProgress = useCallback(async () => {
    try {
      const { data } = await api.get('/progress')
      const map = {}
      ;(data.projects || []).forEach((row) => { map[row.project_id] = row.status })
      setProgressMap(map)
    } catch {
      /* progress badges are non-critical */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [projectsResponse, recommendedResponse, rolesResponse, profileResponse] = await Promise.all([
          api.get('/projects', {
            params: {
              q: debounced || undefined,
              project_type: projectType || undefined,
              difficulty: difficulty || undefined,
              career_role: careerRole || undefined,
              limit: 100,
            },
          }),
          api.get('/projects/recommended', { params: { limit: 6 } }).catch(() => ({ data: [] })),
          api.get('/careers').catch(() => ({ data: [] })),
          api.get('/students/profile').catch(() => ({ data: null })),
        ])
        if (cancelled) return
        setProjects(projectsResponse.data.items || [])
        setTotal(projectsResponse.data.total || 0)
        setRecommended(recommendedResponse.data || [])
        setRoles(rolesResponse.data || [])
        if (profileResponse.data?.career_role_id && !careerRole) setCareerRole(profileResponse.data.career_role_id)
      } catch (error) {
        if (!cancelled) toast.error(errorMessage(error, 'Could not load projects.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
      await loadProgress()
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, projectType, difficulty, careerRole, loadProgress])

  const grouped = useMemo(() => {
    const map = new Map()
    projects.forEach((project) => {
      const key = project.career_role || 'all'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(project)
    })
    return map
  }, [projects])

  async function openProject(project) {
    setSelected(project)
    setRepoUrl('')
    setNotes('')
    try {
      const { data } = await api.get('/progress')
      const row = (data.projects || []).find((item) => item.project_id === project.project_id)
      setRepoUrl(row?.repository_url || '')
      setNotes(row?.notes || '')
    } catch {
      /* optional */
    }
  }

  async function updateProgress(status) {
    if (!selected) return
    setBusy(status)
    try {
      await api.post('/progress/project', {
        project_id: selected.project_id,
        status,
        repository_url: repoUrl.trim() || null,
        notes: notes.trim() || null,
      })
      setProgressMap((current) => ({ ...current, [selected.project_id]: status }))
      await loadProgress()
      toast.success(status === 'completed' ? 'Project completed. Roadmap checkpoint updated.' : 'Project started.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update project progress.'))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Build proof, not just certificates"
        description="Portfolio projects from the catalogue, matched to your career goal and current skills. Generated roadmap projects also appear in your roadmap."
        actions={<Link to="/roadmap" className="btn-secondary"><Layers className="h-4 w-4" /> View roadmap projects</Link>}
      />

      {recommended.length ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">Recommended for you</h2>
            <Badge tone="brand" className="ml-auto">{recommended.length} projects</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.map((project) => (
              <button
                key={project.project_id}
                type="button"
                onClick={() => openProject(project)}
                className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-white p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                      {titleCase(project.project_type)} · {titleCase(project.difficulty)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">{project.title}</p>
                  </div>
                  <span className="text-[10px] font-bold text-brand-700">{Math.round(project.duration_hours || 0)}h</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-500">{project.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(project.skills || []).slice(0, 4).map((skill) => (
                    <span key={skill} className="chip border border-brand-100 bg-white text-brand-700">{pretty(skill)}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects and deliverables…" className="input pl-9" />
          </div>
          <Select value={careerRole} onChange={(event) => setCareerRole(event.target.value)} className="lg:w-[230px]">
            <option value="">All career roles</option>
            {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.title}</option>)}
          </Select>
          <Select value={projectType} onChange={(event) => setProjectType(event.target.value)} className="lg:w-[150px]">
            <option value="">All sizes</option>
            {TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
          </Select>
          <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="lg:w-[160px]">
            <option value="">Any difficulty</option>
            {DIFFICULTIES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
          </Select>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{total} project{total === 1 ? '' : 's'} in the catalogue{careerRole ? ' for this role' : ''}</p>
      </Card>

      {loading ? (
        <Loading label="Loading project catalogue…" />
      ) : projects.length ? (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([role, items]) => (
            <section key={role}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{pretty(role)}</h3>
                <Badge tone="slate">{items.length}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((project) => (
                  <ProjectCard key={project.project_id} project={project} progressStatus={progressMap[project.project_id]} onOpen={openProject} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No projects match these filters"
          description="Try a different role, difficulty or project size. Your roadmap may also contain generated projects specific to your goal."
          action={<Link to="/roadmap" className="btn-primary">Open roadmap</Link>}
        />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title}
        description={selected ? `${titleCase(selected.project_type)} · ${titleCase(selected.difficulty)} · ~${Math.round(selected.duration_hours || 0)} hours` : ''}
        size="lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="emerald">{titleCase(selected.project_type)}</Badge>
              <Badge tone="slate">{titleCase(selected.difficulty)}</Badge>
              <Badge tone="slate" icon={Timer}>{Math.round(selected.duration_hours || 0)}h estimated</Badge>
              {progressMap[selected.project_id] ? <StatusBadge status={progressMap[selected.project_id]} /> : null}
            </div>

            <p className="text-sm leading-relaxed text-slate-600">{selected.description}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Deliverables</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{selected.deliverables || 'Not specified'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Skills practised</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(selected.skills || []).map((skill) => <span key={skill} className="chip border border-slate-200 bg-white text-slate-600">{pretty(skill)}</span>)}
                  {!selected.skills?.length ? <span className="text-xs text-slate-400">Not tagged</span> : null}
                </div>
              </div>
            </div>

            {selected.reference_url || selected.github_url ? (
              <a
                href={selected.reference_url || selected.github_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <Github className="h-3.5 w-3.5" /> Open project reference <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-800">Track this project</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Add your repository and notes so they appear in your progress dashboard.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Repository URL" hint="Optional. Must start with http(s)://">
                  <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/you/project" className="input" />
                </Field>
                <Field label="Notes">
                  <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What you plan to build" className="input" />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={CheckCircle2} loading={busy === 'completed'} onClick={() => updateProgress('completed')}>
                  Mark completed
                </Button>
                <Button size="sm" variant="secondary" icon={Play} loading={busy === 'in_progress'} onClick={() => updateProgress('in_progress')}>
                  Start project
                </Button>
              </div>
            </div>

            <Alert tone="info" title="Portfolio tip">
              Commit early and often, write a short README with screenshots, and add the project to your
              profile so your assistant can reference it in career-readiness answers.
            </Alert>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
