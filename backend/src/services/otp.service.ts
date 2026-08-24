import bcrypt from 'bcryptjs'
import { db } from '../db'

const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000 // 30s between sends
const MAX_PER_HOUR = 5

export interface OtpResult {
  ok: boolean
  error?: string
  // In console/dev mode we return the code so testing needs no real SMS.
  devCode?: string
  retryAfterSec?: number
}

function gen6(): string {
  // 6-digit, never starts with 0 so it's always 6 chars.
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Provider-agnostic delivery. console = dev (no SMS). http = any SMS/WA gateway.
async function deliver(phone: string, code: string): Promise<void> {
  const provider = (process.env.OTP_PROVIDER || 'console').toLowerCase()
  if (provider === 'http' && process.env.OTP_HTTP_URL) {
    const url = process.env.OTP_HTTP_URL.replace('{phone}', encodeURIComponent(phone)).replace('{code}', code)
    const method = (process.env.OTP_HTTP_METHOD || 'POST').toUpperCase()
    let headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try { headers = { ...headers, ...JSON.parse(process.env.OTP_HTTP_HEADERS || '{}') } } catch { /* ignore */ }
    const bodyTpl = process.env.OTP_HTTP_BODY || '{"to":"{phone}","message":"Your SVT OTP is {code}"}'
    const body = bodyTpl.replace('{phone}', phone).replace('{code}', code)
    await fetch(url, { method, headers, body: method === 'GET' ? undefined : body })
    return
  }
  // console
  console.log(`\n📲 [OTP] ${phone} → ${code}  (dev mode; no SMS sent)\n`)
}

export async function requestOtp(rawPhone: string): Promise<OtpResult> {
  const phone = rawPhone.replace(/\s+/g, '')
  if (!/^\+?\d{10,15}$/.test(phone)) return { ok: false, error: 'Enter a valid phone number.' }

  const now = Date.now()
  const recent = await db.otp.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } })
  if (recent && now - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - recent.createdAt.getTime())) / 1000)
    return { ok: false, error: `Please wait ${wait}s before requesting a new code.`, retryAfterSec: wait }
  }
  const hourAgo = new Date(now - 60 * 60 * 1000)
  const lastHour = await db.otp.count({ where: { phone, createdAt: { gte: hourAgo } } })
  if (lastHour >= MAX_PER_HOUR) return { ok: false, error: 'Too many OTP requests. Try again later.' }

  const code = gen6()
  await db.otp.create({
    data: { phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(now + OTP_TTL_MS) }
  })
  await deliver(phone, code)

  const devMode = (process.env.OTP_PROVIDER || 'console').toLowerCase() === 'console'
  return { ok: true, ...(devMode ? { devCode: code } : {}) }
}

export async function verifyOtp(rawPhone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const phone = rawPhone.replace(/\s+/g, '')
  const rec = await db.otp.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } })
  if (!rec) return { ok: false, error: 'Request an OTP first.' }
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false, error: 'OTP expired. Request a new one.' }
  if (rec.attempts >= 5) return { ok: false, error: 'Too many wrong attempts. Request a new OTP.' }

  const good = await bcrypt.compare(code.trim(), rec.codeHash)
  if (!good) {
    await db.otp.update({ where: { id: rec.id }, data: { attempts: rec.attempts + 1 } })
    return { ok: false, error: 'Incorrect OTP.' }
  }
  // Consume all OTPs for this phone on success.
  await db.otp.deleteMany({ where: { phone } })
  return { ok: true }
}
