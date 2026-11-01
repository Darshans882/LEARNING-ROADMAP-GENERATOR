import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Briefcase, CalendarClock, Check, GraduationCap, Loader2, Save,
  Sparkles, Target, UserRound, Wrench,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Alert, Badge, Button, Card, Field, Loading, PageHeader, ProgressBar, Select, Tabs,
  TagInput, Textarea,
} from '../components/ui'

const TABS = [
  { value: 'personal', label: 'Personal' },
  { value: 'academic', label: 'Academic' },
  { value: 'skills', label: 'Skills' },
  { value: 'career', label: 'Career' },
  { value: 'experience', label: 'Experience' },
  { value: 'preferences', label: 'Preferences' },
  { value: 'time', label: 'Time & plan' },
]

const SUBJECTS = ['Data Structures', 'Algorithms', 'Databases', 'Operating Systems', 'Computer Networks', 'Statistics', 'Linear Algebra', 'Machine Learning', 'Software Engineering']
const LANGUAGES = ['Python', 'JavaScript', 'Java', 'C++', 'C', 'SQL', 'TypeScript', 'R', 'Go', 'Kotlin', 'Swift', 'PHP', 'Rust', 'Scala']
const FRAMEWORKS = ['React', 'Django', 'Flask', 'FastAPI', 'Node.js', 'Spring Boot', 'TensorFlow', 'PyTorch', 'Pandas', 'Scikit-learn', 'Next.js', 'Vue', 'Angular', 'Flutter']
const TOOLS = ['Git', 'GitHub', 'Docker', 'Kubernetes', 'VS Code', 'Jupyter', 'Figma', 'Postman', 'Linux', 'Excel', 'Power BI', 'Tableau']
const DATABASES = ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Snowflake', 'BigQuery']
const SOFT = ['Communication', 'Teamwork', 'Problem solving', 'Presentation', 'Leadership', 'Time management', 'Writing']
const POSITIONS = ['Internship', 'Junior', 'Entry-level', 'Associate', 'Full-time', 'Remote']

const EMPTY = {
  age: '', country: '', preferred_language: 'English',
  college_name: '', degree: '', department: '', current_year: '1', current_semester: '', cgpa: '',
  academic_subjects: [], previous_qualifications: '',
  programming_languages: [], frameworks: [], tools: [], databases: [], technical_skills: [], soft_skills: [],
  career_role_id: '', proficiency_level: 'Beginner', interested_industries: [], preferred_positions: [],
  short_term_goal: '', long_term_goal: '',
  previous_projects: '', internships: '', certifications: '', work_experience: '', portfolio_url: '',
  budget_pref: 'Both', preferred_platforms: [], learning_style: 'Practical', course_language: 'English',
  hours_per_day: 2, days_per_week: 5, target_completion_date: '', parallel_learning: false,
}

