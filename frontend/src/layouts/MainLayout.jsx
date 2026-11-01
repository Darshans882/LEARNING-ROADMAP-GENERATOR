import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, BarChart3, BookOpen, Bot, Briefcase, ChevronDown, Compass, FolderKanban,
  LayoutDashboard, LogOut, Menu, Settings, Shield, Sparkles, UserRound, X, CalendarRange, Route,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api, { initials } from '../api/client'
import Logo from '../components/Logo'
import Chatbot from '../components/Chatbot'
import { Badge } from '../components/ui'

const NAV = [
  {
    label: 'Learn',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/roadmap', label: 'My Roadmap', icon: Route },
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/skills', label: 'Skill Analysis', icon: BarChart3 },
      { to: '/careers', label: 'Career Explorer', icon: Compass },
      { to: '/progress', label: 'Progress', icon: Activity },
      { to: '/planner', label: 'Study Planner', icon: CalendarRange },
      { to: '/assistant', label: 'AI Assistant', icon: Bot },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: UserRound },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const TITLES = {
  '/dashboard': 'Dashboard',
  '/roadmap': 'My Roadmap',
  '/courses': 'Course Catalogue',
  '/projects': 'Projects',
  '/skills': 'Skill Analysis',
  '/careers': 'Career Explorer',
  '/progress': 'Progress',
  '/planner': 'Study Planner',
  '/assistant': 'AI Assistant',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/admin': 'Admin Console',
}

function NavItems({ onNavigate }) {
  const { user, isAdmin } = useAuth()
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-brand-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/roadmap' && user?.onboarding_completed ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
      {isAdmin ? (
        <div>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Administration
          </p>
          <NavLink
            to="/admin"
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Shield className="h-4 w-4 text-amber-300" />
            Admin Console
          </NavLink>
        </div>
      ) : null}
    </nav>
  )
}

export default function MainLayout() {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    setMobileOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    api.get('/ai/status').then(({ data }) => setAiStatus(data)).catch(() => {})
  }, [])

  useEffect(() => {
    function handler(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const title = TITLES[location.pathname] || 'SmartLearn AI'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 lg:flex">
        <div className="flex h-16 items-center border-b border-white/5 px-5">
          <Link to="/dashboard"><Logo light /></Link>
        </div>
        <NavItems />
        <div className="border-t border-white/5 p-3">
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              {aiStatus?.available ? 'LLM-enhanced engine' : 'Curated AI engine'}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {aiStatus?.available
                ? `${aiStatus.provider} · ${aiStatus.model}`
                : 'Deterministic, fully offline. Grounded in your catalogue.'}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-slate-400">RAG: {aiStatus?.rag_backend || 'tfidf'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
              <Logo light size="sm" />
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{title}</p>
              <p className="hidden text-[11px] text-slate-500 sm:block">
                {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
              </p>
            </div>
            {isAdmin ? <Badge tone="amber" icon={Shield}>Admin</Badge> : <Badge tone="brand" icon={Briefcase}>{user?.role === 'student' ? 'Student' : user?.role}</Badge>}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white">
                  {initials(user?.full_name) || 'U'}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-700 sm:block">
                  {user?.full_name?.split(' ')[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{user?.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <div className="p-1.5">
                    <Link to="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      <UserRound className="h-4 w-4" /> Profile
                    </Link>
                    <Link to="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    {isAdmin ? (
                      <Link to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                        <Shield className="h-4 w-4" /> Admin console
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 text-center text-[11px] text-slate-400 sm:px-6 lg:px-8">
          SmartLearn AI · Course links come from the stored catalogue. Always verify details on the provider page.
        </footer>
      </div>
      <Chatbot />
    </div>
  )
}
