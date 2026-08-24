import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { attachUser } from './auth'
import { authRouter } from './routes/auth.routes'
import { productsRouter } from './routes/products.routes'
import { ordersRouter } from './routes/orders.routes'
import { adminRouter } from './routes/admin.routes'
import { affiliateRouter } from './routes/affiliate.routes'
import { tryonRouter } from './routes/tryon.routes'
import { recordReferralClick } from './services/affiliate.service'
import { razorpayConfigured } from './services/razorpay.service'
import { startDbBackups } from './services/backup.service'

const app = express()
const PORT = Number(process.env.PORT || 4100)

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5180')
  .split(',').map((s) => s.trim()).filter(Boolean)

app.use(cors({ origin: origins.length ? origins : true }))
app.use(express.json({ limit: '5mb' })) // headroom for base64 try-on face uploads
app.use(attachUser)

// Serve uploaded product images & LR copies.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  payments: razorpayConfigured ? 'razorpay-live' : 'mock',
  otp: (process.env.OTP_PROVIDER || 'console')
}))

// Public: count a click on an affiliate link (fired by the storefront on ?ref= capture).
// Mounted before the auth-gated affiliate router so anonymous visitors can reach it.
app.post('/api/affiliate/click', async (req, res) => {
  const code = String(req.body?.code || '').trim()
  if (code) { try { await recordReferralClick(code) } catch { /* non-fatal */ } }
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/products', productsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/admin', adminRouter)
app.use('/api/affiliate', affiliateRouter)
app.use('/api/tryon', tryonRouter)

// Central error handler (incl. multer file-size errors).
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err?.message || err)
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 8 MB).' })
  res.status(500).json({ error: err?.message || 'Something went wrong.' })
})

// ── Serve the built storefront (production single-server hosting) ─────────────
// Point CLIENT_DIR at the built SPA (defaults to ../storefront/dist). When present,
// this same server serves the site + the API on one origin — no CORS, no 2nd host.
const clientDir = process.env.CLIENT_DIR || path.join(process.cwd(), '..', 'storefront', 'dist')
if (fs.existsSync(path.join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir))
  // SPA fallback: any non-API/uploads route returns index.html so client routing works.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(clientDir, 'index.html'))
  })
  console.log(`   Serving storefront from ${clientDir}`)
}

// Periodic on-disk backups of the SQLite database (safe, keeps recent copies).
startDbBackups()

app.listen(PORT, () => {
  console.log(`\n🧵 SVT-Shop running on http://localhost:${PORT}`)
  console.log(`   Payments: ${razorpayConfigured ? 'Razorpay (live keys)' : 'MOCK mode (no keys set)'}`)
  console.log(`   OTP:      ${process.env.OTP_PROVIDER || 'console'} mode`)
  console.log(`   CORS:     ${origins.join(', ')}\n`)
})
