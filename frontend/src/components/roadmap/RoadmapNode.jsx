import { Handle, Position } from '@xyflow/react'
import {
  Award, BookOpen, BrainCircuit, CheckCircle2, ClipboardCheck, Flag, FolderKanban,
  Layers, LockKeyhole, ShieldAlert, Target, Trophy,
} from 'lucide-react'

const TYPE_META = {
  start: { label: 'Start', icon: Flag, tone: 'slate' },
  goal: { label: 'Career goal', icon: Target, tone: 'violet' },
  skill_analysis: { label: 'Skill analysis', icon: BrainCircuit, tone: 'sky' },
  phase: { label: 'Phase', icon: Layers, tone: 'amber' },
  course: { label: 'Course', icon: BookOpen, tone: 'brand' },
  project: { label: 'Project', icon: FolderKanban, tone: 'emerald' },
  assessment: { label: 'Assessment', icon: ClipboardCheck, tone: 'rose' },
  completion: { label: 'Completion', icon: Trophy, tone: 'emerald' },
}

const STATUS_STYLES = {
  completed: {
    frame: 'border-emerald-300 bg-emerald-50/80',
    strip: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700',
  },
  current: {
    frame: 'border-brand-400 bg-white ring-2 ring-brand-200',
    strip: 'bg-brand-600',
    chip: 'bg-brand-100 text-brand-700',
    text: 'text-brand-700',
  },
  pending: {
    frame: 'border-slate-200 bg-white',
    strip: 'bg-slate-300',
    chip: 'bg-slate-100 text-slate-600',
    text: 'text-slate-500',
  },
  locked: {
    frame: 'border-slate-200 bg-slate-50/90',
    strip: 'bg-slate-300',
    chip: 'bg-slate-200 text-slate-500',
    text: 'text-slate-400',
  },
}

const TONE_ICON = {
  slate: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  brand: 'bg-brand-100 text-brand-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
}

function StatusMark({ status }) {
  if (status === 'completed') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  if (status === 'locked') return <LockKeyhole className="h-3.5 w-3.5 text-slate-400" />
  if (status === 'current') return <span className="h-2 w-2 rounded-full bg-brand-600 shadow-[0_0_0_3px_rgba(79,70,229,0.18)]" />
  return <span className="h-2 w-2 rounded-full bg-slate-300" />
}

export default function RoadmapNode({ data, selected }) {
  const node = data?.node || {}
  const type = TYPE_META[node.node_type] || TYPE_META.start
  const Icon = type.icon
  const style = STATUS_STYLES[node.status] || STATUS_STYLES.pending
  const course = node.course
  const verifiedCourse = course?.verified && course?.link_type === 'direct'
  const isBranchRoot = node.node_type === 'phase'
  const statusLabel =
    node.status === 'completed' ? 'Completed'
      : node.status === 'current' ? 'In progress'
        : node.status === 'locked' ? 'Locked'
          : 'Pending'

  return (
    <div
      className={`relative w-[264px] overflow-hidden rounded-2xl border text-left shadow-sm transition ${
        style.frame
      } ${selected ? 'ring-2 ring-brand-400 ring-offset-2' : ''} ${node.status === 'locked' ? 'opacity-80' : ''}`}
    >
      {node.node_type !== 'start' ? (
        <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      ) : null}

      <div className={`h-1 w-full ${style.strip}`} />
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_ICON[type.tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {type.label}
              {node.phase_number ? ` · Phase ${node.phase_number}` : ''}
            </p>
            <p className={`mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug ${node.status === 'locked' ? 'text-slate-500' : 'text-slate-900'}`}>
              {node.title}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}>
            <StatusMark status={node.status} /> {statusLabel}
          </span>
          {node.duration_hours ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-100">
              ~{Math.round(node.duration_hours)}h
            </span>
          ) : null}
          {node.node_type === 'course' && course ? (
            verifiedCourse ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">verified</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <ShieldAlert className="h-2.5 w-2.5" /> verify link
              </span>
            )
          ) : null}
          {isBranchRoot ? (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-slate-400">
              <Award className="h-2.5 w-2.5" /> branch
            </span>
          ) : null}
        </div>
      </div>

      {node.node_type !== 'completion' ? (
        <Handle type="source" position={Position.Right} className="!bg-slate-400" />
      ) : null}
    </div>
  )
}
