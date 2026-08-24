import { db } from '../db'

const DEFAULT_PCT = Number(process.env.AFFILIATE_COMMISSION_PERCENT || '7')
const HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS || '0') // payable hold after delivery

// ── Commission rate (admin-editable, stored in Setting) ──────────────────────
export async function getCommissionPercent(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: 'affiliateCommissionPercent' } })
  const n = row ? Number(row.value) : DEFAULT_PCT
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PCT
}
export async function setCommissionPercent(pct: number): Promise<number> {
  const value = String(Math.max(0, Math.min(50, pct)))
  await db.setting.upsert({ where: { key: 'affiliateCommissionPercent' }, update: { value }, create: { key: 'affiliateCommissionPercent', value } })
  return Number(value)
}

// ── Referral codes ───────────────────────────────────────────────────────────
function genCode(name?: string | null): string {
  const base = (name || 'SVT').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'SVT'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${rand}`
}

export async function ensureReferralCode(userId: number): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.referralCode) return user.referralCode
  // generate a unique code
  for (let i = 0; i < 8; i++) {
    const code = genCode(user.name)
    const clash = await db.user.findUnique({ where: { referralCode: code } })
    if (!clash) {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } })
      return code
    }
  }
  // fallback: deterministic
  const code = `SVT${userId}${Date.now().toString(36).toUpperCase().slice(-3)}`
  await db.user.update({ where: { id: userId }, data: { referralCode: code } })
  return code
}

export async function findReferrerByCode(
  code: string
): Promise<{ id: number; affiliateStatus: string | null; commissionPercent: number | null } | null> {
  const c = code.trim().toUpperCase()
  if (!c) return null
  return db.user.findUnique({
    where: { referralCode: c },
    select: { id: true, affiliateStatus: true, commissionPercent: true }
  })
}

/** The commission % that applies to a referrer: their personal rate, else the global default. */
export async function effectiveCommissionPercent(personalPercent: number | null): Promise<number> {
  if (personalPercent !== null && Number.isFinite(personalPercent) && personalPercent >= 0) return personalPercent
  return getCommissionPercent()
}

/** Sign up (or re-open) the current user as an affiliate: generate a code, mark PENDING. */
export async function applyAsAffiliate(userId: number): Promise<{ code: string; status: string }> {
  const code = await ensureReferralCode(userId)
  const user = await db.user.findUnique({ where: { id: userId }, select: { affiliateStatus: true } })
  // Only (re)set to PENDING from a non-active state; never downgrade an APPROVED affiliate.
  if (!user?.affiliateStatus || user.affiliateStatus === 'REJECTED') {
    await db.user.update({ where: { id: userId }, data: { affiliateStatus: 'PENDING' } })
    return { code, status: 'PENDING' }
  }
  return { code, status: user.affiliateStatus }
}

/** Count a click on an affiliate's link. No-op for an unknown code. */
export async function recordReferralClick(code: string): Promise<void> {
  const c = code.trim().toUpperCase()
  if (!c) return
  await db.user.updateMany({ where: { referralCode: c }, data: { referralClicks: { increment: 1 } } })
}

// ── Earnings summary for one affiliate ───────────────────────────────────────
export async function affiliateSummary(userId: number) {
  const orders = await db.order.findMany({
    where: { referredByUserId: userId, commissionStatus: { not: 'VOID' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNumber: true, totalPaise: true, commissionPaise: true, commissionStatus: true, status: true, createdAt: true }
  })
  const sum = (st: string) => orders.filter((o) => o.commissionStatus === st).reduce((s, o) => s + o.commissionPaise, 0)
  return {
    referredOrders: orders.length,
    pendingPaise: sum('PENDING'),    // not yet delivered
    payablePaise: sum('PAYABLE'),    // delivered, available to withdraw
    paidPaise: sum('PAID'),
    orders
  }
}

export const HOLD_DAYS_VALUE = HOLD_DAYS
