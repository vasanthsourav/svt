import crypto from 'crypto'
import Razorpay from 'razorpay'

const KEY_ID = process.env.RAZORPAY_KEY_ID || ''
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ''

// When keys are absent we run in MOCK mode: no real gateway call, checkout is
// auto-confirmed so the whole flow is testable without a Razorpay account.
export const razorpayConfigured = Boolean(KEY_ID && KEY_SECRET)
export const razorpayKeyId = KEY_ID

const client = razorpayConfigured ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null

export interface RpOrder {
  id: string
  amount: number
  currency: string
  mock: boolean
}

export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<RpOrder> {
  if (!client) {
    return { id: `mock_order_${Date.now()}_${receipt}`, amount: amountPaise, currency: 'INR', mock: true }
  }
  const order = await client.orders.create({ amount: amountPaise, currency: 'INR', receipt })
  return { id: order.id, amount: Number(order.amount), currency: order.currency, mock: false }
}

// Verify the signature Razorpay Checkout returns to the browser.
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!razorpayConfigured) return true // mock mode: always valid
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return expected === signature
}
