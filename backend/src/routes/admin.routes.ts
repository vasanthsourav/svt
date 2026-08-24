import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { db } from '../db'
import { requireAdmin } from '../auth'
import { serializeProduct, serializeOrder } from '../serialize'
import { getCommissionPercent, setCommissionPercent, affiliateSummary } from '../services/affiliate.service'
import { getPlatformFeePercent, setPlatformFeePercent, platformSummary, settlePlatformFees } from '../services/platform.service'
import { sendPayout } from '../services/payout.service'
import { saveUpload } from '../services/storage.service'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

const trackUrl = () => process.env.INDIA_POST_TRACK_URL || ''

// Keep the file in memory so the storage service can send it to Cloudinary (or, in dev,
// write it to disk). Nothing touches the local filesystem unless we're in local mode.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 } // 8 MB
})

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
async function uniqueSlug(base: string, ignoreId?: number): Promise<string> {
  let slug = base || `item-${Date.now()}`
  let n = 1
  while (true) {
    const existing = await db.product.findUnique({ where: { slug } })
    if (!existing || existing.id === ignoreId) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

function pushHistory(historyJson: string, status: string, note?: string): string {
  let h: any[] = []
  try { h = JSON.parse(historyJson || '[]') } catch { h = [] }
  h.push({ status, at: new Date().toISOString(), note: note || null })
  return JSON.stringify(h)
}

// ── Dashboard ────────────────────────────────────────────────────────────────
adminRouter.get('/stats', async (_req, res) => {
  const [products, lowStock, customers, orders, paidAgg, pending] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    db.product.count({ where: { isActive: true, stock: { lte: 3 } } }),
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.order.count(),
    db.order.aggregate({ _sum: { totalPaise: true }, where: { status: { in: ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'] } } }),
    db.order.count({ where: { status: { in: ['PAID', 'PACKED'] } } })
  ])
  res.json({
    stats: {
      products, lowStock, customers, orders,
      revenue: (paidAgg._sum.totalPaise || 0) / 100,
      toFulfil: pending
    }
  })
})

// ── Products CRUD ────────────────────────────────────────────────────────────
adminRouter.get('/products', async (_req, res) => {
  const products = await db.product.findMany({ orderBy: { createdAt: 'desc' }, include: { sizes: true } })
  res.json({ products: products.map(serializeProduct) })
})

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  fabric: z.string().optional(),
  price: z.number().min(0),
  mrp: z.number().min(0).optional().nullable(),
  stock: z.number().int().min(0),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  // Optional per-size stock. Empty/absent ⇒ a one-size product using `stock`.
  sizes: z.array(z.object({ label: z.string().min(1), stock: z.coerce.number().int().min(0) })).optional()
})

// Replace a product's sizes with the given list (dedupes labels, keeps order).
async function syncSizes(productId: number, sizes?: { label: string; stock: number }[]) {
  if (sizes === undefined) return
  await db.productSize.deleteMany({ where: { productId } })
  const seen = new Set<string>()
  let order = 0
  for (const s of sizes) {
    const label = s.label.trim().toUpperCase()
    if (!label || seen.has(label)) continue
    seen.add(label)
    await db.productSize.create({ data: { productId, label, stock: Math.max(0, Math.round(s.stock)), sortOrder: order++ } })
  }
}

adminRouter.post('/products', async (req, res) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const d = parsed.data
  const slug = await uniqueSlug(slugify(d.name))
  const product = await db.product.create({
    data: {
      name: d.name, slug, description: d.description || null, category: d.category,
      fabric: d.fabric || null, pricePaise: Math.round(d.price * 100),
      mrpPaise: d.mrp ? Math.round(d.mrp * 100) : null, stock: d.stock,
      images: JSON.stringify(d.images || []), isActive: d.isActive ?? true, isFeatured: d.isFeatured ?? false
    }
  })
  await syncSizes(product.id, d.sizes)
  const full = await db.product.findUnique({ where: { id: product.id }, include: { sizes: true } })
  res.json({ product: serializeProduct(full) })
})

adminRouter.put('/products/:id', async (req, res) => {
  const id = Number(req.params.id)
  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const d = parsed.data
  const data: any = {}
  if (d.name !== undefined) { data.name = d.name; data.slug = await uniqueSlug(slugify(d.name), id) }
  if (d.description !== undefined) data.description = d.description || null
  if (d.category !== undefined) data.category = d.category
  if (d.fabric !== undefined) data.fabric = d.fabric || null
  if (d.price !== undefined) data.pricePaise = Math.round(d.price * 100)
  if (d.mrp !== undefined) data.mrpPaise = d.mrp ? Math.round(d.mrp * 100) : null
  if (d.stock !== undefined) data.stock = d.stock
  if (d.images !== undefined) data.images = JSON.stringify(d.images)
  if (d.isActive !== undefined) data.isActive = d.isActive
  if (d.isFeatured !== undefined) data.isFeatured = d.isFeatured
  await db.product.update({ where: { id }, data })
  await syncSizes(id, d.sizes)
  const product = await db.product.findUnique({ where: { id }, include: { sizes: true } })
  res.json({ product: serializeProduct(product) })
})

// Quick stock adjustment (the "add stock" shortcut).
adminRouter.patch('/products/:id/stock', async (req, res) => {
  const id = Number(req.params.id)
  const delta = Number(req.body?.delta)
  const set = req.body?.set
  if (set !== undefined) {
    const product = await db.product.update({ where: { id }, data: { stock: Math.max(0, Math.round(Number(set))) } })
    return res.json({ product: serializeProduct(product) })
  }
  if (!Number.isFinite(delta)) return res.status(400).json({ error: 'Provide "delta" or "set".' })
  const current = await db.product.findUnique({ where: { id } })
  if (!current) return res.status(404).json({ error: 'Product not found.' })
  const product = await db.product.update({ where: { id }, data: { stock: Math.max(0, current.stock + delta) } })
  res.json({ product: serializeProduct(product) })
})

adminRouter.delete('/products/:id', async (req, res) => {
  await db.product.update({ where: { id: Number(req.params.id) }, data: { isActive: false } })
  res.json({ ok: true })
})

// Image upload — stores to Cloudinary (or local disk in dev) and returns the URL
// the admin form saves into the product's images[].
adminRouter.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
  try {
    const url = await saveUpload(req.file.buffer, req.file.originalname, 'products')
    res.json({ url })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Image upload failed.' })
  }
})

