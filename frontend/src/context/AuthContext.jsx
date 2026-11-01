import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { TOKEN_KEY, USER_KEY } from '../api/client'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(readStoredUser)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))

  const persist = useCallback((nextToken, nextUser) => {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    } else {
      localStorage.removeItem(USER_KEY)
    }
    setToken(nextToken)
    setUser(nextUser)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return null
    const { data } = await api.get('/auth/me')
    setUser((current) => {
      const merged = { ...(current || {}), ...data }
      localStorage.setItem(USER_KEY, JSON.stringify(merged))
      return merged
    })
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    async function validate() {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (!cancelled) {
          persist(localStorage.getItem(TOKEN_KEY), { ...(readStoredUser() || {}), ...data })
        }
      } catch {
        if (!cancelled) persist(null, null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    validate()
    return () => {
      cancelled = true
    }
  }, [persist])

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password })
      persist(data.access_token, data.user)
      return data.user
    },
    [persist],
  )

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload)
      persist(data.access_token, data.user)
      return data.user
    },
    [persist],
  )

  const logout = useCallback(() => {
    persist(null, null)
  }, [persist])

  const updateUser = useCallback(
    (patch) => {
      setUser((current) => {
        const merged = { ...(current || {}), ...patch }
        localStorage.setItem(USER_KEY, JSON.stringify(merged))
        return merged
      })
    },
    [],
  )

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
      updateUser,
    }),
    [token, user, loading, login, register, logout, refreshUser, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
