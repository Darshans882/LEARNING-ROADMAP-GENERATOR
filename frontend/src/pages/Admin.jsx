import { useEffect, useMemo, useState } from 'react'
import {
  Activity, BarChart3, BookOpen, CheckCircle2, ExternalLink, GraduationCap, Layers,
  Library, Link2, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Search, ShieldCheck,
  Sparkles, Trash2, UserCog, Users,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import toast from 'react-hot-toast'
import api, { errorMessage, formatDate, formatDateTime, pretty } from '../api/client'
import {
  Alert, Badge, Button, Card, EmptyState, Field, Loading, Modal, PageHeader, ProgressBar,
  Select, StatCard, Tabs, TagInput, Textarea, VerifiedBadge,
} from '../components/ui'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'students', label: 'Students' },
  { value: 'courses', label: 'Courses' },
  { value: 'roles', label: 'Career roles' },
  { value: 'skills', label: 'Skills' },
  { value: 'resources', label: 'Resources' },
  { value: 'roadmaps', label: 'Roadmaps' },
  { value: 'activity', label: 'Activity' },
]

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#64748b']

const EMPTY_COURSE = {
  course_id: '',
  title: '',
  description: '',
  skills: [],
  prerequisites: [],
  category: 'General',
  difficulty: 'beginner',
  platform: '',
  url: '',
  link_type: 'direct',
  duration_hours: '',
  duration_is_estimate: true,
  price_type: 'Free',
  price_usd: '',
  price_note: '',
  language: 'English',
  certificate: false,
  rating: '',
  rating_count: '',
  verified: false,
  verification_note: '',
  learning_type: 'Video',
  is_active: true,
}

const EMPTY_ROLE = {
  role_id: '',
  title: '',
  category: 'General',
  description: '',
  required_skills: [],
  core_skills: [],
  advanced_skills: [],
}

const EMPTY_SKILL = {
  skill_id: '',
  skill_name: '',
  category: '',
  level: 'foundational',
  description: '',
  aliases: '',
}

const EMPTY_RESOURCE = {
  resource_id: '',
  title: '',
  resource_type: 'Documentation',
  url: '',
  skills: [],
  platform: '',
  price_type: 'Free',
  description: '',
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function Check({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {hint ? <span className="block text-[11px] text-slate-500">{hint}</span> : null}
      </span>
    </label>
  )
}

function Pager({ total, limit, offset, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / limit))
  const page = Math.floor((offset || 0) / limit) + 1
  if (!total) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-3 text-xs text-slate-500">
      <span>
        Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <span className="font-semibold text-slate-700">
          {page} / {pages}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  )
}

function TableShell({ children, className = '' }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">{children}</table>
      </div>
    </Card>
  )
}

