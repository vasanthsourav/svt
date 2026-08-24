// RazorpayX payouts with a mock fallback (like the checkout flow). When X creds
// are absent, payouts are "manual": admin marks them paid and records a reference.
const X_KEY = process.env.RAZORPAYX_KEY_ID || ''
const X_SECRET = process.env.RAZORPAYX_KEY_SECRET || ''
const X_ACCOUNT = process.env.RAZORPAYX_ACCOUNT_NUMBER || ''

export const razorpayxConfigured = Boolean(X_KEY && X_SECRET && X_ACCOUNT)

export interface PayoutResult { ok: boolean; reference: string; mock: boolean; error?: string }

// Send money to a UPI id / bank via RazorpayX. Mock returns a fake reference.
export async function sendPayout(params: {
  amountPaise: number; method: string; details: string; name: string; notes?: string
}): Promise<PayoutResult> {
  if (!razorpayxConfigured) {
    return { ok: true, reference: `manual_${Date.now()}`, mock: true }
  }
  try {
    // Real RazorpayX requires creating a contact + fund_account + payout. This is
    // a minimal direct payout for UPI; bank requires fund account details. Kept
    // simple — extend per your RazorpayX setup.
    const auth = Buffer.from(`${X_KEY}:${X_SECRET}`).toString('base64')
    const res = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_number: X_ACCOUNT,
        amount: params.amountPaise,
        currency: 'INR',
        mode: params.method === 'UPI' ? 'UPI' : 'IMPS',
        purpose: 'payout',
        fund_account: {
          account_type: params.method === 'UPI' ? 'vpa' : 'bank_account',
          ...(params.method === 'UPI'
            ? { vpa: { address: params.details } }
            : { bank_account: { name: params.name } }),
          contact: { name: params.name, type: 'self' }
        },
        queue_if_low_balance: true,
        notes: { note: params.notes || 'SVT affiliate payout' }
      })
    })
    const data: any = await res.json()
    if (!res.ok) return { ok: false, reference: '', mock: false, error: data?.error?.description || 'Payout failed' }
    return { ok: true, reference: data.id, mock: false }
  } catch (e: any) {
    return { ok: false, reference: '', mock: false, error: e.message }
  }
}
