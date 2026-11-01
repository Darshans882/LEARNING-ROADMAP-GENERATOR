import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow,
  ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeftRight, ArrowUpRight, BookOpen, Bot, CalendarClock, CheckCircle2, ChevronRight,
  CircleDot, Clock, Download, ExternalLink, FileText, FolderKanban, Layers, LockKeyhole,
  Maximize2, Minimize2, Play, RefreshCw, RotateCcw, Route, ShieldAlert, Sparkles, Target,
  TriangleAlert, Trophy, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage, formatDate, pretty, titleCase } from '../api/client'
import { useAssistant } from '../context/AssistantContext'
import RoadmapNode from '../components/roadmap/RoadmapNode'
import { layoutRoadmap } from '../components/roadmap/layout'
import {
  Alert, Badge, Button, Card, EmptyState, Field, Loading, Modal, PageHeader, ProgressBar,
  Select, StatusBadge, VerifiedBadge,
} from '../components/ui'

const nodeTypes = {
  start: RoadmapNode,
  goal: RoadmapNode,
  skill_analysis: RoadmapNode,
  phase: RoadmapNode,
  course: RoadmapNode,
  project: RoadmapNode,
  assessment: RoadmapNode,
  completion: RoadmapNode,
}

function edgeColor(status) {
  if (status === 'completed') return '#34d399'
  if (status === 'current') return '#6366f1'
  if (status === 'locked') return '#cbd5e1'
  return '#94a3b8'
}

function buildFlow(roadmap) {
  if (!roadmap) return { nodes: [], edges: [] }
  const statusByKey = Object.fromEntries((roadmap.nodes || []).map((n) => [n.node_key, n.status]))
  const rawEdges = (roadmap.edges || []).map((edge) => {
    const targetStatus = statusByKey[edge.target] || 'pending'
    const color = edgeColor(targetStatus)
    return {
      ...edge,
      type: 'smoothstep',
      animated: Boolean(edge.animated),
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      style: { stroke: color, strokeWidth: targetStatus === 'current' ? 2.4 : 1.8 },
    }
  })
  const nodes = (roadmap.nodes || []).map((node) => ({
    id: node.node_key,
    type: node.node_type,
    data: { node },
    draggable: true,
    position: { x: 0, y: 0 },
  }))
  return { nodes: layoutRoadmap(nodes, rawEdges), edges: rawEdges }
}

function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onPaneClick, fullscreen, fitKey }) {
  const { fitView } = useReactFlow()
  const didFit = useRef(null)

  useEffect(() => {
    if (!fitKey || didFit.current === fitKey) return undefined
    didFit.current = fitKey
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.16, duration: 500, maxZoom: 1.15 })
    })
    return () => cancelAnimationFrame(frame)
  }, [fitKey, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onNodeClick(node)}
      onPaneClick={onPaneClick}
      fitView
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      style={{ height: fullscreen ? 'calc(100vh - 20px)' : '640px', background: '#f8fafc' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#cbd5e1" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={2}
        nodeColor={(node) => {
          const status = node.data?.node?.status
          if (status === 'completed') return '#34d399'
          if (status === 'current') return '#6366f1'
          if (status === 'locked') return '#e2e8f0'
          return '#cbd5e1'
        }}
        style={{ width: 150, height: 100 }}
      />
    </ReactFlow>
  )
}

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-xs leading-relaxed text-slate-600">{children}</div>
    </div>
  )
}