// ── Orders & fulfilment ──────────────────────────────────────────────────────
adminRouter.get('/orders', async (req, res) => {
  const status = (req.query.status as string) || undefined
  const orders = await db.order.findMany({
    where: status && status !== 'ALL' ? { status } : {},
    orderBy: { createdAt: 'desc' }, include: { items: true, user: true }
  })
  res.json({ orders: orders.map((o) => serializeOrder(o, trackUrl())) })
})

adminRouter.get('/orders/:id', async (req, res) => {
  const order = await db.order.findUnique({
    where: { id: Number(req.params.id) }, include: { items: true, user: true }
  })
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order: serializeOrder(order, trackUrl()) })
})

// Mark packed.
adminRouter.post('/orders/:id/pack', async (req, res) => {
  const id = Number(req.params.id)
  const o = await db.order.findUnique({ where: { id } })
  if (!o) return res.status(404).json({ error: 'Order not found.' })
  const order = await db.order.update({
    where: { id },
    data: { status: 'PACKED', history: pushHistory(o.history, 'PACKED', 'Order packed') },
    include: { items: true, user: true }
  })
  res.json({ order: serializeOrder(order, trackUrl()) })
})

// Ship — set carrier + consignment (tracking) number, optionally upload LR copy.
adminRouter.post('/orders/:id/ship', upload.single('lrCopy'), async (req, res) => {
  const id = Number(req.params.id)
  const o = await db.order.findUnique({ where: { id } })
  if (!o) return res.status(404).json({ error: 'Order not found.' })
  const carrier = String(req.body?.carrier || 'India Post')
  const trackingNumber = String(req.body?.trackingNumber || '').trim()
  if (!trackingNumber) return res.status(400).json({ error: 'Enter the consignment / tracking number.' })
  const lrCopyUrl = req.file ? await saveUpload(req.file.buffer, req.file.originalname, 'shipping') : o.lrCopyUrl
  const order = await db.order.update({
    where: { id },
    data: {
      status: 'SHIPPED', carrier, trackingNumber, lrCopyUrl, shippedAt: new Date(),
      history: pushHistory(o.history, 'SHIPPED', `Shipped via ${carrier} — ${trackingNumber}`)
    },
    include: { items: true, user: true }
  })
  res.json({ order: serializeOrder(order, trackUrl()) })
})

