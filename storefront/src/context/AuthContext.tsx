import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, getToken, setToken } from '../lib/api'

export interface User {
  id: number; role: string; name?: string | null; email?: string | null; phone?: string | null
}

interface AuthCtx {
  user: User | null
  loading: boolean
  isAdmin: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!getToken()) { setUser(null); setLoading(false); return }
    try {
      const { user } = await api.get<{ user: User }>('/auth/me')
      setUser(user)
    } catch {
      setToken(null); setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const login = (token: string, u: User) => { setToken(token); setUser(u) }
  const logout = () => { setToken(null); setUser(null) }

  return (
    <Ctx.Provider value={{ user, loading, isAdmin: user?.role === 'ADMIN', login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  )
}
