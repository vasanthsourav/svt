import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db'
import { requireAuth } from '../auth'
import { serializeOrder } from '../serialize'
import { createRazorpayOrder, verifyPaymentSignature, razorpayConfigured, razorpayKeyId } from '../services/razorpay.service'
import { createCashfreeOrder, isCashfreeOrderPaid, cashfreeConfigured, cashfreeEnv } from '../services/cashfree.service'
import { findReferrerByCode, effectiveCommissionPercent } from '../services/affiliate.service'
import { getPlatformFeePercent } from '../services/platform.service'
import { notifyOrderConfirmed } from '../services/notify.service'

export const ordersRouter = Router()

const trackUrl = () => process.env.INDIA_POST_TRACK_URL || ''

// Delivery charge, mirroring what the storefront advertises: free above ₹1499,
// otherwise a flat ₹79. Kept in paise, like every other amount here.
const FREE_SHIPPING_MIN_PAISE = 149900
const SHIPPING_FEE_PAISE = 7900

// Which gateway handles online payments. The SERVER decides — the browser only
// says "online" or "COD" — so a client can't pick a gateway we haven't configured.
// PAYMENT_GATEWAY forces one; otherwise whichever has credentials wins, Cashfree
// first. With neither configured we're in mock mode and the label is cosmetic.
function chooseGateway(): 'CASHFREE' | 'RAZORPAY' {
  const forced = (process.env.PAYMENT_GATEWAY || '').toUpperCase()
  if (forced === 'CASHFREE' || forced === 'RAZORPAY') return forced
  if (cashfreeConfigured) return 'CASHFREE'
  if (razorpayConfigured) return 'RAZORPAY'
  return 'CASHFREE'
}

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
  // The browser only chooses online-vs-COD; the server picks the actual gateway.
  // RAZORPAY/CASHFREE are still accepted so older clients keep working.
  paymentMode: z.enum(['ONLINE', 'RAZORPAY', 'CASHFREE', 'COD']).default('ONLINE'),
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

  // Delivery charge. The storefront has always SHOWN this in the total, but it
  // was never added to the amount sent to the gateway — the customer was billed
  // for the items only. Add it here, after the commission and platform fee above
  // so neither is ever accrued on freight.
  const itemsSubtotalPaise = total
  const shippingPaise = itemsSubtotalPaise >= FREE_SHIPPING_MIN_PAISE ? 0 : SHIPPING_FEE_PAISE
  const grandTotalPaise = itemsSubtotalPaise + shippingPaise

  // Record the gateway that will actually handle this order, not what was asked for.
  const resolvedMode = paymentMode === 'COD' ? 'COD' : chooseGateway()

  const orderNumber = `SVTO-${Date.now().toString(36).toUpperCase()}`
  const order = await db.order.create({
    data: {
      orderNumber, userId: me.id, status: 'PENDING', totalPaise: grandTotalPaise, paymentMode: resolvedMode,
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

  // COD: confirm immediately. Online: create a gateway order to pay against.
  if (resolvedMode === 'COD') {
    const confirmed = await confirmAndFulfilStock(order.id, 'COD')
    return res.json({ order: serializeOrder(confirmed, trackUrl()), payment: { mode: 'COD' } })
  }

  if (resolvedMode === 'CASHFREE') {
    try {
      const cf = await createCashfreeOrder({
        orderNumber,
        amountPaise: grandTotalPaise,
        customerId: me.id,
        customerName: shipping.name,
        customerEmail: me.email || null,
        customerPhone: shipping.phone,
        returnUrl: process.env.CASHFREE_RETURN_URL || undefined
      })
      return res.json({
        order: serializeOrder(order, trackUrl()),
        payment: {
          mode: 'CASHFREE', mock: cf.mock,
          paymentSessionId: cf.paymentSessionId,
          // The browser SDK's mode must match the environment this session was
          // created in — a sandbox session is rejected by a production SDK.
          env: cf.env, amount: cf.amount, currency: cf.currency,
          configured: cashfreeConfigured
        }
      })
    } catch (e: any) {
      // The order stays PENDING with stock untouched, so the customer can retry.
      console.error(`[orders] Cashfree order failed for ${orderNumber}:`, e?.message || e)
      return res.status(502).json({ error: e?.message || 'Could not reach the payment gateway. Please try again.' })
    }
  }

  const rp = await createRazorpayOrder(grandTotalPaise, orderNumber)
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
  let didConfirm = false
  const result = await db.$transaction(async (tx) => {
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
    didConfirm = true
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
  // Only on the real PENDING→PAID transition (never on a repeat confirm), send the
  // customer bill + admin alert on WhatsApp. Fire-and-forget: never blocks the order.
  if (didConfirm && result) notifyOrderConfirmed(result).catch(() => {})
  return result
}

// Confirm a Razorpay payment from the browser checkout callback.
ordersRouter.post('/:id/confirm', requireAuth, async (req, res) => {
  const me = (req as any).user
  const id = Number(req.params.id)
  const order = await db.order.findUnique({ where: { id } })
  if (!order || order.userId !== me.id) return res.status(404).json({ error: 'Order not found.' })

  // Cashfree: nothing the browser sends is trusted. Ask Cashfree what happened
  // and only fulfil when it reports the order as PAID.
  if (order.paymentMode === 'CASHFREE') {
    const result = await isCashfreeOrderPaid(order.orderNumber)
    if (!result.paid) {
      return res.status(400).json({ error: `Payment not completed (status: ${result.status}).` })
    }
    const confirmed = await confirmAndFulfilStock(id, 'CASHFREE', result.paymentId)
    return res.json({ order: serializeOrder(confirmed, trackUrl()) })
  }

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