adminRouter.post('/orders/:id/deliver', async (req, res) => {
  const id = Number(req.params.id)
  const o = await db.order.findUnique({ where: { id } })
  if (!o) return res.status(404).json({ error: 'Order not found.' })
  const order = await db.order.update({
    where: { id },
    data: {
      status: 'DELIVERED', deliveredAt: new Date(),
      // Affiliate commission + platform fee become payable once the order is delivered.
      ...(o.commissionStatus === 'PENDING' ? { commissionStatus: 'PAYABLE' } : {}),
      ...(o.platformFeeStatus === 'PENDING' ? { platformFeeStatus: 'PAYABLE' } : {}),
      history: pushHistory(o.history, 'DELIVERED', 'Order delivered')
    },
    include: { items: true, user: true }
  })
  res.json({ order: serializeOrder(order, trackUrl()) })
})

adminRouter.post('/orders/:id/cancel', async (req, res) => {
  const id = Number(req.params.id)
  const o = await db.order.findUnique({ where: { id }, include: { items: true } })
  if (!o) return res.status(404).json({ error: 'Order not found.' })
  // Restock if it had been paid/decremented.
  if (['PAID', 'PACKED', 'SHIPPED'].includes(o.status)) {
    for (const it of o.items) {
      if (it.size) {
        await db.productSize.updateMany({ where: { productId: it.productId, label: it.size }, data: { stock: { increment: it.quantity } } })
      } else {
        await db.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } })
      }
    }
  }
  const order = await db.order.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      // Void any unpaid affiliate commission + platform fee on cancellation.
      ...(o.commissionStatus && o.commissionStatus !== 'PAID' ? { commissionStatus: 'VOID' } : {}),
      ...(o.platformFeeStatus && o.platformFeeStatus !== 'PAID' ? { platformFeeStatus: 'VOID' } : {}),
      history: pushHistory(o.history, 'CANCELLED', String(req.body?.reason || 'Cancelled by admin'))
    },
    include: { items: true, user: true }
  })
  res.json({ order: serializeOrder(order, trackUrl()) })
})

// ── Affiliate program (admin) ────────────────────────────────────────────────
adminRouter.get('/affiliate-settings', async (_req, res) => {
  res.json({ commissionPercent: await getCommissionPercent() })
})
adminRouter.put('/affiliate-settings', async (req, res) => {
  const pct = Number(req.body?.commissionPercent)
  if (!Number.isFinite(pct) || pct < 0) return res.status(400).json({ error: 'Enter a valid commission percent.' })
  res.json({ commissionPercent: await setCommissionPercent(pct) })
})

// All affiliates (self-signed-up influencers), including those pending approval.
adminRouter.get('/affiliates', async (_req, res) => {
  const defaultPct = await getCommissionPercent()
  const users = await db.user.findMany({ where: { affiliateStatus: { not: null } }, orderBy: { createdAt: 'desc' } })
  const rows = []
  for (const u of users) {
    const s = await affiliateSummary(u.id)
    rows.push({
      id: u.id, name: u.name, email: u.email, phone: u.phone, code: u.referralCode,
      status: u.affiliateStatus,
      commissionPercent: u.commissionPercent,               // null = uses global default
      effectivePercent: u.commissionPercent ?? defaultPct,  // what actually applies
      clicks: u.referralClicks,
      referredOrders: s.referredOrders, pending: s.pendingPaise / 100, payable: s.payablePaise / 100, paid: s.paidPaise / 100,
      payoutMethod: u.payoutMethod, payoutDetails: u.payoutDetails
    })
  }
  // Pending approvals surface first, then the biggest earners.
  rows.sort((a, b) => {
    if ((a.status === 'PENDING') !== (b.status === 'PENDING')) return a.status === 'PENDING' ? -1 : 1
    return (b.payable + b.pending) - (a.payable + a.pending)
  })
  res.json({ affiliates: rows, defaultPercent: defaultPct })
})

