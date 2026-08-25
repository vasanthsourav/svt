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

---

## Easy Split — automatic revenue share (optional)

Cashfree can settle an agreed share of every payment straight to a second bank
account, so a developer/operator fee is paid at the moment the customer pays
instead of being invoiced later.

```
CASHFREE_SPLIT_VENDOR_ID = <vendor id from the Cashfree dashboard>
CASHFREE_SPLIT_PERCENT   = 2
```

Leave either blank and orders are created exactly as before. `/api/health`
reports `split: on|off` so you can confirm it took effect.

**Before it can work, two things happen in the merchant's Cashfree account:**

1. **Easy Split is enabled** on the account (request it from Cashfree — it is not
   on by default).
2. **The vendor is onboarded** there, with PAN and bank details for KYC, which is
   what produces the vendor id.

Both are actions on the merchant side, and the resulting splits appear in the
merchant's own settlement reports — Easy Split is designed that way, and payment
aggregators are regulated to show a merchant where their money went. So this is
something the shop sets up with you, not something that can be added quietly.

**Two details worth getting right:**

- **Percentage, not amount.** Cashfree does not support split-by-amount for
  vendor-prepaid charges, so the code always sends a percentage.
- **Different base from the in-app platform fee.** The Easy Split percentage
  applies to the whole order amount *including* the ₹79 delivery charge, whereas
  `PLATFORM_FEE_PERCENT` in `/admin/platform` is calculated on the item subtotal
  only. On a ₹1,299 basket that is ₹27.56 via Easy Split vs ₹25.98 via the
  tracker. Pick one as the source of truth — running both will double-count.

---

## Razorpay
The Razorpay integration is still present and working. If you set Razorpay keys
and no Cashfree keys, the shop uses Razorpay exactly as before.
