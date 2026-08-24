import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Tab = 'otp' | 'email'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from || '/'
  const [tab, setTab] = useState<Tab>('otp')

  const finish = (token: string, user: any) => { login(token, user); toast.success('Welcome!'); navigate(from, { replace: true }) }

  return (
    <div className="container-px py-14 max-w-md mx-auto">
      <div className="text-center mb-8">
        <span className="inline-grid place-items-center h-14 w-14 rounded-full bg-maroon text-gold font-serif text-2xl font-bold mb-3">S</span>
        <h1 className="font-serif text-4xl md:text-5xl uppercase tracking-tight text-maroon">Welcome</h1>
        <p className="text-stone-500">Login or create your account to shop</p>
      </div>

      <div className="card p-6">
        <div className="flex rounded-full bg-cream-dark p-1 mb-6">
          <button onClick={() => setTab('otp')} className={`flex-1 py-2 rounded-full text-sm font-semibold ${tab === 'otp' ? 'bg-maroon text-cream' : 'text-stone-600'}`}>Phone OTP</button>
          <button onClick={() => setTab('email')} className={`flex-1 py-2 rounded-full text-sm font-semibold ${tab === 'email' ? 'bg-maroon text-cream' : 'text-stone-600'}`}>Email</button>
        </div>

        {tab === 'otp' ? <OtpLogin onDone={finish} /> : <EmailLogin onDone={finish} />}
      </div>

      <p className="text-center text-xs text-stone-400 mt-6">
        Shop staff? <Link to="/admin/login" className="text-maroon font-semibold">Admin login →</Link>
      </p>
    </div>
  )
}

function OtpLogin({ onDone }: { onDone: (t: string, u: any) => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!/^\+?\d{10,15}$/.test(phone.replace(/\s+/g, ''))) return toast.error('Enter a valid phone number')
    setBusy(true)
    try {
      const { devCode } = await api.post<{ devCode?: string }>('/auth/otp/request', { phone })
      setSent(true)
      if (devCode) { setCode(devCode); toast.success(`Test OTP: ${devCode}`) }
      else toast.success('OTP sent to your phone')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const verify = async () => {
    setBusy(true)
    try {
      const { token, user } = await api.post<{ token: string; user: any }>('/auth/otp/verify', { phone, code, name })
      onDone(token, user)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Phone Number</label>
        <input className="input" placeholder="98765 43210" value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {!sent ? (
        <button disabled={busy} onClick={send} className="btn-primary w-full py-3">{busy ? 'Sending…' : 'Send OTP'}</button>
      ) : (
        <>
          <div>
            <label className="label">Enter OTP</label>
            <input className="input tracking-[0.4em] text-center text-lg" placeholder="••••••" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="label">Your Name (new customers)</label>
            <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button disabled={busy} onClick={verify} className="btn-primary w-full py-3">{busy ? 'Verifying…' : 'Verify & Continue'}</button>
          <button onClick={() => { setSent(false); setCode('') }} className="btn-ghost w-full text-sm">Change number</button>
        </>
      )}
    </div>
  )
}

function EmailLogin({ onDone }: { onDone: (t: string, u: any) => void }) {
  const [register, setRegister] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setBusy(true)
    try {
      const path = register ? '/auth/register' : '/auth/login'
      const body = register ? form : { email: form.email, password: form.password }
      const { token, user } = await api.post<{ token: string; user: any }>(path, body)
      onDone(token, user)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {register && <div><label className="label">Full Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>}
      <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
      {register && <div><label className="label">Phone (optional)</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>}
      <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} /></div>
      <button disabled={busy} onClick={submit} className="btn-primary w-full py-3">{busy ? 'Please wait…' : register ? 'Create Account' : 'Login'}</button>
      <p className="text-center text-sm text-stone-500">
        {register ? 'Already have an account?' : 'New to SVT?'}{' '}
        <button onClick={() => setRegister((r) => !r)} className="text-maroon font-semibold">{register ? 'Login' : 'Create account'}</button>
      </p>
    </div>
  )
}
