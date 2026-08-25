// Cashfree Payment Gateway — order creation + server-side verification.
//
// Mock-first, exactly like razorpay.service: with no credentials the whole
// checkout still works end-to-end (auto-confirmed, no gateway call), so the
// shop is testable without an account. Set the two keys to go live.
//
//   CASHFREE_APP_ID      app id from the Cashfree merchant dashboard
//   CASHFREE_SECRET_KEY  matching secret key
//   CASHFREE_ENV         'sandbox' (default) or 'production'
//
// Note Cashfree bills in RUPEES with two decimals, while this codebase stores
// money as integer paise — every amount crossing this boundary is converted.

const APP_ID = process.env.CASHFREE_APP_ID || ''
const SECRET = process.env.CASHFREE_SECRET_KEY || ''
const ENV = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox'

// Pinned deliberately: Cashfree keys request/response shapes to this date-version,
// so upgrading is a conscious change rather than something that shifts underfoot.
const API_VERSION = '2026-01-01'

export const cashfreeConfigured = Boolean(APP_ID && SECRET)
export const cashfreeEnv = ENV

const BASE = ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg'

const headers = () => ({
  'x-api-version': API_VERSION,
  'x-client-id': APP_ID,
  'x-client-secret': SECRET,
  'Content-Type': 'application/json'
})

// Cashfree validates customer_phone: 10 digits, or international with a leading '+'.
// Checkout only guarantees "at least 8 chars", so normalise before sending.
export function normalizeCustomerPhone(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/\D/g, '')
  if (d.length === 10) return d
  if (d.length === 11 && d.startsWith('0')) return d.slice(1)
  if (d.length === 12 && d.startsWith('91')) return d.slice(2)   // 91XXXXXXXXXX → 10-digit
  if (d.length > 10) return `+${d}`                              // some other country
  return d
}

export interface CfOrder {
  orderId: string           // our orderNumber, echoed back
  paymentSessionId: string  // what the browser SDK needs
  amount: number            // rupees
  currency: string
  env: string               // browser SDK mode must match the base URL used here
  mock: boolean
}

export async function createCashfreeOrder(opts: {
  orderNumber: string
  amountPaise: number
  customerId: string | number
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  returnUrl?: string
}): Promise<CfOrder> {
  const amount = Number((opts.amountPaise / 100).toFixed(2))

  if (!cashfreeConfigured) {
    return {
      orderId: opts.orderNumber,
      paymentSessionId: `mock_session_${opts.orderNumber}`,
      amount, currency: 'INR', env: ENV, mock: true
    }
  }

  const body: Record<string, unknown> = {
    order_id: opts.orderNumber,
    order_amount: amount,
    order_currency: 'INR',
    customer_details: {
      customer_id: String(opts.customerId),
      customer_name: opts.customerName || undefined,
      customer_email: opts.customerEmail || undefined,
      customer_phone: normalizeCustomerPhone(opts.customerPhone)
    }
  }
  if (opts.returnUrl) body.order_meta = { return_url: opts.returnUrl }

  const resp = await fetch(`${BASE}/orders`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  const data: any = await resp.json().catch(() => ({}))
  if (!resp.ok || !data?.payment_session_id) {
    // Surface Cashfree's own message — it names the offending field (bad phone,
    // duplicate order id, wrong keys), which is what makes this debuggable.
    const msg = data?.message || data?.error_description || `Cashfree order failed (HTTP ${resp.status})`
    throw new Error(msg)
  }

  return {
    orderId: data.order_id || opts.orderNumber,
    paymentSessionId: data.payment_session_id,
    amount: Number(data.order_amount ?? amount),
    currency: data.order_currency || 'INR',
    env: ENV,
    mock: false
  }
}

// The authority on whether money actually arrived. Never trust the browser:
// after checkout returns we ask Cashfree directly and require order_status PAID.
export async function isCashfreeOrderPaid(orderNumber: string): Promise<{ paid: boolean; status: string; paymentId?: string }> {
  if (!cashfreeConfigured) return { paid: true, status: 'MOCK_PAID', paymentId: 'mock_pay' }

  const resp = await fetch(`${BASE}/orders/${encodeURIComponent(orderNumber)}`, { method: 'GET', headers: headers() })
  const data: any = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    console.error(`[cashfree] status lookup failed for ${orderNumber} (HTTP ${resp.status}):`, data?.message || '')
    return { paid: false, status: `LOOKUP_FAILED_${resp.status}` }
  }
  const status = String(data?.order_status || 'UNKNOWN')
  return { paid: status === 'PAID', status, paymentId: data?.cf_order_id ? String(data.cf_order_id) : undefined }
}
