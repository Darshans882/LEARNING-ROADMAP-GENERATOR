import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import { Button } from '../components/ui'

export default function NotFound() {
  const { isAuthenticated, user } = useAuth()
  const home = isAuthenticated ? (user?.role === 'admin' ? '/admin' : '/dashboard') : '/'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <Link to="/"><Logo size="lg" /></Link>
      <div className="mt-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-100 text-brand-600">
        <Compass className="h-10 w-10" />
      </div>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.25em] text-brand-600">404 — off the map</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        This page isn’t on your roadmap
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-500">
        The link may be old or mistyped. Head back to your workspace and pick up where you left off.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button as="a" onClick={() => window.history.back()} variant="secondary" icon={ArrowLeft}>
          Go back
        </Button>
        <Link to={home}>
          <Button icon={Home}>{isAuthenticated ? 'Back to workspace' : 'Back to home'}</Button>
        </Link>
      </div>
    </div>
  )
}