export default function Profile() {
  const { refreshUser, user } = useAuth()
  const [tab, setTab] = useState('personal')
  const [form, setForm] = useState(EMPTY)
  const [fullName, setFullName] = useState('')
  const [options, setOptions] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [optionsResponse, profileResponse, skillsResponse] = await Promise.all([
          api.get('/students/options'),
          api.get('/students/profile'),
          api.get('/skills').catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setOptions(optionsResponse.data)
        setSuggestions((skillsResponse.data || []).map((skill) => skill.skill_name).slice(0, 150))
        const profileData = profileResponse.data
        setProfile(profileData)
        setFullName(profileData.full_name || '')
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(current).map((key) => {
              const value = profileData[key]
              if (value === undefined || value === null) return [key, current[key]]
              if (Array.isArray(current[key])) return [key, Array.isArray(value) ? value : []]
              if (typeof current[key] === 'number') return [key, Number(value) || current[key]]
              return [key, value]
            }),
          ),
          target_completion_date: profileData.target_completion_date || '',
        }))
      } catch (error) {
        toast.error(errorMessage(error, 'Could not load your profile.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedRole = useMemo(
    () => options?.career_roles?.find((role) => role.role_id === form.career_role_id),
    [options, form.career_role_id],
  )
  const roleChanged = profile?.career_role_id !== form.career_role_id && form.career_role_id

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  async function save() {
    const nextErrors = {}
    if (!form.college_name.trim()) nextErrors.college_name = 'College is required.'
    if (!form.degree.trim()) nextErrors.degree = 'Degree is required.'
    if (!form.department.trim()) nextErrors.department = 'Department is required.'
    if (!form.career_role_id) nextErrors.career_role_id = 'Select a career goal.'
    if (form.cgpa && (Number(form.cgpa) < 0 || Number(form.cgpa) > 100)) nextErrors.cgpa = 'Enter 0–100.'
    if (!(Number(form.hours_per_day) >= 0.5 && Number(form.hours_per_day) <= 16)) nextErrors.hours_per_day = 'Enter 0.5–16 hours.'
    if (!(Number(form.days_per_week) >= 1 && Number(form.days_per_week) <= 7)) nextErrors.days_per_week = 'Choose 1–7 days.'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please fix the highlighted fields.')
      return
    }

    setSaving(true)
    try {
      if (fullName.trim() && fullName.trim() !== user?.full_name) {
        await api.patch('/auth/me', { full_name: fullName.trim() })
      }
      const payload = {
        ...form,
        age: form.age === '' ? null : Number(form.age),
        cgpa: form.cgpa === '' ? null : String(form.cgpa),
        hours_per_day: Number(form.hours_per_day),
        days_per_week: Number(form.days_per_week),
        target_completion_date: form.target_completion_date || null,
        current_semester: form.current_semester || null,
        portfolio_url: form.portfolio_url.trim() || null,
        previous_qualifications: form.previous_qualifications || null,
        short_term_goal: form.short_term_goal || null,
        long_term_goal: form.long_term_goal || null,
        previous_projects: form.previous_projects || null,
        internships: form.internships || null,
        certifications: form.certifications || null,
        work_experience: form.work_experience || null,
        country: form.country || null,
      }
      const { data } = await api.put('/students/profile', payload)
      setProfile(data)
      setForm((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.keys(current).map((key) => {
            const value = data[key]
            if (value === undefined || value === null) return [key, current[key]]
            if (Array.isArray(current[key])) return [key, Array.isArray(value) ? value : []]
            if (typeof current[key] === 'number') return [key, Number(value) || current[key]]
            return [key, value]
          }),
        ),
        target_completion_date: data.target_completion_date || '',
      }))
      await refreshUser().catch(() => {})
      toast.success(roleChanged ? 'Profile saved — your roadmap was regenerated for the new goal.' : 'Profile saved.')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading label="Loading your profile…" />

  return (
    <>
      <PageHeader
        eyebrow="Learner profile"
        title="Profile & preferences"
        description="Everything the recommendation engine knows about you. Changes are used immediately — a career change regenerates your roadmap."
        actions={
          <>
            <Link to="/roadmap" className="btn-secondary">View roadmap <ArrowRight className="h-4 w-4" /></Link>
            <Button onClick={save} loading={saving} icon={Save}>Save changes</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-base font-bold text-white">
                {(profile?.full_name || 'U').split(' ').map((part) => part[0]).slice(0, 2).join('')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{profile?.full_name}</p>
                <p className="truncate text-xs text-slate-500">{profile?.email}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Profile completeness</span>
                <span>{profile?.profile_completeness ?? 0}%</span>
              </div>
              <ProgressBar value={profile?.profile_completeness ?? 0} className="mt-2" showLabel={false} />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge tone="brand" icon={Target}>{selectedRole?.title || profile?.career_title || 'No goal yet'}</Badge>
              <Badge tone="slate">{form.proficiency_level}</Badge>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Profile updated {profile?.updated_at ? new Date(profile.updated_at).toLocaleString() : '—'}
            </p>
          </Card>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
            <p className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Tip
            </p>
            <p className="mt-1.5">
              Add concrete skills, tools and subjects. Evidence drives skill matching, which in
              turn decides which courses are skipped and which gaps are filled.
            </p>
          </div>
        </div>

        <div>
          <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

          {tab === 'personal' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <UserRound className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Personal details</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" className="sm:col-span-2">
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="input" />
                </Field>
                <Field label="Email">
                  <input value={profile?.email || ''} disabled className="input" />
                </Field>
                <Field label="Age" hint="13–100">
                  <input type="number" min="13" max="100" value={form.age} onChange={(event) => update('age', event.target.value)} className="input" />
                </Field>
                <Field label="Country">
                  <input value={form.country} onChange={(event) => update('country', event.target.value)} className="input" />
                </Field>
                <Field label="Preferred language">
                  <Select value={form.preferred_language} onChange={(event) => update('preferred_language', event.target.value)}>
                    {(options?.languages || ['English']).map((language) => <option key={language}>{language}</option>)}
                  </Select>
                </Field>
              </div>
            </Card>
          ) : null}

          {tab === 'academic' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Academic background</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="College / university" required error={errors.college_name} className="sm:col-span-2">
                  <input value={form.college_name} onChange={(event) => update('college_name', event.target.value)} className="input" />
                </Field>
                <Field label="Degree" required error={errors.degree}>
                  <input value={form.degree} onChange={(event) => update('degree', event.target.value)} className="input" />
                </Field>
                <Field label="Department" required error={errors.department}>
                  <input value={form.department} onChange={(event) => update('department', event.target.value)} className="input" />
                </Field>
                <Field label="Current year" required>
                  <Select value={form.current_year} onChange={(event) => update('current_year', event.target.value)}>
                    {(options?.years || ['1', '2', '3', '4', '5+']).map((year) => <option key={year} value={year}>{year === '5+' ? '5+' : `Year ${year}`}</option>)}
                  </Select>
                </Field>
                <Field label="Semester">
                  <Select value={form.current_semester} onChange={(event) => update('current_semester', event.target.value)}>
                    <option value="">Not applicable</option>
                    {(options?.semesters || []).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                  </Select>
                </Field>
                <Field label="CGPA / percentage" error={errors.cgpa}>
                  <input value={form.cgpa} onChange={(event) => update('cgpa', event.target.value)} className="input" />
                </Field>
                <Field label="Previous qualification">
                  <input value={form.previous_qualifications} onChange={(event) => update('previous_qualifications', event.target.value)} className="input" />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Subjects studied">
                  <TagInput value={form.academic_subjects} onChange={(value) => update('academic_subjects', value)} suggestions={SUBJECTS} />
                </Field>
              </div>
            </Card>
          ) : null}

          {tab === 'skills' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Technical & soft skills</h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Programming languages"><TagInput value={form.programming_languages} onChange={(value) => update('programming_languages', value)} suggestions={LANGUAGES} /></Field>
                <Field label="Frameworks & libraries"><TagInput value={form.frameworks} onChange={(value) => update('frameworks', value)} suggestions={FRAMEWORKS} /></Field>
                <Field label="Tools"><TagInput value={form.tools} onChange={(value) => update('tools', value)} suggestions={TOOLS} /></Field>
                <Field label="Databases"><TagInput value={form.databases} onChange={(value) => update('databases', value)} suggestions={DATABASES} /></Field>
                <Field label="Technical skills"><TagInput value={form.technical_skills} onChange={(value) => update('technical_skills', value)} suggestions={suggestions} /></Field>
                <Field label="Soft skills"><TagInput value={form.soft_skills} onChange={(value) => update('soft_skills', value)} suggestions={SOFT} /></Field>
              </div>
            </Card>
          ) : null}

          {tab === 'career' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Target className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Career preferences</h2>
              </div>
              {roleChanged ? (
                <Alert tone="warning" title="Changing your goal regenerates the roadmap" className="mb-4">
                  Saving a different career role creates a new active roadmap using your current
                  skills and availability. The previous roadmap is kept as history.
                </Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Career goal" required error={errors.career_role_id} className="sm:col-span-2">
                  <Select value={form.career_role_id} onChange={(event) => update('career_role_id', event.target.value)}>
                    <option value="">Select a role…</option>
                    {(options?.career_roles || []).map((role) => <option key={role.role_id} value={role.role_id}>{role.title} — {role.category}</option>)}
                  </Select>
                </Field>
                <Field label="Target proficiency">
                  <Select value={form.proficiency_level} onChange={(event) => update('proficiency_level', event.target.value)}>
                    {(options?.proficiency_levels || []).map((level) => <option key={level}>{level}</option>)}
                  </Select>
                </Field>
                <Field label="Preferred positions">
                  <TagInput value={form.preferred_positions} onChange={(value) => update('preferred_positions', value)} suggestions={POSITIONS} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Industries">
                  <TagInput value={form.interested_industries} onChange={(value) => update('interested_industries', value)} suggestions={options?.industries || []} />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Short-term goal"><Textarea value={form.short_term_goal} onChange={(event) => update('short_term_goal', event.target.value)} /></Field>
                <Field label="Long-term goal"><Textarea value={form.long_term_goal} onChange={(event) => update('long_term_goal', event.target.value)} /></Field>
              </div>
            </Card>
          ) : null}

          {tab === 'experience' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Experience & evidence</h2>
              </div>
              <div className="space-y-4">
                <Field label="Previous projects"><Textarea rows={4} value={form.previous_projects} onChange={(event) => update('previous_projects', event.target.value)} placeholder="Projects, stack and outcomes" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Internships"><Textarea value={form.internships} onChange={(event) => update('internships', event.target.value)} /></Field>
                  <Field label="Work experience"><Textarea value={form.work_experience} onChange={(event) => update('work_experience', event.target.value)} /></Field>
                  <Field label="Certifications"><Textarea value={form.certifications} onChange={(event) => update('certifications', event.target.value)} /></Field>
                  <Field label="Portfolio / GitHub"><input value={form.portfolio_url} onChange={(event) => update('portfolio_url', event.target.value)} placeholder="https://" className="input" /></Field>
                </div>
              </div>
            </Card>
          ) : null}

          {tab === 'preferences' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Learning preferences</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget preference">
                  <Select value={form.budget_pref} onChange={(event) => update('budget_pref', event.target.value)}>
                    {(options?.budget_prefs || []).map((option) => <option key={option}>{option}</option>)}
                  </Select>
                </Field>
                <Field label="Learning style">
                  <Select value={form.learning_style} onChange={(event) => update('learning_style', event.target.value)}>
                    {(options?.learning_styles || []).map((style) => <option key={style}>{style}</option>)}
                  </Select>
                </Field>
                <Field label="Course language">
                  <Select value={form.course_language} onChange={(event) => update('course_language', event.target.value)}>
                    {(options?.languages || ['English']).map((language) => <option key={language}>{language}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Preferred platforms">
                  <TagInput value={form.preferred_platforms} onChange={(value) => update('preferred_platforms', value)} suggestions={options?.platforms || []} />
                </Field>
              </div>
              <Alert tone="info" className="mt-4">
                Preferences change ranking, not facts. Verified and unverified links are always
                labelled from the stored catalogue.
              </Alert>
            </Card>
          ) : null}

          {tab === 'time' ? (
            <Card className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Time & availability</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hours per study day" error={errors.hours_per_day}>
                  <input type="number" min="0.5" max="16" step="0.5" value={form.hours_per_day} onChange={(event) => update('hours_per_day', event.target.value)} className="input" />
                </Field>
                <Field label="Days per week" error={errors.days_per_week}>
                  <Select value={form.days_per_week} onChange={(event) => update('days_per_week', Number(event.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days} day{days > 1 ? 's' : ''}</option>)}
                  </Select>
                </Field>
                <Field label="Target completion date" hint="Existing plans are checked for feasibility.">
                  <input type="date" value={form.target_completion_date} onChange={(event) => update('target_completion_date', event.target.value)} className="input" />
                </Field>
                <Field label="Parallel learning">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${form.parallel_learning ? 'border-brand-300 bg-brand-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={form.parallel_learning} onChange={(event) => update('parallel_learning', event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Allow parallel courses</span>
                      <span className="block text-xs text-slate-500">Up to three courses inside a phase run in parallel.</span>
                    </span>
                  </label>
                </Field>
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Weekly capacity</p>
                <p className="mt-0.5 text-2xl font-extrabold text-slate-900">
                  {Math.round(Number(form.hours_per_day) * Number(form.days_per_week) * 10) / 10}h
                </p>
                <p className="text-xs text-slate-500">Used to sequence courses and calculate expected completion.</p>
              </div>
              {profile?.career_role_id ? (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                  <p className="text-xs text-brand-800">Regenerate the roadmap after changing time settings so the schedule reflects them.</p>
                  <Link to="/roadmap" className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-900">Open roadmap</Link>
                </div>
              ) : null}
            </Card>
          ) : null}

          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved changes are used by every engine feature.
            </p>
            <Button onClick={save} loading={saving} icon={Save}>Save changes</Button>
          </div>
        </div>
      </div>
    </>
  )
}
