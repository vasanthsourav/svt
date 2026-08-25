# Cashfree Payments — setup

The shop takes online payments through **Cashfree Payment Gateway** (UPI, cards,
netbanking, wallets). Like the rest of this codebase it is **mock-first**: with no
credentials the checkout still works end-to-end and auto-confirms, so you can test
ordering without an account or any money moving.

Code: `backend/src/services/cashfree.service.ts`, wired into
`backend/src/routes/orders.routes.ts`; browser side in
`storefront/src/lib/cashfree.ts`.

---

## How the flow works

1. Customer picks **Pay Online** and places the order → the order is saved as
   `PENDING` and **no stock is deducted yet**.
2. The server creates a Cashfree order and returns a `payment_session_id`.
3. The browser opens the Cashfree modal with that session id.
4. When the modal closes, the server asks **Cashfree** whether the order is
   `PAID`, and only then marks it paid, deducts stock and fires the WhatsApp
   alerts.

Step 4 is the important one: **nothing the browser claims about the payment is
trusted.** A customer cannot mark their own order paid.

---

## Going live

### Step A — get your API keys
1. Sign up / log in at **https://merchant.cashfree.com**
2. Complete KYC (PAN, GST, bank account) — required before you can accept real money.
3. Go to **Developers → API Keys** and copy the **App ID** and **Secret Key**.
   There are separate keys for **Sandbox** (test) and **Production** (real money).

### Step B — set the env vars in the Render dashboard
Open your `svt-shop` service → **Environment** → add:

```
CASHFREE_APP_ID     = <your app id>
CASHFREE_SECRET_KEY = <your secret key>
CASHFREE_ENV        = sandbox        # switch to "production" when you're ready
```

Save → Render redeploys → the next online order goes through Cashfree for real.

> ⚠️ Add these **in the dashboard, not in `render.yaml`**. A `sync: false` entry
> in the blueprint doesn't set a value — it only makes Render stop and ask for
> one, which has previously jammed the deploy queue.

### Step C — test with sandbox first
Set `CASHFREE_ENV=sandbox` and use Cashfree's test cards / test UPI from their
dashboard. You'll see the real checkout UI and the real confirmation flow, but no
money moves. When you're happy, flip `CASHFREE_ENV=production`.

### Verifying it took effect
```
curl https://www.svtkvp.in/api/health
```
`payments` reports `cashfree-sandbox`, `cashfree-production`, `razorpay-live`, or
`mock`. That's the quickest way to confirm the keys landed without reading logs.

---

## Notes

- **Which gateway runs is decided by the server**, never the browser. Precedence:
  Cashfree keys → Razorpay keys → mock. `PAYMENT_GATEWAY=cashfree|razorpay` forces
  one if you ever have both configured.
- **Amounts.** This codebase stores money as integer paise; Cashfree bills in
  rupees with two decimals. The conversion happens in one place
  (`createCashfreeOrder`) so it can't drift.
- **Order ids.** The shop's own `orderNumber` (e.g. `SVTO-M1ABCD`) is used as
  Cashfree's `order_id`, which is what makes verification a simple lookup.
- **Delivery charge.** ₹79 under ₹1499, free above — this is now included in the
  amount charged. Affiliate commission and the platform fee are still calculated
  on the item subtotal only, never on freight.
- **Failed gateway call.** If Cashfree can't be reached the order stays `PENDING`
  with stock untouched and the customer sees an error, so nothing is half-done.
- **API version** is pinned to `2026-01-01` in the service, so Cashfree changing
  their default can't alter behaviour underneath you.

## Razorpay
The Razorpay integration is still present and working. If you set Razorpay keys
and no Cashfree keys, the shop uses Razorpay exactly as before.
