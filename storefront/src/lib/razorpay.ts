// Loads Razorpay Checkout on demand and opens the payment modal.

let loaded = false
function loadScript(): Promise<boolean> {
  if (loaded) return Promise.resolve(true)
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => { loaded = true; resolve(true) }
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export interface RazorpayPayParams {
  keyId: string
  amount: number // paise
  currency: string
  orderId: string
  name: string
  description: string
  prefill?: { name?: string; email?: string; contact?: string }
}

export async function openRazorpay(p: RazorpayPayParams): Promise<{ razorpayPaymentId: string; razorpaySignature: string }> {
  const ok = await loadScript()
  if (!ok) throw new Error('Could not load the payment gateway. Check your connection.')
  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: p.keyId,
      amount: p.amount,
      currency: p.currency,
      name: p.name,
      description: p.description,
      order_id: p.orderId,
      prefill: p.prefill,
      theme: { color: '#6b1d2b' },
      handler: (resp: any) =>
        resolve({ razorpayPaymentId: resp.razorpay_payment_id, razorpaySignature: resp.razorpay_signature }),
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) }
    })
    rzp.open()
  })
}