function StringList({ items = [], empty = 'None listed' }) {
  const list = Array.isArray(items) ? items : String(items || '').split('\n')
  if (!list.filter(Boolean).length) return <span className="text-slate-400">{empty}</span>
  return (
    <ul className="space-y-1">
      {list.filter(Boolean).map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-1.5">
          <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-brand-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function NodePanel({ node, onClose, onAction, onReset, onAsk, busy }) {
  if (!node) return null
  const meta = node.meta || {}
  const course = node.course
  const project = node.project
  const locked = node.status === 'locked'
  const completed = node.status === 'completed'
  const actionable = ['course', 'project', 'assessment'].includes(node.node_type)
  const typeIcon = {
    course: BookOpen, project: FolderKanban, assessment: CheckCircle2, phase: Layers,
    goal: Target, completion: Trophy, skill_analysis: Sparkles, start: Route,
  }[node.node_type] || CircleDot
  const TypeIcon = typeIcon

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[430px] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-slate-100 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <TypeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {pretty(node.node_type)}{node.phase_number ? ` · Phase ${node.phase_number}` : ''}
          </p>
          <h3 className="mt-0.5 text-base font-bold leading-snug text-slate-900">{node.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={node.status} />
            {node.duration_hours ? <Badge tone="slate" icon={Clock}>~{Math.round(node.duration_hours)}h</Badge> : null}
            {node.score !== null && node.score !== undefined ? <Badge tone="emerald">Score {node.score}%</Badge> : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close node panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {node.description ? <p className="text-xs leading-relaxed text-slate-600">{node.description}</p> : null}

        {locked ? (
          <Alert tone="warning" title="Locked">
            Complete the prerequisite node(s) first. The roadmap unlocks this step automatically.
          </Alert>
        ) : null}

        {node.node_type === 'course' && course ? (
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="slate">{course.platform}</Badge>
              <Badge tone="slate">{titleCase(course.difficulty)}</Badge>
              <Badge tone={course.price_type === 'Free' ? 'emerald' : 'slate'}>
                {course.price_type === 'Free' ? 'Free' : course.price_type}
                {course.price_usd ? ` · $${course.price_usd}` : ''}
              </Badge>
              <VerifiedBadge verified={course.verified} linkType={course.link_type} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {course.duration_hours ? `${Math.round(course.duration_hours)} hours` : 'Duration not published'}
              {course.duration_is_estimate ? ' · estimate' : ''}
              {course.language ? ` · ${course.language}` : ''}
              {course.certificate ? ' · certificate' : ''}
            </p>
            {!course.verified || course.link_type !== 'direct' ? (
              <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This is a {course.link_type === 'search' ? 'search' : 'catalogue'} link, not a verified direct course page.
                Confirm the exact course, price and duration on the provider site.
              </p>
            ) : null}
            {course.price_note ? <p className="mt-1.5 text-[11px] text-slate-400">{course.price_note}</p> : null}
            <a
              href={course.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              Open on {course.platform} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        {node.node_type === 'project' ? (
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="emerald">{titleCase(meta.project_type || project?.project_type || 'project')}</Badge>
              <Badge tone="slate">{titleCase(meta.difficulty || project?.difficulty || 'intermediate')}</Badge>
              {meta.generated ? <Badge tone="amber">AI-suggested project</Badge> : <Badge tone="brand">Catalogue project</Badge>}
            </div>
            {project?.github_url || meta.reference_url ? (
              <a
                href={project?.github_url || meta.reference_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                Project reference <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : null}

        {node.node_type === 'assessment' ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
            <p className="text-[11px] font-semibold text-rose-800">
              Pass mark: {meta.pass_score || 70}% · {meta.type || 'quiz + evaluation'}
            </p>
            <div className="mt-2">
              <StringList items={meta.quiz_topics} empty="No quiz topics listed" />
            </div>
          </div>
        ) : null}

        {meta.objectives?.length ? <DetailRow label="Objectives"><StringList items={meta.objectives} /></DetailRow> : null}
        {meta.assignment || meta.assignments?.length ? (
          <DetailRow label="Assignment">
            {meta.assignment ? <p>{meta.assignment}</p> : <StringList items={meta.assignments} />}
          </DetailRow>
        ) : null}
        {meta.deliverables ? <DetailRow label="Deliverable"><p>{meta.deliverables}</p></DetailRow> : null}
        {meta.requirements?.length ? <DetailRow label="Requirements"><StringList items={meta.requirements} /></DetailRow> : null}
        {node.prerequisites?.length ? <DetailRow label="Prerequisites"><div className="flex flex-wrap gap-1">{node.prerequisites.map((item) => <span key={item} className="chip border border-slate-100 bg-slate-50 text-slate-500">{pretty(item)}</span>)}</div></DetailRow> : null}
        {node.skills?.length ? (
          <DetailRow label="Skills">
            <div className="flex flex-wrap gap-1">
              {node.skills.map((item) => <span key={item} className="chip border border-brand-100 bg-brand-50 text-brand-700">{pretty(item)}</span>)}
            </div>
          </DetailRow>
        ) : null}
        {meta.topics?.length ? <DetailRow label="Phase topics"><StringList items={meta.topics} /></DetailRow> : null}
        {meta.monthly_milestone ? <DetailRow label="Monthly milestone"><p>{meta.monthly_milestone}</p></DetailRow> : null}
        {meta.final_skills?.length ? <DetailRow label="Final skill set"><StringList items={meta.final_skills.slice(0, 12)} /></DetailRow> : null}
        {node.parent_key ? (
          <DetailRow label="Connected from">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{node.parent_key}</span>
          </DetailRow>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-slate-100 p-4">
        {actionable && !locked ? (
          <div className="flex flex-wrap gap-2">
            {!completed ? (
              <Button
                size="sm"
                variant={node.status === 'current' ? 'success' : 'primary'}
                loading={busy === 'complete'}
                disabled={busy === 'progress'}
                icon={CheckCircle2}
                onClick={() => onAction('completed')}
              >
                Mark completed
              </Button>
            ) : null}
            {node.node_type !== 'assessment' && node.status !== 'current' && !completed ? (
              <Button
                size="sm"
                variant="secondary"
                loading={busy === 'progress'}
                disabled={busy === 'complete'}
                icon={Play}
                onClick={() => onAction('progress')}
              >
                Start
              </Button>
            ) : null}
            {node.node_type === 'assessment' ? (
              <Button size="sm" variant="secondary" icon={FileText} onClick={() => onAction('score')}>
                {node.score !== null && node.score !== undefined ? 'Update score' : 'Submit score'}
              </Button>
            ) : null}
            {(node.course_id || node.project_id || ['project', 'assessment', 'course'].includes(node.node_type)) && node.status !== 'pending' ? (
              <Button size="sm" variant="ghost" icon={RotateCcw} loading={busy === 'reset'} onClick={onReset}>
                Reset
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button size="sm" variant="secondary" className="w-full" icon={Bot} onClick={onAsk}>
          Ask the assistant about this step
        </Button>
      </div>
    </div>
  )
}

function RoadmapInner() {
  const { openAssistant } = useAssistant()
  const [roadmap, setRoadmap] = useState(null)
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [busy, setBusy] = useState('')
  const [scoreModal, setScoreModal] = useState(false)
  const [score, setScore] = useState('')
  const [notes, setNotes] = useState('')
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenRole, setRegenRole] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [fitKey, setFitKey] = useState('')

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const applyRoadmap = useCallback((next) => {
    setRoadmap(next)
    if (!next) {
      setNodes([])
      setEdges([])
      return
    }
    const flow = buildFlow(next)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setRoleId(next.career_role_id || '')
    setRegenRole(next.career_role_id || '')
    setFitKey(`${next.id}-${(next.nodes || []).length}`)
  }, [setNodes, setEdges])

  const loadRoadmap = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get('/roadmap')
      applyRoadmap(data.has_roadmap ? data.roadmap : null)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load your roadmap.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [applyRoadmap])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await loadRoadmap()
      try {
        const { data } = await api.get('/careers')
        if (!cancelled) setRoles(data || [])
      } catch {
        /* role selector is optional */
      }
    }
    load()
    return () => { cancelled = true }
  }, [loadRoadmap])

  const selectedNode = useMemo(
    () => (roadmap?.nodes || []).find((node) => node.node_key === selectedKey) || null,
    [roadmap, selectedKey],
  )

  const stats = useMemo(() => {
    const nodesList = roadmap?.nodes || []
    return {
      courses: nodesList.filter((n) => n.node_type === 'course').length,
      projects: nodesList.filter((n) => n.node_type === 'project').length,
      assessments: nodesList.filter((n) => n.node_type === 'assessment').length,
      completed: nodesList.filter((n) => n.status === 'completed').length,
      phases: nodesList.filter((n) => n.node_type === 'phase').length,
    }
  }, [roadmap])

  async function refreshAfterAction(message) {
    toast.success(message)
    await loadRoadmap(true)
  }

  async function handleAction(action) {
    if (!selectedNode) return
    if (action === 'score') {
      setScore(String(selectedNode.score ?? ''))
      setScoreModal(true)
      return
    }
    const status = action === 'completed' ? 'completed' : 'in_progress'
    setBusy(action === 'completed' ? 'complete' : 'progress')
    try {
      if (selectedNode.course_id) {
        await api.post('/progress/course', {
          course_id: selectedNode.course_id,
          status,
          progress_percent: status === 'completed' ? 100 : 50,
        })
      } else if (selectedNode.node_type === 'project' && selectedNode.project_id) {
        await api.post('/progress/project', { project_id: selectedNode.project_id, status })
      } else {
        await api.post('/progress/node', { node_key: selectedNode.node_key, status })
      }
      await refreshAfterAction(status === 'completed' ? 'Step marked complete. Roadmap unlocked the next stage.' : 'Step started.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update this step.'))
    } finally {
      setBusy('')
    }
  }

  async function handleReset() {
    if (!selectedNode) return
    setBusy('reset')
    try {
      if (selectedNode.course_id) {
        await api.delete(`/progress/course/${selectedNode.course_id}`)
      } else if (selectedNode.node_type === 'project' && selectedNode.project_id) {
        await api.delete(`/progress/project/${selectedNode.project_id}`)
      } else {
        await api.delete(`/progress/node/${selectedNode.node_key}`)
      }
      await refreshAfterAction('Progress reset for this step.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not reset this step.'))
    } finally {
      setBusy('')
    }
  }

  async function submitScore() {
    if (!selectedNode) return
    const value = Number(score)
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Enter a score between 0 and 100.')
      return
    }
    setBusy('score')
    try {
      await api.post('/progress/assessment', { node_key: selectedNode.node_key, score: value })
      setScoreModal(false)
      await refreshAfterAction(value >= (selectedNode.meta?.pass_score || 70) ? 'Assessment passed. Next phase unlocked.' : 'Assessment saved. You can retake it below the pass mark.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save your score.'))
    } finally {
      setBusy('')
    }
  }

  async function regenerate() {
    if (!regenRole) return
    setRegenerating(true)
    try {
      const { data } = await api.post('/roadmap/generate', {
        career_role_id: regenRole,
        force: true,
        use_llm: true,
      })
      applyRoadmap(data.roadmap)
      setRegenOpen(false)
      setSelectedKey(null)
      toast.success('Roadmap rebuilt for the selected career goal.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not regenerate the roadmap.'))
    } finally {
      setRegenerating(false)
    }
  }

  async function exportRoadmap() {
    if (!roadmap) return
    try {
      const response = await api.get(`/roadmap/${roadmap.id}/export`, { responseType: 'text' })
      const blob = new Blob([response.data], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `smartlearn-roadmap-${roadmap.career_goal.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Roadmap exported as Markdown.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not export the roadmap.'))
    }
  }

  function askAssistant() {
    if (!selectedNode) return
    openAssistant({
      node_key: selectedNode.node_key,
      title: selectedNode.title,
      node_type: selectedNode.node_type,
      status: selectedNode.status,
    })
  }

  if (loading) return <Loading label="Loading your personalized roadmap…" />

  if (!roadmap) {
    return (
      <>
        <PageHeader eyebrow="Your roadmap" title="No roadmap yet" description="Pick a career goal and generate a personalized phase-by-phase learning roadmap." />
        <EmptyState
          icon={Route}
          title="Build your first roadmap"
          description="Your roadmap is generated from your profile, verified catalogue courses, skill gaps and available weekly study time."
          action={<Link to="/careers" className="btn-primary">Choose a career goal <ChevronRight className="h-4 w-4" /></Link>}
        />
      </>
    )
  }

  const feasibility = roadmap.feasibility || {}
  const warnings = roadmap.warnings || []

  return (
    <>
      {!fullscreen ? (
        <PageHeader
          eyebrow="Interactive roadmap"
          title={roadmap.career_goal}
          description={roadmap.summary}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={exportRoadmap} icon={Download}>Export</Button>
              <Button variant="secondary" size="sm" onClick={() => setRegenOpen(true)} icon={RefreshCw}>Regenerate</Button>
            </>
          }
        />
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Overall progress</p>
          <div className="mt-1 flex items-end justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{Math.round(roadmap.progress_percent || 0)}%</p>
            <Badge tone={roadmap.progress_percent >= 100 ? 'emerald' : 'brand'}>
              {stats.completed} steps done
            </Badge>
          </div>
          <ProgressBar value={roadmap.progress_percent} className="mt-2" />
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current phase</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">
            {roadmap.current_phase ? `Phase ${roadmap.current_phase}` : 'Final review'}
          </p>
          <p className="text-[11px] text-slate-500">{stats.phases} phases · {stats.courses} courses · {stats.projects} projects</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Expected completion</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{formatDate(roadmap.expected_completion)}</p>
          <p className="text-[11px] text-slate-500">{roadmap.total_weeks} weeks · {Math.round(roadmap.total_hours || 0)} study hours</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Feasibility</p>
          <p className={`mt-1 text-sm font-bold ${feasibility.on_track === false ? 'text-amber-700' : 'text-emerald-700'}`}>
            {feasibility.on_track === false ? 'Tight target date' : 'On track'}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{feasibility.message}</p>
        </Card>
      </div>

      {warnings.length || feasibility.on_track === false ? (
        <div className="mb-4 space-y-2">
          {warnings.map((warning) => (
            <Alert key={warning} tone="warning" title="Plan warning">{warning}</Alert>
          ))}
          {feasibility.on_track === false ? (
            <Alert tone="info" title="Target date check">
              {feasibility.message} Required intensity: ~{feasibility.required_hours_per_day || '—'} focused hours/day.
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className={`relative ${fullscreen ? 'fixed inset-0 z-[70] bg-slate-50 p-2.5' : ''}`}>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-bold text-slate-800">Roadmap graph</span>
            </div>
            <div className="hidden items-center gap-3 text-[10px] text-slate-500 sm:flex">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-600" /> Current</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Pending</span>
              <span className="inline-flex items-center gap-1"><LockKeyhole className="h-2.5 w-2.5" /> Locked</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Select value={roleId} onChange={(event) => { setRoleId(event.target.value); setRegenRole(event.target.value); setRegenOpen(true) }} className="!w-auto !py-1.5 text-xs">
                {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.title}</option>)}
                {!roles.some((role) => role.role_id === roadmap.career_role_id) ? (
                  <option value={roadmap.career_role_id}>{roadmap.career_goal}</option>
                ) : null}
              </Select>
              <button type="button" onClick={() => setFitKey(`${fitKey}-refit`)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" title="Fit view">
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setFullscreen((value) => !value)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={exportRoadmap} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" title="Export roadmap">
                <Download className="h-3.5 w-3.5" />
              </button>
              {fullscreen ? (
                <button type="button" onClick={() => setFullscreen(false)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" title="Close fullscreen">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(node) => setSelectedKey(node.id)}
            onPaneClick={() => setSelectedKey(null)}
            fullscreen={fullscreen}
            fitKey={fitKey}
          />

          {selectedNode ? (
            <NodePanel
              node={selectedNode}
              onClose={() => setSelectedKey(null)}
              onAction={handleAction}
              onReset={handleReset}
              onAsk={askAssistant}
              busy={busy}
            />
          ) : null}

          <div className={`pointer-events-none absolute bottom-3 ${selectedNode ? 'left-3' : 'left-3'} hidden rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[10px] text-slate-500 shadow-sm backdrop-blur sm:block`}>
            Drag to pan · scroll to zoom · click a node for details
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Phase outline</h3>
            <Link to="/planner" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800">
              Open study planner <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(roadmap.nodes || []).filter((node) => node.node_type === 'phase').map((phase) => {
              const childNodes = (roadmap.nodes || []).filter((n) => n.phase_number === phase.phase_number && ['course', 'project', 'assessment'].includes(n.node_type))
              const done = childNodes.filter((n) => n.status === 'completed').length
              return (
                <button
                  key={phase.node_key}
                  type="button"
                  onClick={() => setSelectedKey(phase.node_key)}
                  className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-200 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">{phase.title}</p>
                    <StatusBadge status={phase.status} />
                  </div>
                  <ProgressBar
                    value={childNodes.length ? (done / childNodes.length) * 100 : 0}
                    className="mt-2"
                    tone={done === childNodes.length ? 'emerald' : 'brand'}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">{done}/{childNodes.length} steps · {Math.round(phase.duration_hours || 0)}h</p>
                </button>
              )
            })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Plan integrity</h3>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <p className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              Course metadata is stored in the catalogue; links are never generated by the assistant.
            </p>
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              {stats.courses} course links include verification warnings where the provider page is a catalogue or search page.
            </p>
            <p className="flex items-start gap-1.5">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              Durations include assignment and revision overhead.
            </p>
          </div>
        </Card>
      </div>

      <Modal
        open={scoreModal}
        onClose={() => setScoreModal(false)}
        title="Submit assessment score"
        description={`Pass mark is ${selectedNode?.meta?.pass_score || 70}%. The next phase unlocks when you pass.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScoreModal(false)}>Cancel</Button>
            <Button onClick={submitScore} loading={busy === 'score'}>Save score</Button>
          </>
        }
      >
        <Field label="Your score (%)" required>
          <input type="number" min="0" max="100" value={score} onChange={(event) => setScore(event.target.value)} className="input" />
        </Field>
        {selectedNode?.meta?.quiz_topics?.length ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Quiz topics</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {selectedNode.meta.quiz_topics.map((topic) => <span key={topic} className="chip border border-slate-200 bg-white text-slate-500">{topic}</span>)}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title="Regenerate your roadmap"
        description="This keeps your completed progress but rebuilds phases, courses and projects for the chosen goal."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button onClick={regenerate} loading={regenerating} icon={RefreshCw} disabled={!regenRole || regenRole === roadmap.career_role_id}>
              {regenRole === roadmap.career_role_id ? 'Same goal selected' : 'Rebuild roadmap'}
            </Button>
          </>
        }
      >
        <Field label="Career goal" hint="Your profile goal changes too. Completed course progress is preserved.">
          <Select value={regenRole} onChange={(event) => setRegenRole(event.target.value)}>
            {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.title}</option>)}
          </Select>
        </Field>
      </Modal>
    </>
  )
}

export default function Roadmap() {
  return (
    <ReactFlowProvider>
      <RoadmapInner />
    </ReactFlowProvider>
  )
}
