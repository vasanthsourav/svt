import { db } from '../db'

// The developer/operator's transparent cut of every sale. Agreed rate, admin-visible.
// A Setting row ('platformFeePercent') overrides this default when present.
const DEFAULT_PCT = Number(process.env.PLATFORM_FEE_PERCENT || '2')

export async function getPlatformFeePercent(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: 'platformFeePercent' } })
  const n = row ? Number(row.value) : DEFAULT_PCT
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PCT
}

export async function setPlatformFeePercent(pct: number): Promise<number> {
  const value = String(Math.max(0, Math.min(50, pct)))
  await db.setting.upsert({
    where: { key: 'platformFeePercent' },
    update: { value },
    create: { key: 'platformFeePercent', value }
  })
  return Number(value)
}

/** Earnings summary for the platform fee: pending (undelivered), payable (delivered,
 *  owed now), paid (already settled), this month, and the underlying orders. */
export async function platformSummary() {
  const orders = await db.order.findMany({
    where: { platformFeeStatus: { not: 'VOID' }, platformFeePaise: { gt: 0 } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNumber: true, totalPaise: true, platformFeePaise: true,
      platformFeeStatus: true, status: true, createdAt: true
    }
  })
  const sum = (st: string) => orders.filter((o) => o.platformFeeStatus === st).reduce((s, o) => s + o.platformFeePaise, 0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthPaise = orders.filter((o) => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + o.platformFeePaise, 0)
  return {
    totalOrders: orders.length,
    pendingPaise: sum('PENDING'),
    payablePaise: sum('PAYABLE'),
    paidPaise: sum('PAID'),
    thisMonthPaise,
    orders
  }
}

/** Settle a payout run: mark everything currently PAYABLE as PAID. Returns how many. */
export async function settlePlatformFees(): Promise<number> {
  const r = await db.order.updateMany({ where: { platformFeeStatus: 'PAYABLE' }, data: { platformFeeStatus: 'PAID' } })
  return r.count
}
