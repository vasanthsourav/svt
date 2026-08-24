# Sri Venkateshwara Textiles — Online Shop

A professional e‑commerce website for the Kovilpatti textile shop, with a
customer storefront and an admin portal.

- **Storefront** (customers): browse catalogue, search & filter, cart, checkout,
  **Razorpay** payment (or Cash on Delivery), order history with a **live
  tracking timeline** + India Post consignment link + LR copy.
- **Admin portal** (shop staff): dashboard, **add/edit products, upload photos,
  manage stock**, and **process orders** (pack → ship with consignment number +
  LR copy upload → deliver).
- **Two separate logins**: customers (email + password **or** phone OTP) and
  admin (email + password). Roles are enforced on the server.

Brand: maroon + gold, matching the SVT billing desktop app.

## Tech
- **backend/** — Node + Express + Prisma + **SQLite** (single file DB). JWT auth,
  Razorpay (mock fallback), provider‑agnostic OTP, multer uploads.
- **storefront/** — React + Vite + TypeScript + Tailwind.

> ⚙️ **Use Node 24 LTS.** Node 26 + the npm optional‑dependency bug can break the
> Vite/rollup install. (`nvm install 24 && nvm use 24`)

## Run it (two terminals)

### 1) Backend
```bash
cd backend
cp .env.example .env          # defaults work out-of-the-box (mock pay + console OTP)
npm install
npm run setup                 # prisma generate + db push + seed (admin + sample products)
npm run dev                   # → http://localhost:4100
```

### 2) Storefront
```bash
cd storefront
npm install
npm run dev                   # → http://localhost:5180
```

Open **http://localhost:5180**.

## Default logins
- **Admin** → http://localhost:5180/admin/login — `admin@svttextils.com` / `admin123`
  (change in `backend/.env`).
- **Customer** → http://localhost:5180/login — register with email, or use **Phone
  OTP**. In dev (`OTP_PROVIDER=console`) the OTP is shown on screen / in the server
  log — no SMS needed.

## Going live
- **Payments:** put real keys in `backend/.env` (`RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET`). With keys blank the shop runs in **mock mode** (checkout
  auto‑succeeds, no money moves) so you can test the whole flow.
- **OTP SMS:** set `OTP_PROVIDER=http` and point `OTP_HTTP_URL/HEADERS/BODY` at any
  SMS/WhatsApp gateway (MSG91, Fast2SMS, WA Cloud). `{phone}` and `{code}` are
  substituted.
- **Deploy:** one Node server hosts the API + serves the built storefront. Build
  the storefront (`npm run build`) and serve `storefront/dist` behind the same
  origin (or any static host) with the API on `/api`.

## Order lifecycle
`PENDING → PAID → PACKED → SHIPPED → DELIVERED` (or `CANCELLED`, which restores
stock). Each transition is timestamped and shown to the customer as a tracking
timeline.
