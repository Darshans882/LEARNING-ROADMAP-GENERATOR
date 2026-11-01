import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, BookOpen, Briefcase, CalendarClock, Check, CheckCircle2,
  GraduationCap, Loader2, Rocket, Sparkles, Target, UserRound, Wrench,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Alert, Badge, Button, Field, ProgressBar, Select, TagInput, Textarea } from '../components/ui'
import Logo from '../components/Logo'

const STEPS = [
  { id: 'personal', title: 'Personal', icon: UserRound, hint: 'A little about you' },
  { id: 'academic', title: 'Academics', icon: GraduationCap, hint: 'College and coursework' },
  { id: 'skills', title: 'Skills', icon: Wrench, hint: 'What you already know' },
  { id: 'career', title: 'Career goal', icon: Target, hint: 'Where you want to go' },
  { id: 'experience', title: 'Experience', icon: Briefcase, hint: 'Projects and work' },
  { id: 'preferences', title: 'Preferences', icon: BookOpen, hint: 'How you like to learn' },
  { id: 'availability', title: 'Availability', icon: CalendarClock, hint: 'Time and schedule' },
]

const SUBJECT_SUGGESTIONS = ['Data Structures', 'Algorithms', 'Databases', 'Operating Systems', 'Computer Networks', 'Statistics', 'Linear Algebra', 'Machine Learning', 'Software Engineering']
const LANGUAGE_SUGGESTIONS = ['Python', 'JavaScript', 'Java', 'C++', 'C', 'SQL', 'TypeScript', 'R', 'Go', 'Kotlin', 'Swift', 'PHP', 'Rust', 'Scala']
const FRAMEWORK_SUGGESTIONS = ['React', 'Django', 'Flask', 'FastAPI', 'Node.js', 'Spring Boot', 'TensorFlow', 'PyTorch', 'Pandas', 'Scikit-learn', 'Next.js', 'Vue', 'Angular', 'Flutter']
const TOOL_SUGGESTIONS = ['Git', 'GitHub', 'Docker', 'Kubernetes', 'VS Code', 'Jupyter', 'Figma', 'Postman', 'Linux', 'Excel', 'Power BI', 'Tableau']
const DATABASE_SUGGESTIONS = ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Snowflake', 'BigQuery']
const SOFT_SUGGESTIONS = ['Communication', 'Teamwork', 'Problem solving', 'Presentation', 'Leadership', 'Time management', 'Writing']
const POSITION_SUGGESTIONS = ['Internship', 'Junior', 'Entry-level', 'Associate', 'Full-time', 'Remote']