// Approve/reject an affiliate and/or set their personal commission rate.
adminRouter.patch('/affiliates/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad affiliate id.' })
  const data: { affiliateStatus?: string; commissionPercent?: number | null } = {}

  if (req.body?.status !== undefined) {
    const st = String(req.body.status).toUpperCase()
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(st)) return res.status(400).json({ error: 'Invalid status.' })
    data.affiliateStatus = st
  }
  if (req.body?.commissionPercent !== undefined) {
    const v = req.body.commissionPercent
    if (v === null || v === '') {
      data.commissionPercent = null // fall back to the global default
    } else {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0 || n > 50) return res.status(400).json({ error: 'Commission must be 0–50%.' })
      data.commissionPercent = Math.round(n)
    }
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update.' })

  const u = await db.user.update({ where: { id }, data })
  res.json({ ok: true, id: u.id, status: u.affiliateStatus, commissionPercent: u.commissionPercent })
})

// ── Platform fee (operator's transparent cut of every sale) ──────────────────
adminRouter.get('/platform', async (_req, res) => {
  const [percent, summary] = await Promise.all([getPlatformFeePercent(), platformSummary()])
  res.json({
    percent,
    totalOrders: summary.totalOrders,
    pending: summary.pendingPaise / 100,   // undelivered — not payable yet
    payable: summary.payablePaise / 100,   // delivered — owed to the operator now
    paid: summary.paidPaise / 100,         // already settled
    thisMonth: summary.thisMonthPaise / 100,
    orders: summary.orders.map((o) => ({
      orderNumber: o.orderNumber, status: o.status, feeStatus: o.platformFeeStatus,
      fee: o.platformFeePaise / 100, orderTotal: o.totalPaise / 100, createdAt: o.createdAt
    }))
  })
})
adminRouter.put('/platform-settings', async (req, res) => {
  const pct = Number(req.body?.percent)
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) return res.status(400).json({ error: 'Enter a rate between 0 and 50%.' })
  res.json({ percent: await setPlatformFeePercent(pct) })
})
adminRouter.post('/platform/settle', async (_req, res) => {
  const settled = await settlePlatformFees()
  res.json({ ok: true, settled })
})

// Payout requests.
adminRouter.get('/payouts', async (req, res) => {
  const status = (req.query.status as string) || undefined
  const payouts = await db.payout.findMany({
    where: status && status !== 'ALL' ? { status } : {},
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { user: true }
  })
  res.json({
    payouts: payouts.map((p) => ({
      id: p.id, amount: p.amountPaise / 100, method: p.method, details: p.details, status: p.status,
      reference: p.reference, createdAt: p.createdAt, paidAt: p.paidAt,
      user: { id: p.user.id, name: p.user.name, email: p.user.email, phone: p.user.phone, code: p.user.referralCode }
    }))
  })
})

// Pay a payout: sends money (RazorpayX or mock), then marks the user's payable
// commissions PAID and closes the request.
adminRouter.post('/payouts/:id/pay', async (req, res) => {
  const id = Number(req.params.id)
  const payout = await db.payout.findUnique({ where: { id }, include: { user: true } })
  if (!payout) return res.status(404).json({ error: 'Payout not found.' })
  if (payout.status === 'PAID') return res.status(400).json({ error: 'Already paid.' })

  // Pay out exactly what is payable now (accurate even if it changed since request).
  const summary = await affiliateSummary(payout.userId)
  const amountPaise = summary.payablePaise
  if (amountPaise <= 0) return res.status(400).json({ error: 'Nothing payable for this affiliate.' })

  const result = await sendPayout({
    amountPaise, method: payout.method, details: payout.details,
    name: payout.user.name || payout.user.email || `User ${payout.userId}`, notes: `Payout #${id}`
  })
  if (!result.ok) return res.status(502).json({ error: result.error || 'Payout failed.' })

  // Mark all currently-payable referred orders as PAID.
  await db.order.updateMany({
    where: { referredByUserId: payout.userId, commissionStatus: 'PAYABLE' },
    data: { commissionStatus: 'PAID' }
  })
  const updated = await db.payout.update({
    where: { id }, data: { status: 'PAID', amountPaise, reference: result.reference, paidAt: new Date() }
  })
  res.json({ ok: true, mock: result.mock, payout: { id: updated.id, amount: updated.amountPaise / 100, status: updated.status, reference: updated.reference } })
})

adminRouter.post('/payouts/:id/reject', async (req, res) => {
  const id = Number(req.params.id)
  const updated = await db.payout.update({ where: { id }, data: { status: 'REJECTED' } })
  res.json({ ok: true, payout: { id: updated.id, status: updated.status } })
})
