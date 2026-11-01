import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Cpu, Database, Download, ExternalLink, KeyRound, LogOut, Mail,
  Settings2, ShieldCheck, UserRound, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { errorMessage, formatDate } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Alert, Badge, Button, Card, Field, Loading, PageHeader, Spinner,
} from '../components/ui'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  )
}

export default function Settings() {
  const { user, refreshUser, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [health, setHealth] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingAccount, setSavingAccount] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm: '' })

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      api.get('/students/profile'),
      api.get('/ai/status'),
      api.get('/health'),
    ]).then(([profileResult, aiResult, healthResult]) => {
      if (cancelled) return
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value.data)
      if (aiResult.status === 'fulfilled') setAiStatus(aiResult.value.data)
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value.data)
      setLoadingProfile(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setFullName(user?.full_name || '')
  }, [user?.full_name])

  const capacity = useMemo(() => {
    if (!profile?.hours_per_day || !profile?.days_per_week) return null
    return {
      daily: profile.hours_per_day,
      days: profile.days_per_week,
      weekly: (profile.hours_per_day * profile.days_per_week).toFixed(1),
    }
  }, [profile])

  async function saveAccount(event) {
    event.preventDefault()
    if (fullName.trim().length < 2) {
      toast.error('Full name must be at least 2 characters.')
      return
    }
    setSavingAccount(true)
    try {
      await api.patch('/auth/me', { full_name: fullName.trim() })
      await refreshUser()
      toast.success('Account updated')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSavingAccount(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm) {
      toast.error('New passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({ current_password: '', new_password: '', confirm: '' })
      toast.success('Password updated')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSavingPassword(false)
    }
  }

  async function exportData() {
    setExporting(true)
    try {
      const { data } = await api.get('/auth/me/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `smartlearn-account-${user?.id || 'export'}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Account data downloaded')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not export your account data.'))
    } finally {
      setExporting(false)
    }
  }

  function signOut() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Account & preferences"
        description="Manage your identity, security, data export and see which AI components are active."
        actions={
          <Link to="/profile" className="btn-secondary">
            <Settings2 className="h-4 w-4" /> Edit learning profile
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Account details</h2>
            </div>
            <form onSubmit={saveAccount} className="space-y-4">
              <Field label="Full name" required>
                <input
                  className="input"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  minLength={2}
                  maxLength={150}
                  placeholder="Your full name"
                />
              </Field>
              <Field label="Email address" hint="Email changes are handled by an administrator to protect your account.">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input bg-slate-50 pl-9 text-slate-500" value={user?.email || ''} disabled />
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" loading={savingAccount} disabled={fullName.trim() === (user?.full_name || '')}>
                  Save changes
                </Button>
                <Badge tone="slate">Role: {user?.role}</Badge>
                <Badge tone={user?.onboarding_completed ? 'emerald' : 'amber'}>
                  {user?.onboarding_completed ? 'Onboarded' : 'Onboarding incomplete'}
                </Badge>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Security</h2>
            </div>
            <form onSubmit={changePassword} className="space-y-4">
              <Field label="Current password" required>
                <input
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  value={passwordForm.current_password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" hint="8+ characters with letters and numbers." required>
                  <input
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.new_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                    required
                  />
                </Field>
                <Field
                  label="Confirm new password"
                  error={passwordForm.confirm && passwordForm.confirm !== passwordForm.new_password ? 'Passwords do not match' : undefined}
                  required
                >
                  <input
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    value={passwordForm.confirm}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))}
                    required
                  />
                </Field>
              </div>
              <Button type="submit" loading={savingPassword} icon={ShieldCheck}>
                Update password
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Learning preferences</h2>
              <Link to="/profile" className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-800">
                Edit
              </Link>
            </div>
            {loadingProfile ? (
              <Loading label="Loading preferences…" className="min-h-[120px]" />
            ) : profile ? (
              <dl>
                <Row label="Target role" value={profile.desired_role || summaryFallback(profile)} />
                <Row label="Proficiency level" value={profile.proficiency_level} />
                <Row label="Learning style" value={profile.learning_style} />
                <Row label="Budget preference" value={profile.budget_pref} />
                <Row label="Course language" value={profile.course_language || profile.preferred_language} />
                <Row label="Preferred platforms" value={(profile.preferred_platforms || []).join(', ') || 'No preference'} />
                <Row
                  label="Study capacity"
                  value={capacity ? `${capacity.daily}h/day × ${capacity.days} days = ${capacity.weekly}h/week` : 'Not set'}
                />
                <Row label="Parallel learning" value={profile.parallel_learning ? 'Allowed where safe' : 'Sequential only'} />
                <Row label="Target completion" value={profile.target_completion_date ? formatDate(profile.target_completion_date) : 'Auto-calculated'} />
              </dl>
            ) : (
              <Alert tone="warning" title="Profile unavailable">
                We could not load your profile preferences. <Link className="font-semibold underline" to="/profile">Open profile</Link>
              </Alert>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">AI engine</h2>
            </div>
            {aiStatus ? (
              <div className="space-y-3">
                <Alert tone={aiStatus.available ? 'success' : 'info'} title={aiStatus.available ? 'LLM-enhanced mode' : 'Deterministic curated mode'}>
                  {aiStatus.available
                    ? `${aiStatus.provider} · ${aiStatus.model} is generating explanations. Course metadata still comes only from the catalogue.`
                    : 'No LLM key is configured. Roadmaps, recommendations and the assistant run fully offline from curated data.'}
                </Alert>
                <dl>
                  <Row label="Provider" value={aiStatus.provider || 'none'} />
                  <Row label="Model" value={aiStatus.model || 'deterministic templates'} />
                  <Row label="RAG backend" value={aiStatus.rag_backend} />
                  <Row label="URL validation" value={aiStatus.course_url_validation ? 'Enabled' : 'Manual only'} />
                </dl>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  To enable an LLM, set <code className="rounded bg-slate-100 px-1">LLM_API_KEY</code> and related
                  variables in the backend <code className="rounded bg-slate-100 px-1">.env</code>.
                </p>
              </div>
            ) : (
              <div className="flex justify-center py-6"><Spinner /></div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">System status</h2>
            </div>
            {health ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-xs font-medium text-slate-600">API</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {health.status}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-xs font-medium text-slate-600">Database ({health.database})</span>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${health.db_status === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {health.db_status === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {health.db_status}
                  </span>
                </div>
                <dl>
                  <Row label="Version" value={health.version} />
                  <Row label="Environment" value={health.environment} />
                </dl>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Health information is unavailable.</p>
            )}
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Open API docs (Swagger) <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Download className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Data & privacy</h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Download a JSON copy of your account and profile summary. Course progress and roadmap data remain in the
              application database.
            </p>
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" onClick={exportData} loading={exporting} icon={Download}>
                Export my account data
              </Button>
              {isAdmin ? (
                <Link to="/admin" className="btn-secondary">
                  <ShieldCheck className="h-4 w-4" /> Open admin console
                </Link>
              ) : null}
              <Button variant="ghost" onClick={signOut} icon={LogOut}>
                Sign out of this device
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Account created</span>
                <span className="font-medium text-slate-800">{formatDate(user?.created_at)}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Passwords are stored as bcrypt hashes. Sessions use signed JWTs and expire automatically.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function summaryFallback(profile) {
  return profile?.career_role_id ? profile.career_role_id.replace(/-/g, ' ') : 'Not selected'
}