const DEFAULT_FORM = {
  age: '',
  country: '',
  preferred_language: 'English',
  college_name: '',
  degree: '',
  department: '',
  current_year: '1',
  current_semester: '',
  cgpa: '',
  academic_subjects: [],
  previous_qualifications: '',
  programming_languages: [],
  frameworks: [],
  tools: [],
  databases: [],
  technical_skills: [],
  soft_skills: [],
  career_role_id: '',
  proficiency_level: 'Beginner',
  interested_industries: [],
  preferred_positions: [],
  short_term_goal: '',
  long_term_goal: '',
  previous_projects: '',
  internships: '',
  certifications: '',
  work_experience: '',
  portfolio_url: '',
  budget_pref: 'Both',
  preferred_platforms: [],
  learning_style: 'Practical',
  course_language: 'English',
  hours_per_day: 2,
  days_per_week: 5,
  target_completion_date: '',
  parallel_learning: false,
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function Onboarding() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [options, setOptions] = useState(null)
  const [skillSuggestions, setSkillSuggestions] = useState({ technical: [], categories: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')

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
        const skills = Array.isArray(skillsResponse.data) ? skillsResponse.data : []
        setSkillSuggestions({
          technical: skills.map((s) => s.skill_name).slice(0, 120),
          categories: [...new Set(skills.map((s) => s.category))],
        })
        const profile = profileResponse.data || {}
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(current).map((key) => {
              const value = profile[key]
              if (value === undefined || value === null) return [key, current[key]]
              if (Array.isArray(current[key])) return [key, Array.isArray(value) ? value : []]
              if (typeof current[key] === 'number') return [key, Number(value) || current[key]]
              return [key, value]
            }),
          ),
          target_completion_date: profile.target_completion_date || '',
        }))
      } catch (error) {
        toast.error(errorMessage(error, 'Could not load onboarding options.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const current = STEPS[stepIndex]
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100)

  const selectedRole = useMemo(
    () => options?.career_roles?.find((role) => role.role_id === form.career_role_id),
    [options, form.career_role_id],
  )

  function update(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    if (errors[field]) setErrors((currentErrors) => ({ ...currentErrors, [field]: '' }))
  }

  function validateStep(index) {
    const nextErrors = {}
    if (index === 1) {
      if (!form.college_name.trim()) nextErrors.college_name = 'College or university is required.'
      if (!form.degree.trim()) nextErrors.degree = 'Degree is required.'
      if (!form.department.trim()) nextErrors.department = 'Department is required.'
      if (!form.current_year) nextErrors.current_year = 'Select your current year.'
      if (form.cgpa && (Number(form.cgpa) < 0 || Number(form.cgpa) > 100)) nextErrors.cgpa = 'Enter a value between 0 and 100.'
    }
    if (index === 3 && !form.career_role_id) nextErrors.career_role_id = 'Choose the career role you are targeting.'
    if (index === 6) {
      if (!(Number(form.hours_per_day) >= 0.5 && Number(form.hours_per_day) <= 16)) {
        nextErrors.hours_per_day = 'Enter between 0.5 and 16 hours per day.'
      }
      if (!(Number(form.days_per_week) >= 1 && Number(form.days_per_week) <= 7)) {
        nextErrors.days_per_week = 'Choose between 1 and 7 days per week.'
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function next() {
    if (!validateStep(stepIndex)) return
    setStepIndex((index) => Math.min(STEPS.length - 1, index + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setStepIndex((index) => Math.max(0, index - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function buildPayload() {
    return {
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
  }

  async function submit() {
    for (let index = 0; index < STEPS.length; index += 1) {
      if (!validateStep(index)) {
        setStepIndex(index)
        return
      }
    }
    setSaving(true)
    setSubmitError('')
    try {
      const { data } = await api.post('/students/onboarding', buildPayload())
      await refreshUser().catch(() => {})
      toast.success(data.message || 'Your roadmap is ready!')
      navigate('/roadmap', { replace: true })
    } catch (error) {
      setSubmitError(errorMessage(error, 'Could not finish onboarding. Review your details and try again.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm">Preparing your onboarding…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:block">
              {user?.full_name ? `Signed in as ${user.full_name}` : 'Your learner profile'}
            </span>
            <Badge tone="brand" icon={Sparkles}>Personalize</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Profile setup</span>
                <span>{progress}%</span>
              </div>
              <ProgressBar value={progress} className="mt-2" />
            </div>
            <ol className="space-y-1">
              {STEPS.map((step, index) => {
                const isDone = index < stepIndex
                const isActive = index === stepIndex
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (index <= stepIndex || validateStep(stepIndex)) setStepIndex(index)
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                        isActive ? 'bg-brand-50 text-brand-800' : isDone ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-700'
                            : isActive
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{step.title}</span>
                        <span className="block truncate text-[11px] text-slate-400">{step.hint}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
          <div className="mt-4 hidden rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500 lg:block">
            <p className="font-semibold text-slate-700">Why we ask</p>
            <p className="mt-1.5">
              Your weekly hours, current skills and prerequisites determine the roadmap order and
              the expected completion date. You can edit everything later in Profile.
            </p>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">{current.title}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <current.icon className="h-5 w-5" />
            </span>
          </div>

          {stepIndex === 0 ? (
            <SectionCard icon={UserRound} title="Tell us a little about yourself" description="This helps us localize course language and keep your learner profile complete.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Age" hint="Optional, 13–100">
                  <input
                    type="number"
                    min="13"
                    max="100"
                    value={form.age}
                    onChange={(event) => update('age', event.target.value)}
                    placeholder="e.g. 21"
                    className="input"
                  />
                </Field>
                <Field label="Country">
                  <input
                    value={form.country}
                    onChange={(event) => update('country', event.target.value)}
                    placeholder="e.g. India"
                    className="input"
                  />
                </Field>
                <Field label="Preferred course language">
                  <Select value={form.preferred_language} onChange={(event) => update('preferred_language', event.target.value)}>
                    {(options?.languages || ['English']).map((language) => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Current proficiency" hint="Used as a starting signal for the engine.">
                  <Select value={form.proficiency_level} onChange={(event) => update('proficiency_level', event.target.value)}>
                    {(options?.proficiency_levels || ['Beginner']).map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Alert tone="info" title="Your data stays in this workspace">
                SmartLearn uses your answers only to build your profile, analysis, roadmap and
                grounded assistant answers. You can export or edit your profile later.
              </Alert>
            </SectionCard>
          ) : null}

          {stepIndex === 1 ? (
            <SectionCard icon={GraduationCap} title="Your academic background" description="We use your degree, department and subjects as evidence for foundational skills.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="College / university" required error={errors.college_name} className="sm:col-span-2">
                  <input
                    value={form.college_name}
                    onChange={(event) => update('college_name', event.target.value)}
                    placeholder="e.g. Anna University"
                    className="input"
                  />
                </Field>
                <Field label="Degree" required error={errors.degree}>
                  <input
                    value={form.degree}
                    onChange={(event) => update('degree', event.target.value)}
                    placeholder="e.g. B.Tech"
                    className="input"
                  />
                </Field>
                <Field label="Department / major" required error={errors.department}>
                  <input
                    value={form.department}
                    onChange={(event) => update('department', event.target.value)}
                    placeholder="e.g. Computer Science"
                    className="input"
                  />
                </Field>
                <Field label="Current year" required error={errors.current_year}>
                  <Select value={form.current_year} onChange={(event) => update('current_year', event.target.value)}>
                    {(options?.years || ['1', '2', '3', '4', '5+']).map((year) => (
                      <option key={year} value={year}>{year === '5+' ? '5th year or beyond' : `Year ${year}`}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Current semester">
                  <Select value={form.current_semester} onChange={(event) => update('current_semester', event.target.value)}>
                    <option value="">Not applicable</option>
                    {(options?.semesters || []).map((semester) => (
                      <option key={semester} value={semester}>Semester {semester}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="CGPA / percentage" hint="Numeric, 0–100." error={errors.cgpa}>
                  <input
                    value={form.cgpa}
                    onChange={(event) => update('cgpa', event.target.value)}
                    placeholder="e.g. 8.4 or 84"
                    className="input"
                  />
                </Field>
                <Field label="Previous qualification">
                  <input
                    value={form.previous_qualifications}
                    onChange={(event) => update('previous_qualifications', event.target.value)}
                    placeholder="e.g. Higher Secondary (Science)"
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Subjects studied" hint="Press Enter after each subject. These support you in skill analysis.">
                <TagInput
                  value={form.academic_subjects}
                  onChange={(value) => update('academic_subjects', value)}
                  suggestions={SUBJECT_SUGGESTIONS}
                  placeholder="Add a subject…"
                />
              </Field>
            </SectionCard>
          ) : null}

          {stepIndex === 2 ? (
            <SectionCard icon={Wrench} title="What can you already do?" description="Be honest — this decides which skills are marked as gaps and where your roadmap starts.">
              <Alert tone="info">
                Add technologies you can use independently. Course and project recommendations
                will respect prerequisites and skip skills you already have.
              </Alert>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Programming languages">
                  <TagInput value={form.programming_languages} onChange={(value) => update('programming_languages', value)} suggestions={LANGUAGE_SUGGESTIONS} />
                </Field>
                <Field label="Frameworks & libraries">
                  <TagInput value={form.frameworks} onChange={(value) => update('frameworks', value)} suggestions={FRAMEWORK_SUGGESTIONS} />
                </Field>
                <Field label="Tools">
                  <TagInput value={form.tools} onChange={(value) => update('tools', value)} suggestions={TOOL_SUGGESTIONS} />
                </Field>
                <Field label="Databases">
                  <TagInput value={form.databases} onChange={(value) => update('databases', value)} suggestions={DATABASE_SUGGESTIONS} />
                </Field>
                <Field label="Other technical skills" hint="Type skill names; suggestions come from the catalogue.">
                  <TagInput value={form.technical_skills} onChange={(value) => update('technical_skills', value)} suggestions={skillSuggestions.technical} />
                </Field>
                <Field label="Soft skills">
                  <TagInput value={form.soft_skills} onChange={(value) => update('soft_skills', value)} suggestions={SOFT_SUGGESTIONS} />
                </Field>
              </div>
            </SectionCard>
          ) : null}

          {stepIndex === 3 ? (
            <SectionCard icon={Target} title="Choose your target role" description="Your roadmap, phases and course picks are generated for this role.">
              <Field label="Career goal" required error={errors.career_role_id}>
                <Select value={form.career_role_id} onChange={(event) => update('career_role_id', event.target.value)}>
                  <option value="">Select a role…</option>
                  {(options?.career_roles || []).map((role) => (
                    <option key={role.role_id} value={role.role_id}>{role.title} — {role.category}</option>
                  ))}
                </Select>
              </Field>
              {selectedRole ? (
                <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                  <p className="text-sm font-semibold text-brand-900">{selectedRole.title}</p>
                  <p className="mt-0.5 text-xs text-brand-700">Category: {selectedRole.category}</p>
                  <p className="mt-2 text-xs leading-relaxed text-brand-800/80">
                    The engine will compare this role’s required skills with your profile, respect
                    skill prerequisites, and build ordered phases ending in projects and checkpoints.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Target proficiency">
                  <Select value={form.proficiency_level} onChange={(event) => update('proficiency_level', event.target.value)}>
                    {(options?.proficiency_levels || []).map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Preferred positions">
                  <TagInput value={form.preferred_positions} onChange={(value) => update('preferred_positions', value)} suggestions={POSITION_SUGGESTIONS} />
                </Field>
              </div>
              <Field label="Industries you are interested in">
                <TagInput value={form.interested_industries} onChange={(value) => update('interested_industries', value)} suggestions={options?.industries || []} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Short-term goal" hint="e.g. land a summer internship">
                  <Textarea value={form.short_term_goal} onChange={(event) => update('short_term_goal', event.target.value)} placeholder="What do you want in the next 3–6 months?" />
                </Field>
                <Field label="Long-term goal">
                  <Textarea value={form.long_term_goal} onChange={(event) => update('long_term_goal', event.target.value)} placeholder="Where do you want to be in 2–3 years?" />
                </Field>
              </div>
            </SectionCard>
          ) : null}

          {stepIndex === 4 ? (
            <SectionCard icon={Briefcase} title="Experience and evidence" description="Optional, but it helps the analyzer recognise skills you learned outside coursework.">
              <div className="grid gap-4">
                <Field label="Previous projects">
                  <Textarea value={form.previous_projects} onChange={(event) => update('previous_projects', event.target.value)} placeholder="Describe 1–3 projects, the stack you used and what you shipped." rows={4} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Internships">
                    <Textarea value={form.internships} onChange={(event) => update('internships', event.target.value)} placeholder="Company, role, duration and work" />
                  </Field>
                  <Field label="Work experience">
                    <Textarea value={form.work_experience} onChange={(event) => update('work_experience', event.target.value)} placeholder="Part-time, freelance or full-time roles" />
                  </Field>
                  <Field label="Certifications">
                    <Textarea value={form.certifications} onChange={(event) => update('certifications', event.target.value)} placeholder="Course or certification names" />
                  </Field>
                  <Field label="Portfolio / GitHub URL">
                    <input
                      value={form.portfolio_url}
                      onChange={(event) => update('portfolio_url', event.target.value)}
                      placeholder="https://github.com/you"
                      className="input"
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {stepIndex === 5 ? (
            <SectionCard icon={BookOpen} title="Learning preferences" description="These filters shape course recommendations, but never override verification.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget preference">
                  <Select value={form.budget_pref} onChange={(event) => update('budget_pref', event.target.value)}>
                    {(options?.budget_prefs || ['Free', 'Paid', 'Both']).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Learning style">
                  <Select value={form.learning_style} onChange={(event) => update('learning_style', event.target.value)}>
                    {(options?.learning_styles || ['Video', 'Reading', 'Practical', 'Mixed']).map((style) => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Course language">
                  <Select value={form.course_language} onChange={(event) => update('course_language', event.target.value)}>
                    {(options?.languages || ['English']).map((language) => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Preferred platforms" hint="Recommendations from these platforms are ranked higher when possible.">
                <TagInput value={form.preferred_platforms} onChange={(value) => update('preferred_platforms', value)} suggestions={options?.platforms || []} />
              </Field>
              <Alert tone="warning" title="Honest catalogue policy">
                We never invent course prices, ratings or durations. A recommendation that points to
                an official catalogue or search page is marked unverified so you can confirm it.
              </Alert>
            </SectionCard>
          ) : null}

          {stepIndex === 6 ? (
            <SectionCard icon={CalendarClock} title="How much time can you study?" description="The schedule calculator uses course hours, assignments, revision, projects and this capacity.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Hours per study day" required error={errors.hours_per_day}>
                  <input
                    type="number"
                    min="0.5"
                    max="16"
                    step="0.5"
                    value={form.hours_per_day}
                    onChange={(event) => update('hours_per_day', event.target.value)}
                    className="input"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[1, 1.5, 2, 3, 4, 6].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => update('hours_per_day', hours)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${Number(form.hours_per_day) === hours ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Days per week" required error={errors.days_per_week}>
                  <Select value={form.days_per_week} onChange={(event) => update('days_per_week', Number(event.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                      <option key={days} value={days}>{days} day{days > 1 ? 's' : ''} / week</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Target completion date" hint="Optional. The engine checks whether your plan is feasible by then.">
                  <input
                    type="date"
                    value={form.target_completion_date}
                    onChange={(event) => update('target_completion_date', event.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Parallel learning">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${form.parallel_learning ? 'border-brand-300 bg-brand-50' : 'border-slate-200'}`}>
                    <input
                      type="checkbox"
                      checked={form.parallel_learning}
                      onChange={(event) => update('parallel_learning', event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Allow parallel courses</span>
                      <span className="block text-xs text-slate-500">Study up to three courses inside the same phase at once. Phases stay ordered.</span>
                    </span>
                  </label>
                </Field>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">Ready to generate your roadmap</p>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-slate-500">Career goal</dt><dd className="font-medium text-slate-800">{selectedRole?.title || 'Not selected'}</dd></div>
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-slate-500">Weekly capacity</dt><dd className="font-medium text-slate-800">{Number(form.hours_per_day) * Number(form.days_per_week)} hours / week</dd></div>
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-slate-500">Current skills</dt><dd className="font-medium text-slate-800">{form.technical_skills.length + form.programming_languages.length + form.frameworks.length} listed</dd></div>
                  <div className="flex justify-between gap-2 sm:block"><dt className="text-slate-500">Target date</dt><dd className="font-medium text-slate-800">{form.target_completion_date || 'Engine-calculated'}</dd></div>
                </dl>
              </div>
              {submitError ? <Alert tone="danger" title="Could not finish onboarding">{submitError}</Alert> : null}
            </SectionCard>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <Button variant="ghost" onClick={back} disabled={stepIndex === 0} icon={ArrowLeft}>
              Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} loading={saving} icon={Rocket} size="lg">
                Generate my roadmap
              </Button>
            )}
          </div>
        </section>
      </main>

      {saving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="mt-4 text-base font-bold text-slate-900">Building your personalized roadmap…</p>
            <p className="mt-1 text-sm text-slate-500">
              Analyzing skill gaps, matching catalogue courses, sequencing prerequisites and
              calculating your schedule.
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-500" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
