// WhatsApp order notifications — customer bill + admin new-order alert.
//
// Pluggable, mock-first (same pattern as razorpay/cloudinary/tryon):
//   • No env set        → MOCK: the composed messages are printed to the server
//                          log, so you can see the exact bill without any setup.
//   • WhatsApp Cloud API → set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (+ ADMIN_WHATSAPP)
//                          and real template messages are sent via Meta's API.
//
// Why templates? WhatsApp only lets a business *start* a conversation using a
// pre-approved "template" — you can't send free-form text first. So the two
// messages below map to two templates you create once in Meta (or your provider):
//
//   1) customer template  (default name: order_confirmation)  — 4 body params:
//        {{1}} customer name   {{2}} order number   {{3}} total ₹   {{4}} payment
//   2) admin template     (default name: new_order_admin)     — 5 body params:
//        {{1}} order number  {{2}} total ₹  {{3}} payment  {{4}} customer  {{5}} address
//
// Everything is fire-and-forget: a WhatsApp failure NEVER breaks an order.

const TOKEN = process.env.WHATSAPP_TOKEN || ''
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || ''
const ADMIN_WA = process.env.ADMIN_WHATSAPP || ''
const CUSTOMER_TEMPLATE = process.env.WHATSAPP_CUSTOMER_TEMPLATE || 'order_confirmation'
const ADMIN_TEMPLATE = process.env.WHATSAPP_ADMIN_TEMPLATE || 'new_order_admin'
const LANG = process.env.WHATSAPP_LANG || 'en'
const SHOP_NAME = process.env.SHOP_NAME || 'Sri Venkateshwara Textiles'
const DEFAULT_CC = process.env.WHATSAPP_COUNTRY_CODE || '91' // India

// "Cloud API" mode is active only when we have both a token and a phone-number id.
export const whatsappIsLive = Boolean(TOKEN && PHONE_ID)

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

// Normalise an Indian mobile to WhatsApp's "digits with country code" form.
// "98765 43210" → "919876543210"; already-prefixed numbers are kept as-is.
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = String(raw).replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) d = DEFAULT_CC + d          // bare 10-digit → prepend CC
  else if (d.length === 11 && d.startsWith('0')) d = DEFAULT_CC + d.slice(1)
  return d.length >= 11 && d.length <= 15 ? d : null
}

function oneLineAddress(o: any): string {
  return [o.shipLine1, o.shipLine2, o.shipCity, o.shipState, o.shipPincode]
    .filter(Boolean).join(', ')
}

function paymentLabel(mode: string): string {
  if (mode === 'COD') return 'Cash on Delivery'
  if (mode === 'RAZORPAY') return 'Paid online'
  return mode || 'Paid'
}

// A human-readable bill — used verbatim in MOCK mode (and handy for logs).
function billText(o: any): string {
  const lines = (o.items || []).map((it: any) => {
    const sz = it.size ? ` (${it.size})` : ''
    return `• ${it.name}${sz} ×${it.quantity} — ${rupees(it.pricePaise * it.quantity)}`
  })
  return [
    `${SHOP_NAME} — Order ${o.orderNumber}`,
    ...lines,
    `Total: ${rupees(o.totalPaise)} (${paymentLabel(o.paymentMode)})`,
    `Deliver to: ${o.shipName}, ${oneLineAddress(o)}`
  ].join('\n')
}

// Send one WhatsApp Cloud API template message. Returns true on success.
async function sendTemplate(to: string, template: string, params: string[]): Promise<boolean> {
  const url = `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: LANG },
      components: [
        { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }
      ]
    }
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error(`[notify] WhatsApp send failed (${resp.status}) to ${to}: ${detail}`)
      return false
    }
    return true
  } catch (e: any) {
    console.error(`[notify] WhatsApp send error to ${to}:`, e?.message || e)
    return false
  }
}

// Fire the customer bill + admin alert for a freshly-confirmed order.
// Safe to call fire-and-forget: it swallows all errors internally.
export async function notifyOrderConfirmed(order: any): Promise<void> {
  try {
    const customerName = order.shipName || order.user?.name || 'Customer'
    const total = rupees(order.totalPaise)
    const pay = paymentLabel(order.paymentMode)

    // MOCK mode — print the bill so the flow is visible without any WhatsApp setup.
    if (!whatsappIsLive) {
      console.log('\n[notify:MOCK] WhatsApp is not configured — would have sent:')
      console.log('  → CUSTOMER:\n' + billText(order).split('\n').map((l) => '     ' + l).join('\n'))
      const adminTo = normalizePhone(ADMIN_WA)
      console.log(`  → ADMIN (${adminTo || 'ADMIN_WHATSAPP not set'}): New order ${order.orderNumber}, ${total} (${pay}), ` +
        `${customerName} ${order.shipPhone || ''} — ${oneLineAddress(order)}\n`)
      return
    }

    // LIVE mode — send both template messages.
    const customerTo = normalizePhone(order.shipPhone || order.user?.phone)
    if (customerTo) {
      await sendTemplate(customerTo, CUSTOMER_TEMPLATE, [customerName, order.orderNumber, total, pay])
    } else {
      console.warn(`[notify] Order ${order.orderNumber}: no valid customer phone — skipped customer WhatsApp.`)
    }

    const adminTo = normalizePhone(ADMIN_WA)
    if (adminTo) {
      const customerLine = `${customerName} (${order.shipPhone || 'no phone'})`
      await sendTemplate(adminTo, ADMIN_TEMPLATE, [order.orderNumber, total, pay, customerLine, oneLineAddress(order)])
    }
  } catch (e: any) {
    console.error('[notify] notifyOrderConfirmed failed:', e?.message || e)
  }
}
