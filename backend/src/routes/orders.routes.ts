import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db'
import { requireAuth } from '../auth'
import { serializeOrder } from '../serialize'
import { createRazorpayOrder, verifyPaymentSignature, razorpayConfigured, razorpayKeyId } from '../services/razorpay.service'
import { findReferrerByCode, effectiveCommissionPercent } from '../services/affiliate.service'
import { getPlatformFeePercent } from '../services/platform.service'

export const ordersRouter = Router()

const trackUrl = () => process.env.INDIA_POST_TRACK_URL || ''

function pushHistory(historyJson: string, status: string, note?: string): string {
  let h: any[] = []
  try { h = JSON.parse(historyJson || '[]') } catch { h = [] }
  h.push({ status, at: new Date().toISOString(), note: note || null })
  return JSON.stringify(h)
}

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int(),
    quantity: z.number().int().min(1),
    sizeId: z.number().int().optional()
  })).min(1),
  shipping: z.object({
    name: z.string().min(1), phone: z.string().min(8),
    line1: z.string().min(1), line2: z.string().optional(),
    city: z.string().min(1), state: z.string().min(1), pincode: z.string().min(4)
  }),
  paymentMode: z.enum(['RAZORPAY', 'COD']).default('RAZORPAY'),
  referralCode: z.string().optional()
})

// Create an order (status PENDING) and a matching Razorpay order to pay.
ordersRouter.post('/', requireAuth, async (req, res) => {
  const me = (req as any).user
  const parsed = checkoutSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
  const { items, shipping, paymentMode } = parsed.data

  // Load products (with sizes) & validate stock.
  const ids = items.map((i) => i.productId)
  const products = await db.product.findMany({ where: { id: { in: ids }, isActive: true }, include: { sizes: true } })
  const map = new Map(products.map((p) => [p.id, p]))
  let total = 0
  const lineItems: { productId: number; name: string; pricePaise: number; quantity: number; image: string | null; size: string | null }[] = []
  for (const it of items) {
    const p = map.get(it.productId)
    if (!p) return res.status(400).json({ error: 'A product in your cart is no longer available.' })
    let size: string | null = null
    if (p.sizes && p.sizes.length > 0) {
      const sz = it.sizeId ? p.sizes.find((s) => s.id === it.sizeId) : undefined
      if (!sz) return res.status(400).json({ error: `Please select a size for "${p.name}".` })
      if (sz.stock < it.quantity) return res.status(409).json({ error: `Only ${sz.stock} left of "${p.name}" (size ${sz.label}).` })
      size = sz.label
    } else if (p.stock < it.quantity) {
      return res.status(409).json({ error: `Only ${p.stock} left of "${p.name}".` })
    }
    let img: string | null = null
    try { img = (JSON.parse(p.images || '[]')[0]) || null } catch { img = null }
    total += p.pricePaise * it.quantity
    lineItems.push({ productId: p.id, name: p.name, pricePaise: p.pricePaise, quantity: it.quantity, image: img, size })
  }

  // Affiliate attribution — referrer earns a commission (no buyer discount).
  // Self-referral is ignored. Commission stays PENDING until the order is delivered.
  let referredByUserId: number | null = null
  let referredByCode: string | null = null
  let commissionPaise = 0
  let commissionStatus: string | null = null
  const refCode = parsed.data.referralCode?.trim()
  if (refCode) {
    const ref = await findReferrerByCode(refCode)
    if (ref && ref.id !== me.id) {
      // Always record the attribution (so a not-yet-approved affiliate's traffic is visible),
      // but only accrue a payable commission once the affiliate is APPROVED, at THEIR rate.
      referredByUserId = ref.id
      referredByCode = refCode.toUpperCase()
      if (ref.affiliateStatus === 'APPROVED') {
        const pct = await effectiveCommissionPercent(ref.commissionPercent)
        commissionPaise = Math.round((total * pct) / 100)
        commissionStatus = 'PENDING'
      }
    }
  }

  // Platform fee — the operator's cut on EVERY sale, held until the order is delivered.
  const platformPct = await getPlatformFeePercent()
  const platformFeePaise = Math.round((total * platformPct) / 100)
  const platformFeeStatus = platformFeePaise > 0 ? 'PENDING' : null

  const orderNumber = `SVTO-${Date.now().toString(36).toUpperCase()}`
  const order = await db.order.create({
    data: {
      orderNumber, userId: me.id, status: 'PENDING', totalPaise: total, paymentMode,
      shipName: shipping.name, shipPhone: shipping.phone, shipLine1: shipping.line1,
      shipLine2: shipping.line2 || null, shipCity: shipping.city, shipState: shipping.state,
      shipPincode: shipping.pincode,
      referredByUserId, referredByCode, commissionPaise, commissionStatus,
      platformFeePaise, platformFeeStatus,
      history: pushHistory('[]', 'PENDING', 'Order placed'),
      items: { create: lineItems }
    },
    include: { items: true, user: true }
  })

  // COD: confirm immediately. RAZORPAY: create a gateway order to pay.
  if (paymentMode === 'COD') {
    const confirmed = await confirmAndFulfilStock(order.id, 'COD')
    return res.json({ order: serializeOrder(confirmed, trackUrl()), payment: { mode: 'COD' } })
  }

  const rp = await createRazorpayOrder(total, orderNumber)
  await db.order.update({ where: { id: order.id }, data: { razorpayOrderId: rp.id } })
  res.json({
    order: serializeOrder(order, trackUrl()),
    payment: {
      mode: 'RAZORPAY', mock: rp.mock, keyId: razorpayKeyId || null,
      razorpayOrderId: rp.id, amount: rp.amount, currency: rp.currency,
      configured: razorpayConfigured
    }
  })
})

