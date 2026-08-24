import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../db'
import { signToken, requireAuth } from '../auth'
import { requestOtp, verifyOtp } from '../services/otp.service'

export const authRouter = Router()

const publicUser = (u: any) => ({ id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone })

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
