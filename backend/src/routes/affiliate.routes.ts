import { Router } from 'express'
import { db } from '../db'
import { requireAuth } from '../auth'
import { affiliateSummary, effectiveCommissionPercent, applyAsAffiliate } from '../services/affiliate.service'

export const affiliateRouter = Router()
affiliateRouter.use(requireAuth)

// Apply to become an affiliate (self-signup). Generates a code and marks the account PENDING
// for admin approval. Commission only accrues once approved.
affiliateRouter.post('/apply', async (req, res) => {
  const me = (req as any).user
  const { code, status } = await applyAsAffiliate(me.id)
  res.json({ code, status })
})

// Affiliate dashboard: status, code, commission %, earnings summary, clicks, payout details + history.
affiliateRouter.get('/', async (req, res) => {
  const me = (req as any).user
  const user = await db.user.findUnique({ where: { id: me.id } })
  const status = user?.affiliateStatus || null
  // Not an affiliate yet — tell the client to show the "apply" call-to-action.
  if (!status) {
    return res.json({ status: null, code: null })
  }
  const [pct, summary, payouts] = await Promise.all([
    effectiveCommissionPercent(user?.commissionPercent ?? null),
    affiliateSummary(me.id),
    db.payout.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' } })
  ])
  res.json({
    status,
    code: user?.referralCode || null,
    commissionPercent: pct,
    clicks: user?.referralClicks || 0,
    payoutMethod: user?.payoutMethod || null,
    payoutDetails: user?.payoutDetails || null,
    summary: {
      referredOrders: summary.referredOrders,
      pending: summary.pendingPaise / 100,
      payable: summary.payablePaise / 100,
      paid: summary.paidPaise / 100,
      orders: summary.orders.map((o) => ({
        orderNumber: o.orderNumber, status: o.status, commissionStatus: o.commissionStatus,
        commission: o.commissionPaise / 100, orderTotal: o.totalPaise / 100, createdAt: o.createdAt
      }))
    },
    payouts: payouts.map((p) => ({
      id: p.id, amount: p.amountPaise / 100, method: p.method, status: p.status,
      reference: p.reference, createdAt: p.createdAt, paidAt: p.paidAt
    }))
  })
})

// Save how the affiliate wants to be paid.
affiliateRouter.patch('/payout-method', async (req, res) => {
  const me = (req as any).user
  const method = String(req.body?.method || '').toUpperCase()
  const details = String(req.body?.details || '').trim()
  if (!['UPI', 'BANK'].includes(method)) return res.status(400).json({ error: 'Choose UPI or BANK.' })
  if (!details) return res.status(400).json({ error: method === 'UPI' ? 'Enter your UPI ID.' : 'Enter your bank account details.' })
  await db.user.update({ where: { id: me.id }, data: { payoutMethod: method, payoutDetails: details } })
  res.json({ ok: true, payoutMethod: method, payoutDetails: details })
})

// Request a cash-out of the current payable balance.
affiliateRouter.post('/payout', async (req, res) => {
  const me = (req as any).user
  const user = await db.user.findUnique({ where: { id: me.id } })
  if (!user?.payoutMethod || !user?.payoutDetails) return res.status(400).json({ error: 'Add your payout details first.' })

  const existing = await db.payout.findFirst({ where: { userId: me.id, status: 'REQUESTED' } })
  if (existing) return res.status(409).json({ error: 'You already have a payout request pending.' })

  const summary = await affiliateSummary(me.id)
  if (summary.payablePaise <= 0) return res.status(400).json({ error: 'No withdrawable balance yet. Commission unlocks once your referred orders are delivered.' })

  const payout = await db.payout.create({
    data: { userId: me.id, amountPaise: summary.payablePaise, method: user.payoutMethod, details: user.payoutDetails }
  })
  res.json({ ok: true, payout: { id: payout.id, amount: payout.amountPaise / 100, status: payout.status } })
})