// Mark PAID, decrement stock (in a transaction).
async function confirmAndFulfilStock(orderId: number, mode: string, paymentId?: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new Error('Order not found')
    if (order.status !== 'PENDING') return tx.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } })
    for (const it of order.items) {
      if (it.size) {
        await tx.productSize.updateMany({ where: { productId: it.productId, label: it.size }, data: { stock: { decrement: it.quantity } } })
      } else {
        await tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity } } })
      }
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentMode: mode,
        paidAt: mode === 'COD' ? null : new Date(),
        razorpayPaymentId: paymentId || null,
        history: pushHistory(order.history, 'PAID', mode === 'COD' ? 'Cash on delivery confirmed' : 'Payment received')
      },
      include: { items: true, user: true }
    })
  })
}

// Confirm a Razorpay payment from the browser checkout callback.
ordersRouter.post('/:id/confirm', requireAuth, async (req, res) => {
  const me = (req as any).user
  const id = Number(req.params.id)
  const order = await db.order.findUnique({ where: { id } })
  if (!order || order.userId !== me.id) return res.status(404).json({ error: 'Order not found.' })

  const { razorpayPaymentId, razorpaySignature } = req.body || {}
  const ok = verifyPaymentSignature(order.razorpayOrderId || '', razorpayPaymentId || '', razorpaySignature || '')
  if (!ok) return res.status(400).json({ error: 'Payment verification failed.' })

  const confirmed = await confirmAndFulfilStock(id, 'RAZORPAY', razorpayPaymentId)
  res.json({ order: serializeOrder(confirmed, trackUrl()) })
})

// Customer's own orders.
ordersRouter.get('/', requireAuth, async (req, res) => {
  const me = (req as any).user
  const orders = await db.order.findMany({
    where: { userId: me.id }, orderBy: { createdAt: 'desc' }, include: { items: true }
  })
  res.json({ orders: orders.map((o) => serializeOrder(o, trackUrl())) })
})

ordersRouter.get('/:id', requireAuth, async (req, res) => {
  const me = (req as any).user
  const order = await db.order.findUnique({
    where: { id: Number(req.params.id) }, include: { items: true, user: true }
  })
  if (!order || order.userId !== me.id) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order: serializeOrder(order, trackUrl()) })
})
