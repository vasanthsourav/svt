// Loads the Cashfree JS SDK (v3) on demand and opens the payment modal.

let loaded = false
function loadScript(): Promise<boolean> {
  if (loaded) return Promise.resolve(true)
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    s.onload = () => { loaded = true; resolve(true) }
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export interface CashfreePayParams {
  paymentSessionId: string
  // Must match the environment the session was created in on the server — a
  // sandbox session id is rejected by an SDK running in production mode.
  env: string
}

// Resolves when the customer finishes the flow. It deliberately reports no
// payment details: the server re-checks the real status with Cashfree, so
// nothing the browser could claim here is trusted.
export async function openCashfree(p: CashfreePayParams): Promise<void> {
  const ok = await loadScript()
  if (!ok) throw new Error('Could not load the payment gateway. Check your connection.')

  const Cashfree = (window as any).Cashfree
  if (!Cashfree) throw new Error('Payment gateway failed to initialise. Please try again.')

  const cashfree = Cashfree({ mode: p.env === 'production' ? 'production' : 'sandbox' })

  const result: any = await cashfree.checkout({
    paymentSessionId: p.paymentSessionId,
    redirectTarget: '_modal' // keep the customer inside the SPA
  })

  // The SDK reports a dismissed modal or a gateway-side failure here; a genuine
  // decline still has to be distinguished from success by the server check.
  if (result?.error) throw new Error(result.error.message || 'Payment was not completed.')
}
