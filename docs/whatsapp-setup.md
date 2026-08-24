# WhatsApp order notifications — setup

When an order is **confirmed** (COD placed, or online payment verified), the shop
sends two WhatsApp messages automatically:

- **Customer** → an order-confirmation "bill" (order no., total, payment mode).
- **Admin** → a new-order alert (order no., total, customer, delivery address) so
  delivery can be arranged.

The code lives in `backend/src/services/notify.service.ts` and is wired into the
single order-confirmation point (`confirmAndFulfilStock` in `orders.routes.ts`).
It's **fire-and-forget** — a WhatsApp failure never breaks an order.

---

## Mode 1 — MOCK (default, zero setup)

If `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` are **not** set, the service runs in
mock mode: it prints the exact messages to the server log instead of sending
them. Great for testing the flow. You'll see `[notify:MOCK] …` in the Render logs
right after an order is placed.

## Mode 2 — LIVE via WhatsApp Cloud API (Meta, official, free tier)

WhatsApp only lets a business **start** a chat with a **pre-approved template**
(you can't send free-form text first). So you create two templates once, then set
three env vars.

### Step A — get a WhatsApp Cloud API number
1. Create a **Meta Business account** → https://business.facebook.com
2. Go to **Meta for Developers** → https://developers.facebook.com → create an app
   → add the **WhatsApp** product.
3. In *WhatsApp → API setup* you get a **test number** (free) — or connect your
   own business number. Note the **Phone number ID** and a **token**.
   - The temporary token expires in 24h. For production, create a **System User**
     with a **permanent token** (Business Settings → Users → System users →
     generate token with `whatsapp_business_messaging` permission).

### Step B — create the two message templates
In *WhatsApp Manager → Message templates → Create template* (category: **Utility**):

**1. Customer bill** — name it exactly `order_confirmation`, language English.
Body (4 variables, in this order):
```
Hi {{1}}, thank you for shopping with Sri Venkateshwara Textiles! 🛍️
Your order {{2}} is confirmed.
Total: {{3}} — {{4}}.
We'll message you again when it ships. View details anytime in your account.
```

**2. Admin alert** — name it exactly `new_order_admin`, language English.
Body (5 variables, in this order):
```
🛎️ New order {{1}} — {{2}} ({{3}}).
Customer: {{4}}.
Deliver to: {{5}}.
```

> Templates are usually approved within minutes to a few hours. The variable
> **order and count must match** the code. To use different names, set
> `WHATSAPP_CUSTOMER_TEMPLATE` / `WHATSAPP_ADMIN_TEMPLATE`.

### Step C — set env vars (Render → the service → Environment)
```
WHATSAPP_TOKEN     = <permanent token>
WHATSAPP_PHONE_ID  = <phone number id>
ADMIN_WHATSAPP     = 919876543210      # admin's number (with country code, no +)
```
Save → Render redeploys → the next confirmed order sends real WhatsApp messages.

The customer number is taken from the **delivery phone** entered at checkout
(falls back to the account phone). Numbers are normalised to `91XXXXXXXXXX`.

---

## Prefer an Indian provider (AiSensy / Interakt / Gupshup)?
They wrap the same Cloud API with an easier template dashboard + local billing.
Two ways to use one:
- Many let you **bring your own Meta app**, in which case the setup above is
  unchanged (they just help you manage templates).
- Or they expose **their own send API** — in that case add a small provider
  branch in `sendTemplate()` (the service is written to make that a ~15-line
  addition). Tell me which provider and I'll wire it.
