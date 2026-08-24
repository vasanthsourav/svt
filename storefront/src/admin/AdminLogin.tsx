import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function AdminLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { token, user } = await api.post<{ token: string; user: any }>('/auth/login', { email, password })
      if (user.role !== 'ADMIN') { toast.error('This is not an admin account.'); return }
      login(token, user); toast.success('Welcome, admin'); navigate('/admin')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-maroon-dark p-4">
      <form onSubmit={submit} className="card p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center h-14 w-14 rounded-full bg-maroon text-gold font-serif text-2xl font-bold mb-3">S</span>
          <h1 className="text-2xl text-maroon">Admin Portal</h1>
          <p className="text-sm text-stone-500">Sri Venkateshwara Textiles</p>
        </div>
        <div className="space-y-4">
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button disabled={busy} className="btn-primary w-full py-3">{busy ? 'Signing in…' : 'Sign In'}</button>
        </div>
      </form>
    </div>
  )
}