function Th({ children, className = '' }) {
  return (
    <th className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '' }) {
  return <td className={`border-b border-slate-100 px-3 py-2.5 align-middle text-xs text-slate-600 ${className}`}>{children}</td>
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */
function CourseModal({ open, initial, onClose, onSaved, skillSuggestions }) {
  const [form, setForm] = useState(EMPTY_COURSE)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(initial?.course_id)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        ...EMPTY_COURSE,
        ...initial,
        skills: initial.skills || [],
        prerequisites: initial.prerequisites || [],
        duration_hours: initial.duration_hours ?? '',
        price_usd: initial.price_usd ?? '',
        rating: initial.rating ?? '',
        rating_count: initial.rating_count ?? '',
      })
    } else {
      setForm(EMPTY_COURSE)
    }
  }, [open, initial])

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      duration_hours: toNumber(form.duration_hours),
      price_usd: toNumber(form.price_usd),
      rating: toNumber(form.rating),
      rating_count: toNumber(form.rating_count),
    }
    delete payload.course_id
    if (!editing) {
      payload.course_id = form.course_id
      delete payload.is_active
    }
    try {
      if (editing) {
        await api.patch(`/admin/courses/${initial.course_id}`, payload)
        toast.success('Course updated')
      } else {
        await api.post('/admin/courses', payload)
        toast.success('Course created')
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the course.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit course' : 'Add a course'}
      description="Only publish URLs you have personally checked. Mark catalogue or search pages honestly."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="course-form" loading={saving}>{editing ? 'Save course' : 'Create course'}</Button>
        </>
      }
    >
      <form id="course-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course id" hint="lowercase letters, numbers, dashes" required>
            <input className="input" value={form.course_id} onChange={(e) => set('course_id', e.target.value)} disabled={editing} required pattern="[a-z0-9][a-z0-9\-_]*" />
          </Field>
          <Field label="Title" required>
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required minLength={2} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform" required>
            <input className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)} required placeholder="Coursera" />
          </Field>
          <Field label="URL" hint="Direct course page preferred. Catalogue/search pages must be labelled." required>
            <input className="input" type="url" value={form.url} onChange={(e) => set('url', e.target.value)} required placeholder="https://…" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Link type">
            <Select value={form.link_type} onChange={(e) => set('link_type', e.target.value)}>
              <option value="direct">Direct course page</option>
              <option value="catalogue">Catalogue listing</option>
              <option value="search">Search page</option>
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="Category">
            <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price type">
            <Select value={form.price_type} onChange={(e) => set('price_type', e.target.value)}>
              <option value="Free">Free</option>
              <option value="Freemium">Freemium</option>
              <option value="Paid">Paid</option>
            </Select>
          </Field>
          <Field label="Price (USD)" hint="Leave blank if unknown.">
            <input className="input" type="number" min="0" step="0.01" value={form.price_usd} onChange={(e) => set('price_usd', e.target.value)} />
          </Field>
          <Field label="Price note">
            <input className="input" value={form.price_note} onChange={(e) => set('price_note', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Duration (hours)" hint="Leave blank if unknown. Estimates are flagged.">
            <input className="input" type="number" min="0" step="0.5" value={form.duration_hours} onChange={(e) => set('duration_hours', e.target.value)} />
          </Field>
          <Field label="Learning type">
            <input className="input" value={form.learning_type} onChange={(e) => set('learning_type', e.target.value)} />
          </Field>
          <Field label="Language">
            <input className="input" value={form.language} onChange={(e) => set('language', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Skills covered">
            <TagInput value={form.skills} onChange={(value) => set('skills', value)} suggestions={skillSuggestions} />
          </Field>
          <Field label="Prerequisites">
            <TagInput value={form.prerequisites} onChange={(value) => set('prerequisites', value)} suggestions={skillSuggestions} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rating" hint="Never invent ratings. Leave blank if unknown.">
            <input className="input" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => set('rating', e.target.value)} />
          </Field>
          <Field label="Rating count">
            <input className="input" type="number" min="0" value={form.rating_count} onChange={(e) => set('rating_count', e.target.value)} />
          </Field>
        </div>
        <Field label="Verification note">
          <input className="input" value={form.verification_note} onChange={(e) => set('verification_note', e.target.value)} placeholder="Why is this link verified or unverified?" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Check label="Verified link" checked={form.verified} onChange={(value) => set('verified', value)} hint="Only tick after checking the live page yourself." />
          <Check label="Certificate available" checked={form.certificate} onChange={(value) => set('certificate', value)} />
          <Check label="Duration is an estimate" checked={form.duration_is_estimate} onChange={(value) => set('duration_is_estimate', value)} />
          {editing ? <Check label="Active in catalogue" checked={form.is_active} onChange={(value) => set('is_active', value)} /> : null}
        </div>
        {!form.verified || form.link_type !== 'direct' ? (
          <Alert tone="warning" title="Link honesty check">
            This course will be shown with a verification warning to students because it is either unverified or not a
            direct course page.
          </Alert>
        ) : null}
      </form>
    </Modal>
  )
}

function RoleModal({ open, initial, onClose, onSaved, skillSuggestions }) {
  const [form, setForm] = useState(EMPTY_ROLE)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(initial?.role_id)

  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...EMPTY_ROLE, ...initial, phase_skills: undefined, phase_titles: undefined } : EMPTY_ROLE)
  }, [open, initial])

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        role_id: form.role_id,
        title: form.title,
        category: form.category,
        description: form.description,
        required_skills: form.required_skills,
        core_skills: form.core_skills,
        advanced_skills: form.advanced_skills,
      }
      if (editing) {
        delete payload.role_id
        // The admin list endpoint does not return core/advanced skills, so avoid
        // overwriting them with empty arrays when editing.
        delete payload.core_skills
        delete payload.advanced_skills
        await api.patch(`/admin/roles/${initial.role_id}`, payload)
        toast.success('Role updated')
      } else {
        await api.post('/admin/roles', payload)
        toast.success('Role created')
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the role.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit career role' : 'Add career role'}
      description="Skill ids must already exist in the skills catalogue."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="role-form" loading={saving}>{editing ? 'Save role' : 'Create role'}</Button>
        </>
      }
    >
      <form id="role-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role id" required>
            <input className="input" value={form.role_id} onChange={(e) => set('role_id', e.target.value)} disabled={editing} required pattern="[a-z0-9][a-z0-9\-_]*" />
          </Field>
          <Field label="Title" required>
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} />
          </Field>
          <Field label="Description">
            <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <Field label="Required skills">
          <TagInput value={form.required_skills} onChange={(value) => set('required_skills', value)} suggestions={skillSuggestions} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Core skills">
            <TagInput value={form.core_skills} onChange={(value) => set('core_skills', value)} suggestions={skillSuggestions} />
          </Field>
          <Field label="Advanced skills">
            <TagInput value={form.advanced_skills} onChange={(value) => set('advanced_skills', value)} suggestions={skillSuggestions} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function SkillModal({ open, initial, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_SKILL)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(initial?.skill_id)

  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...EMPTY_SKILL, ...initial } : EMPTY_SKILL)
  }, [open, initial])

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (editing) {
        delete payload.skill_id
        await api.patch(`/admin/skills/${initial.skill_id}`, payload)
        toast.success('Skill updated')
      } else {
        await api.post('/admin/skills', payload)
        toast.success('Skill created')
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the skill.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit skill' : 'Add skill'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="skill-form" loading={saving}>{editing ? 'Save skill' : 'Create skill'}</Button>
        </>
      }
    >
      <form id="skill-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Skill id" required>
            <input className="input" value={form.skill_id} onChange={(e) => set('skill_id', e.target.value)} disabled={editing} required pattern="[a-z0-9][a-z0-9\-_]*" />
          </Field>
          <Field label="Skill name" required>
            <input className="input" value={form.skill_name} onChange={(e) => set('skill_name', e.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required>
            <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} required />
          </Field>
          <Field label="Level">
            <Select value={form.level} onChange={(e) => set('level', e.target.value)}>
              <option value="foundational">Foundational</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </Field>
        <Field label="Aliases" hint="Comma-separated alternative names used for matching.">
          <input className="input" value={form.aliases} onChange={(e) => set('aliases', e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

function ResourceModal({ open, initial, onClose, onSaved, skillSuggestions }) {
  const [form, setForm] = useState(EMPTY_RESOURCE)
  const [saving, setSaving] = useState(false)
  const editing = Boolean(initial?.resource_id)

  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...EMPTY_RESOURCE, ...initial, skills: initial.skills || [] } : EMPTY_RESOURCE)
  }, [open, initial])

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (editing) {
        delete payload.resource_id
        await api.patch(`/admin/resources/${initial.resource_id}`, payload)
        toast.success('Resource updated')
      } else {
        await api.post('/admin/resources', payload)
        toast.success('Resource created')
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the resource.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit resource' : 'Add resource'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="resource-form" loading={saving}>{editing ? 'Save resource' : 'Create resource'}</Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resource id" required>
            <input className="input" value={form.resource_id} onChange={(e) => set('resource_id', e.target.value)} disabled={editing} required />
          </Field>
          <Field label="Title" required>
            <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
        </div>
        <Field label="URL" required>
          <input className="input" type="url" value={form.url} onChange={(e) => set('url', e.target.value)} required placeholder="https://…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <input className="input" value={form.resource_type} onChange={(e) => set('resource_type', e.target.value)} />
          </Field>
          <Field label="Platform">
            <input className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)} />
          </Field>
          <Field label="Price type">
            <Select value={form.price_type} onChange={(e) => set('price_type', e.target.value)}>
              <option value="Free">Free</option>
              <option value="Freemium">Freemium</option>
              <option value="Paid">Paid</option>
            </Select>
          </Field>
        </div>
        <Field label="Skills">
          <TagInput value={form.skills} onChange={(value) => set('skills', value)} suggestions={skillSuggestions} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </Field>
      </form>
    </Modal>
  )
}

