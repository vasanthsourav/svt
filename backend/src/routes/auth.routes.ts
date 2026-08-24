import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { OAuth2Client } from 'google-auth-library'
import { db } from '../db'
import { signToken, requireAuth } from '../auth'
import { requestOtp, verifyOtp } from '../services/otp.service'

export const authRouter = Router()

const publicUser = (u: any) => ({ id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone })

// Google Sign-In (optional). Set GOOGLE_CLIENT_ID to enable the "Continue with Google"
// button on the storefront; leave it unset and the button simply doesn't appear.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

// Public: tells the storefront which sign-in options are enabled (client id is public).
authRouter.get('/config', (_req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null })
})

// Sign in / sign up with a Google ID token obtained on the storefront.
authRouter.post('/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google sign-in is not enabled.' })
  const credential = String(req.body?.credential || '')
  if (!credential) return res.status(400).json({ error: 'Missing Google credential.' })
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email || payload.email_verified === false) {
      return res.status(401).json({ error: 'Your Google email could not be verified.' })
    }
    const email = payload.email.toLowerCase()
    const name = payload.name || payload.given_name || null
    // Match an existing account by email, or create a new customer (no password needed).
    let user = await db.user.findUnique({ where: { email } })
    if (!user) user = await db.user.create({ data: { email, name, role: 'CUSTOMER' } })
    else if (!user.name && name) user = await db.user.update({ where: { id: user.id }, data: { name } })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch {
    res.status(401).json({ error: 'Google sign-in failed. Please try again.' })
  }
})

// ── Email + password ─────────────────────────────────────────────────────────
authRouter.post('/register', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(8).optional(),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const { name, email, phone, password } = parsed.data

  const exists = await db.user.findUnique({ where: { email } })
  if (exists) return res.status(409).json({ error: 'An account with this email already exists. Please log in.' })

  const user = await db.user.create({
    data: { name, email, phone: phone || null, passwordHash: await bcrypt.hash(password, 10), role: 'CUSTOMER' }
  })
  res.json({ token: signToken(user), user: publicUser(user) })
})

authRouter.post('/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter your email and password.' })
  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' })
  }
  res.json({ token: signToken(user), user: publicUser(user) })
})

// ── Phone OTP (passwordless) ─────────────────────────────────────────────────
authRouter.post('/otp/request', async (req, res) => {
  const phone = String(req.body?.phone || '')
  const result = await requestOtp(phone)
  if (!result.ok) return res.status(429).json({ error: result.error })
  res.json({ ok: true, devCode: result.devCode })
})

authRouter.post('/otp/verify', async (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\s+/g, '')
  const code = String(req.body?.code || '')
  const name = req.body?.name ? String(req.body.name) : undefined

  const result = await verifyOtp(phone, code)
  if (!result.ok) return res.status(400).json({ error: result.error })

  // Find or create the customer by phone.
  let user = await db.user.findUnique({ where: { phone } })
  if (!user) {
    user = await db.user.create({ data: { phone, name: name || null, role: 'CUSTOMER' } })
  } else if (name && !user.name) {
    user = await db.user.update({ where: { id: user.id }, data: { name } })
  }
  res.json({ token: signToken(user), user: publicUser(user) })
})

// ── Current user ─────────────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: (req as any).user })
})

authRouter.patch('/me', requireAuth, async (req, res) => {
  const me = (req as any).user
  const data: any = {}
  if (typeof req.body?.name === 'string') data.name = req.body.name
  if (typeof req.body?.phone === 'string') data.phone = req.body.phone
  const user = await db.user.update({ where: { id: me.id }, data })
  res.json({ user: publicUser(user) })
})