function StudentModal({ open, student, careerRoles, onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', role: 'student', career_role_id: '', is_active: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !student) return
    setForm({
      full_name: student.full_name || '',
      role: student.role || 'student',
      career_role_id: student.career_role_id || '',
      is_active: Boolean(student.is_active),
    })
  }, [open, student])

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/admin/students/${student.id}`, {
        full_name: form.full_name,
        role: form.role,
        is_active: form.is_active,
        career_role_id: form.career_role_id || '',
      })
      toast.success('Student updated')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the student.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit student"
      description={student?.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="student-form" loading={saving}>Save student</Button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="space-y-4">
        <Field label="Full name" required>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
          <Field label="Career goal" hint="Changing this can make the stored roadmap stale until regenerated.">
            <Select value={form.career_role_id} onChange={(e) => setForm({ ...form, career_role_id: e.target.value })}>
              <option value="">No career goal</option>
              {careerRoles.map((role) => (
                <option key={role.role_id} value={role.role_id}>{role.title}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Check
          label="Account active"
          checked={form.is_active}
          onChange={(value) => setForm({ ...form, is_active: value })}
          hint="Inactive students cannot sign in, but their data is preserved."
        />
      </form>
    </Modal>
  )
}

function PasswordModal({ open, student, onClose }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await api.post(`/admin/students/${student.id}/reset-password`, { new_password: password })
      toast.success(`Password reset for ${student.email}`)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not reset the password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset password"
      description={student?.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="password-reset-form" loading={saving}>Reset password</Button>
        </>
      }
    >
      <form id="password-reset-form" onSubmit={submit}>
        <Field label="New password" hint="8–72 characters with letters and numbers." required>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            required
            autoComplete="new-password"
          />
        </Field>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Admin() {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [students, setStudents] = useState({ items: [], total: 0 })
  const [studentFilters, setStudentFilters] = useState({ q: '', role: '', active: '', offset: 0 })
  const [studentDraft, setStudentDraft] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [courses, setCourses] = useState({ items: [], total: 0 })
  const [courseOffset, setCourseOffset] = useState(0)
  const [courseDraft, setCourseDraft] = useState('')
  const [courseQuery, setCourseQuery] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [catalogueBusy, setCatalogueBusy] = useState('')

  const [roles, setRoles] = useState([])
  const [skills, setSkills] = useState({ items: [], total: 0 })
  const [skillOffset, setSkillOffset] = useState(0)
  const [skillQuery, setSkillQuery] = useState('')
  const [skillDraft, setSkillDraft] = useState('')
  const [resources, setResources] = useState([])
  const [roadmaps, setRoadmaps] = useState([])
  const [activity, setActivity] = useState([])
  const [loadingTab, setLoadingTab] = useState(false)
  const [careerRoles, setCareerRoles] = useState([])

  const [courseModal, setCourseModal] = useState({ open: false, course: null })
  const [roleModal, setRoleModal] = useState({ open: false, role: null })
  const [skillModal, setSkillModal] = useState({ open: false, skill: null })
  const [resourceModal, setResourceModal] = useState({ open: false, resource: null })
  const [studentModal, setStudentModal] = useState({ open: false, student: null })
  const [passwordModal, setPasswordModal] = useState({ open: false, student: null })

  const refresh = () => setRefreshKey((key) => key + 1)

  useEffect(() => {
    let cancelled = false
    setLoadingOverview(true)
    Promise.allSettled([api.get('/admin/stats'), api.get('/admin/usage')])
      .then(([statsResult, usageResult]) => {
        if (cancelled) return
        if (statsResult.status === 'fulfilled') setStats(statsResult.value.data)
        else toast.error(errorMessage(statsResult.reason, 'Could not load admin stats.'))
        if (usageResult.status === 'fulfilled') setUsage(usageResult.value.data)
        setLoadingOverview(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false
    api.get('/students/options')
      .then(({ data }) => { if (!cancelled) setCareerRoles(data.career_roles || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('/admin/skills', { params: { limit: 500 } })
      .then(({ data }) => { if (!cancelled) setSkills((current) => ({ ...current, all: data.items })) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    if (tab !== 'students') return undefined
    let cancelled = false
    setLoadingStudents(true)
    const params = { limit: 50, offset: studentFilters.offset }
    if (studentFilters.q) params.q = studentFilters.q
    if (studentFilters.role) params.role = studentFilters.role
    if (studentFilters.active) params.active = studentFilters.active === 'true'
    api.get('/admin/students', { params })
      .then(({ data }) => { if (!cancelled) setStudents(data) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load students.')))
      .finally(() => { if (!cancelled) setLoadingStudents(false) })
    return () => { cancelled = true }
  }, [tab, studentFilters, refreshKey])

  useEffect(() => {
    if (tab !== 'courses') return undefined
    let cancelled = false
    setLoadingCourses(true)
    api.get('/admin/courses', { params: { q: courseQuery || undefined, limit: 10, offset: courseOffset } })
      .then(({ data }) => { if (!cancelled) setCourses(data) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load courses.')))
      .finally(() => { if (!cancelled) setLoadingCourses(false) })
    return () => { cancelled = true }
  }, [tab, courseQuery, courseOffset, refreshKey])

  useEffect(() => {
    if (tab !== 'roles') return undefined
    let cancelled = false
    setLoadingTab(true)
    api.get('/admin/roles')
      .then(({ data }) => { if (!cancelled) setRoles(data) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load career roles.')))
      .finally(() => { if (!cancelled) setLoadingTab(false) })
    return () => { cancelled = true }
  }, [tab, refreshKey])

  useEffect(() => {
    if (tab !== 'skills') return undefined
    let cancelled = false
    setLoadingTab(true)
    api.get('/admin/skills', { params: { q: skillQuery || undefined, limit: 25, offset: skillOffset } })
      .then(({ data }) => { if (!cancelled) setSkills((current) => ({ ...current, ...data })) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load skills.')))
      .finally(() => { if (!cancelled) setLoadingTab(false) })
    return () => { cancelled = true }
  }, [tab, skillQuery, skillOffset, refreshKey])

  useEffect(() => {
    if (tab !== 'resources') return undefined
    let cancelled = false
    setLoadingTab(true)
    api.get('/admin/resources')
      .then(({ data }) => { if (!cancelled) setResources(data) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load resources.')))
      .finally(() => { if (!cancelled) setLoadingTab(false) })
    return () => { cancelled = true }
  }, [tab, refreshKey])

  useEffect(() => {
    if (tab !== 'roadmaps') return undefined
    let cancelled = false
    setLoadingTab(true)
    api.get('/admin/roadmaps')
      .then(({ data }) => { if (!cancelled) setRoadmaps(data.items || []) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load roadmaps.')))
      .finally(() => { if (!cancelled) setLoadingTab(false) })
    return () => { cancelled = true }
  }, [tab, refreshKey])

  useEffect(() => {
    if (tab !== 'activity') return undefined
    let cancelled = false
    setLoadingTab(true)
    api.get('/admin/activity')
      .then(({ data }) => { if (!cancelled) setActivity(data) })
      .catch((error) => toast.error(errorMessage(error, 'Could not load activity.')))
      .finally(() => { if (!cancelled) setLoadingTab(false) })
    return () => { cancelled = true }
  }, [tab, refreshKey])

  const skillSuggestions = useMemo(
    () => (skills.all || []).map((skill) => skill.skill_id),
    [skills.all],
  )

  function runStudentSearch(event) {
    event?.preventDefault()
    setStudentFilters((current) => ({ ...current, q: studentDraft, offset: 0 }))
  }

  function runCourseSearch(event) {
    event?.preventDefault()
    setCourseOffset(0)
    setCourseQuery(courseDraft.trim())
  }

  function runSkillSearch(event) {
    event?.preventDefault()
    setSkillOffset(0)
    setSkillQuery(skillDraft.trim())
  }

  async function toggleStudentActive(student) {
    if (student.is_active && !window.confirm(`Deactivate ${student.email}? They will no longer be able to sign in.`)) return
    try {
      if (student.is_active) {
        await api.delete(`/admin/students/${student.id}`)
        toast.success(`${student.email} deactivated`)
      } else {
        await api.patch(`/admin/students/${student.id}`, { is_active: true })
        toast.success(`${student.email} reactivated`)
      }
      refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function deactivateCourse(course) {
    if (!window.confirm(`Deactivate “${course.title}”? Existing roadmap references are preserved.`)) return
    try {
      await api.delete(`/admin/courses/${course.course_id}`)
      toast.success('Course deactivated')
      refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function checkCourseLink(course) {
    setCatalogueBusy(course.course_id)
    try {
      const { data } = await api.post(`/admin/courses/${course.course_id}/validate`, null, { params: { network: true }, timeout: 30000 })
      if (data.reachable) toast.success(`${course.course_id}: ${data.status}${data.http_status ? ` (HTTP ${data.http_status})` : ''}`)
      else toast(`${course.course_id}: ${data.status} — ${data.note}`, { icon: '⚠️' })
      refresh()
    } catch (error) {
      toast.error(errorMessage(error, 'Link check failed.'))
    } finally {
      setCatalogueBusy('')
    }
  }

  async function validateCatalogue() {
    setCatalogueBusy('catalogue')
    try {
      const { data } = await api.post('/admin/catalogue/validate', null, { params: { limit: 5 }, timeout: 60000 })
      toast.success(`${data.checked} checked · ${data.reachable} reachable · ${data.invalid} invalid · ${data.restricted} restricted`)
      refresh()
    } catch (error) {
      toast.error(errorMessage(error, 'Catalogue validation failed.'))
    } finally {
      setCatalogueBusy('')
    }
  }

  async function reloadCatalogue() {
    setCatalogueBusy('reload')
    try {
      const { data } = await api.post('/admin/catalogue/reload')
      toast.success(`Catalogue reloaded: ${Object.entries(data.counts || {}).map(([key, value]) => `${key} ${value}`).join(' · ')}`)
      refresh()
    } catch (error) {
      toast.error(errorMessage(error, 'Catalogue reload failed.'))
    } finally {
      setCatalogueBusy('')
    }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete role “${role.title}”?`)) return
    try {
      await api.delete(`/admin/roles/${role.role_id}`)
      toast.success('Role deleted')
      refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function deleteSkill(skill) {
    if (!window.confirm(`Delete skill “${skill.skill_name}”?`)) return
    try {
      await api.delete(`/admin/skills/${skill.skill_id}`)
      toast.success('Skill deleted')
      refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function deleteResource(resource) {
    if (!window.confirm(`Delete resource “${resource.title}”?`)) return
    try {
      await api.delete(`/admin/resources/${resource.resource_id}`)
      toast.success('Resource deleted')
      refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const statCards = stats
    ? [
        { label: 'Students', value: stats.total_students, icon: Users, tone: 'brand' },
        { label: 'Courses', value: `${stats.active_courses} / ${stats.total_courses}`, hint: 'active / total', icon: BookOpen, tone: 'sky' },
        { label: 'Completed courses', value: stats.completed_courses, icon: CheckCircle2, tone: 'emerald' },
        { label: 'Verified direct links', value: stats.verified_courses, hint: 'honest catalogue', icon: ShieldCheck, tone: 'emerald' },
        { label: 'Roadmaps', value: stats.total_roadmaps, icon: Layers, tone: 'violet' },
        { label: 'Projects', value: stats.total_projects, icon: GraduationCap, tone: 'amber' },
        { label: 'Assistant messages', value: stats.chat_messages, icon: Sparkles, tone: 'violet' },
        { label: 'Catalogue coverage', value: stats.total_courses ? `${Math.round((stats.active_courses / stats.total_courses) * 100)}%` : '0%', hint: 'active courses', icon: BarChart3, tone: 'sky' },
      ]
    : []

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Admin console"
        description="Manage the catalogue, career roles, skills, resources and learners. All changes are audited in the activity log."
        actions={
          <>
            <Button variant="secondary" onClick={refresh} icon={RefreshCw}>Refresh</Button>
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="btn-primary">
              <ExternalLink className="h-4 w-4" /> API docs
            </a>
          </>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

      {/* Overview */}
      {tab === 'overview' ? (
        loadingOverview && !stats ? (
          <Loading label="Loading platform metrics…" />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => <StatCard key={card.label} {...card} />)}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">Platform activity</h3>
                  <Badge tone="slate" className="ml-auto">last 14 days</Badge>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={usage?.activity_by_day || []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="events" name="Events" stroke="#6366f1" strokeWidth={2} fill="url(#activityFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">Most frequent actions</h3>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={usage?.top_actions || []} layout="vertical" margin={{ top: 4, right: 12, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="action" width={116} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="count" name="Events" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-900">Completions by platform</h3>
                {usage?.completions_by_platform?.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={usage.completions_by_platform}
                        dataKey="count"
                        nameKey="platform"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {usage.completions_by_platform.map((entry, index) => (
                          <Cell key={entry.platform} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-10 text-center text-xs text-slate-400">No completed courses yet.</p>
                )}
              </Card>

              <Card className="p-5 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Roadmaps by career goal</h3>
                  <Badge tone="slate">{usage?.totals?.active_roadmaps || 0} active</Badge>
                </div>
                {usage?.roadmaps_by_goal?.length ? (
                  <div className="space-y-2.5">
                    {usage.roadmaps_by_goal.slice(0, 8).map((row) => {
                      const max = Math.max(...usage.roadmaps_by_goal.map((item) => item.count), 1)
                      return (
                        <div key={row.goal || 'unknown'}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate font-medium text-slate-700">{row.goal || 'No goal'}</span>
                            <span className="text-slate-500">{row.count}</span>
                          </div>
                          <ProgressBar value={(row.count / max) * 100} className="mt-1" />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-10 text-center text-xs text-slate-400">No roadmaps generated yet.</p>
                )}
              </Card>
            </div>

            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Catalogue maintenance</h3>
                  <p className="text-xs text-slate-500">Re-sync datasets or verify a sample of live links. Never mark links verified without checking.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" icon={RefreshCw} loading={catalogueBusy === 'reload'} onClick={reloadCatalogue}>
                    Reload dataset
                  </Button>
                  <Button variant="secondary" size="sm" icon={Link2} loading={catalogueBusy === 'catalogue'} onClick={validateCatalogue}>
                    Validate 5 links
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'Course progress rows', value: usage?.totals?.course_progress_rows ?? 0 },
                  { label: 'Project progress rows', value: usage?.totals?.project_progress_rows ?? 0 },
                  { label: 'Students', value: usage?.totals?.students ?? 0 },
                  { label: 'Active roadmaps', value: usage?.totals?.active_roadmaps ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      ) : null}

      {/* Students */}
      {tab === 'students' ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <form onSubmit={runStudentSearch} className="flex flex-1 flex-wrap items-end gap-2">
                <Field label="Search" className="min-w-[200px] flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      value={studentDraft}
                      onChange={(event) => setStudentDraft(event.target.value)}
                      placeholder="Name or email"
                    />
                  </div>
                </Field>
                <Button type="submit" variant="secondary" size="sm">Search</Button>
              </form>
              <Field label="Role" className="w-36">
                <Select
                  value={studentFilters.role}
                  onChange={(event) => setStudentFilters((current) => ({ ...current, role: event.target.value, offset: 0 }))}
                >
                  <option value="">All roles</option>
                  <option value="student">Students</option>
                  <option value="admin">Admins</option>
                </Select>
              </Field>
              <Field label="Status" className="w-36">
                <Select
                  value={studentFilters.active}
                  onChange={(event) => setStudentFilters((current) => ({ ...current, active: event.target.value, offset: 0 }))}
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </Field>
            </div>
          </Card>

          {loadingStudents ? (
            <Loading label="Loading students…" />
          ) : students.items.length === 0 ? (
            <EmptyState icon={Users} title="No students match" description="Adjust the filters to see more learners." />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Status</Th>
                  <Th>Goal</Th>
                  <Th>Profile</Th>
                  <Th>Completed</Th>
                  <Th>Last login</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {students.items.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-[10px] font-bold text-white">
                          {(student.full_name || student.email).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{student.full_name}</p>
                          <p className="truncate text-[11px] text-slate-500">{student.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Badge tone={student.is_active ? 'emerald' : 'rose'}>{student.is_active ? 'Active' : 'Inactive'}</Badge>
                        <Badge tone={student.role === 'admin' ? 'amber' : 'slate'}>{student.role}</Badge>
                      </div>
                    </Td>
                    <Td>
                      <p className="font-medium text-slate-700">{student.career_goal || '—'}</p>
                      <p className="text-[10px] text-slate-400">{student.degree || student.department || 'No academic info'}</p>
                    </Td>
                    <Td>
                      <div className="w-24">
                        <ProgressBar value={student.profile_completeness || 0} tone={(student.profile_completeness || 0) >= 80 ? 'emerald' : 'amber'} />
                        <p className="mt-1 text-[10px] text-slate-400">
                          {student.profile_completeness || 0}% · {student.onboarding_completed ? 'onboarded' : 'pending'}
                        </p>
                      </div>
                    </Td>
                    <Td>{student.completed_courses}</Td>
                    <Td>{student.last_login ? formatDateTime(student.last_login) : 'Never'}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setStudentModal({ open: true, student })} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" title="Edit student">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setPasswordModal({ open: true, student })} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Reset password">
                          <UserCog className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStudentActive(student)}
                          className={`rounded-lg p-1.5 hover:bg-rose-50 ${student.is_active ? 'text-slate-400 hover:text-rose-600' : 'text-emerald-500 hover:text-emerald-700'}`}
                          title={student.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          {student.is_active ? <Trash2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
          <Card className="overflow-hidden">
            <Pager
              total={students.total}
              limit={students.limit || 50}
              offset={studentFilters.offset}
              onChange={(offset) => setStudentFilters((current) => ({ ...current, offset }))}
            />
          </Card>
        </div>
      ) : null}

      {/* Courses */}
      {tab === 'courses' ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <form onSubmit={runCourseSearch} className="flex flex-1 flex-wrap items-end gap-2">
                <Field label="Search catalogue" className="min-w-[220px] flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-9" value={courseDraft} onChange={(event) => setCourseDraft(event.target.value)} placeholder="Title or course id" />
                  </div>
                </Field>
                <Button type="submit" variant="secondary" size="sm">Search</Button>
              </form>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={Link2} loading={catalogueBusy === 'catalogue'} onClick={validateCatalogue}>
                  Validate sample
                </Button>
                <Button size="sm" variant="secondary" icon={RefreshCw} loading={catalogueBusy === 'reload'} onClick={reloadCatalogue}>
                  Reload dataset
                </Button>
                <Button size="sm" icon={Plus} onClick={() => setCourseModal({ open: true, course: null })}>
                  Add course
                </Button>
              </div>
            </div>
          </Card>

          {loadingCourses ? (
            <Loading label="Loading catalogue…" />
          ) : courses.items.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses found" description="Try another search or add a course." />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th>Skills</Th>
                  <Th>Link</Th>
                  <Th>Duration</Th>
                  <Th>Price</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {courses.items.map((course) => (
                  <tr key={course.course_id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-semibold text-slate-900">{course.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {course.platform} · {course.course_id} · {pretty(course.difficulty)}
                      </p>
                    </Td>
                    <Td>
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {(course.skills || []).slice(0, 3).map((skill) => (
                          <span key={skill} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{skill}</span>
                        ))}
                        {course.skills?.length > 3 ? <span className="text-[10px] text-slate-400">+{course.skills.length - 3}</span> : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <VerifiedBadge verified={course.verified} linkType={course.link_type} />
                        <a href={course.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-[10px] text-brand-600 hover:underline">
                          Open <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </Td>
                    <Td>{course.duration_hours ? `${course.duration_hours}h${course.duration_is_estimate ? ' est.' : ''}` : '—'}</Td>
                    <Td>{course.price_type}{course.price_usd ? ` · $${course.price_usd}` : ''}</Td>
                    <Td>
                      <Badge tone={course.is_active ? 'emerald' : 'rose'}>{course.is_active ? 'Active' : 'Inactive'}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => checkCourseLink(course)}
                          disabled={catalogueBusy === course.course_id}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-40"
                          title="Check live URL"
                        >
                          {catalogueBusy === course.course_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => setCourseModal({ open: true, course })} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" title="Edit course">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deactivateCourse(course)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Deactivate course">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
          <Card className="overflow-hidden">
            <Pager total={courses.total} limit={10} offset={courseOffset} onChange={setCourseOffset} />
          </Card>
        </div>
      ) : null}

      {/* Roles */}
      {tab === 'roles' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{roles.length} career roles in the catalogue</p>
            <Button size="sm" icon={Plus} onClick={() => setRoleModal({ open: true, role: null })}>Add role</Button>
          </div>
          {loadingTab ? (
            <Loading label="Loading career roles…" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {roles.map((role) => (
                <Card key={role.role_id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{role.title}</h3>
                        <Badge tone="slate">{role.category}</Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{role.role_id}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setRoleModal({ open: true, role })} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" title="Edit role">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteRole(role)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete role">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{role.description || 'No description'}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(role.required_skills || []).slice(0, 8).map((skill) => (
                      <span key={skill} className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">{skill}</span>
                    ))}
                    {role.skill_count > 8 ? <span className="text-[10px] text-slate-400">+{role.skill_count - 8} more</span> : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    <span>{role.skill_count} required skills</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {role.learners} learners</span>
                  </div>
                </Card>
              ))}
              {!roles.length ? <EmptyState icon={Library} title="No career roles" description="Add a role to start building roadmaps." className="lg:col-span-2" /> : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Skills */}
      {tab === 'skills' ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <form onSubmit={runSkillSearch} className="flex flex-1 flex-wrap items-end gap-2">
                <Field label="Search skills" className="min-w-[220px] flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-9" value={skillDraft} onChange={(event) => setSkillDraft(event.target.value)} placeholder="Skill name or category" />
                  </div>
                </Field>
                <Button type="submit" size="sm" variant="secondary">Search</Button>
              </form>
              <Button size="sm" icon={Plus} onClick={() => setSkillModal({ open: true, skill: null })}>Add skill</Button>
            </div>
          </Card>
          {loadingTab ? (
            <Loading label="Loading skills…" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Skill</Th>
                  <Th>Category</Th>
                  <Th>Level</Th>
                  <Th>Aliases</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {skills.items?.map((skill) => (
                  <tr key={skill.skill_id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-semibold text-slate-900">{skill.skill_name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{skill.skill_id}</p>
                    </Td>
                    <Td>{skill.category}</Td>
                    <Td><Badge tone={skill.level === 'advanced' ? 'violet' : skill.level === 'intermediate' ? 'sky' : 'slate'}>{pretty(skill.level)}</Badge></Td>
                    <Td><span className="line-clamp-1 max-w-[240px]">{skill.aliases || '—'}</span></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setSkillModal({ open: true, skill })} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" title="Edit skill">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteSkill(skill)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete skill">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
          <Card className="overflow-hidden">
            <Pager total={skills.total} limit={25} offset={skillOffset} onChange={setSkillOffset} />
          </Card>
        </div>
      ) : null}

      {/* Resources */}
      {tab === 'resources' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{resources.length} curated learning resources</p>
            <Button size="sm" icon={Plus} onClick={() => setResourceModal({ open: true, resource: null })}>Add resource</Button>
          </div>
          {loadingTab ? (
            <Loading label="Loading resources…" />
          ) : resources.length === 0 ? (
            <EmptyState icon={Library} title="No resources yet" description="Add documentation, practice sites or guides." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {resources.map((resource) => (
                <Card key={resource.resource_id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-900">{resource.title}</h3>
                      <p className="text-[11px] text-slate-500">{resource.platform || resource.resource_type} · {resource.price_type}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setResourceModal({ open: true, resource })} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600" title="Edit resource">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteResource(resource)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete resource">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-slate-500">{resource.description || 'No description'}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(resource.skills || []).slice(0, 4).map((skill) => (
                      <span key={skill} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{skill}</span>
                    ))}
                  </div>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline">
                    Open resource <ExternalLink className="h-3 w-3" />
                  </a>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Roadmaps */}
      {tab === 'roadmaps' ? (
        loadingTab ? (
          <Loading label="Loading roadmaps…" />
        ) : roadmaps.length === 0 ? (
          <EmptyState icon={Layers} title="No roadmaps generated" description="Roadmaps appear when students complete onboarding." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Career goal</Th>
                <Th>Progress</Th>
                <Th>Plan</Th>
                <Th>Generated</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {roadmaps.map((roadmap) => (
                <tr key={roadmap.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-semibold text-slate-900">{roadmap.student}</p>
                    <p className="text-[11px] text-slate-500">{roadmap.email}</p>
                  </Td>
                  <Td>{roadmap.career_goal}</Td>
                  <Td>{roadmap.progress_recency?.completed_courses ?? 0} completed courses</Td>
                  <Td>
                    <p>{roadmap.total_hours ? `${Math.round(roadmap.total_hours)}h` : '—'} · {roadmap.total_weeks || '—'} weeks</p>
                    <p className="text-[10px] text-slate-400">Target {roadmap.expected_completion || '—'}</p>
                  </Td>
                  <Td>
                    <p>{formatDate(roadmap.created_at)}</p>
                    <p className="text-[10px] text-slate-400">{roadmap.generated_by || 'engine'}</p>
                  </Td>
                  <Td><Badge tone={roadmap.is_active ? 'emerald' : 'slate'}>{roadmap.is_active ? 'Active' : 'Archived'}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )
      ) : null}

      {/* Activity */}
      {tab === 'activity' ? (
        loadingTab ? (
          <Loading label="Loading audit log…" />
        ) : activity.length === 0 ? (
          <EmptyState icon={Activity} title="No activity recorded" description="Actions will appear here as students and admins use the platform." />
        ) : (
          <Card className="divide-y divide-slate-100">
            {activity.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Activity className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800">{pretty(entry.action)}</p>
                  <p className="text-[11px] text-slate-500">{entry.detail || 'No detail recorded'}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p className="font-medium text-slate-600">{entry.user}</p>
                  <p>{entry.email || 'system'}</p>
                  <p>{formatDateTime(entry.created_at)}</p>
                </div>
              </div>
            ))}
          </Card>
        )
      ) : null}

      <CourseModal
        open={courseModal.open}
        initial={courseModal.course}
        onClose={() => setCourseModal({ open: false, course: null })}
        onSaved={refresh}
        skillSuggestions={skillSuggestions}
      />
      <RoleModal
        open={roleModal.open}
        initial={roleModal.role}
        onClose={() => setRoleModal({ open: false, role: null })}
        onSaved={refresh}
        skillSuggestions={skillSuggestions}
      />
      <SkillModal
        open={skillModal.open}
        initial={skillModal.skill}
        onClose={() => setSkillModal({ open: false, skill: null })}
        onSaved={refresh}
      />
      <ResourceModal
        open={resourceModal.open}
        initial={resourceModal.resource}
        onClose={() => setResourceModal({ open: false, resource: null })}
        onSaved={refresh}
        skillSuggestions={skillSuggestions}
      />
      <StudentModal
        open={studentModal.open}
        student={studentModal.student}
        careerRoles={careerRoles}
        onClose={() => setStudentModal({ open: false, student: null })}
        onSaved={refresh}
      />
      <PasswordModal
        open={passwordModal.open}
        student={passwordModal.student}
        onClose={() => setPasswordModal({ open: false, student: null })}
      />
    </>
  )
}
