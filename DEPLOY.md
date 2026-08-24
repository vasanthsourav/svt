# Deploying Sri Venkateshwara Textiles online shop

The site + API run as **one Node server** (the API also serves the built
storefront), so you only host **one thing**. Put HTTPS in front of it.

Node 20+ recommended. All money is test/mock until you add Razorpay keys.

---

## What you'll provide later (not needed to deploy)
- **Razorpay LIVE keys** → set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `.env` and restart. (Blank = safe mock mode.)
- **SMS gateway** for phone OTP → set `OTP_PROVIDER=http` + the `OTP_HTTP_*` vars. (Email login works without it.)
- **RazorpayX** for auto affiliate payouts → `RAZORPAYX_*`. (Blank = manual payouts.)

> ℹ️ Before Razorpay activates live payments it checks your **Terms, Privacy,
> Refund and Shipping** pages and **Contact** details — these are already built
> into the site (footer links). Update your real phone/email/address in
> `storefront/src/lib/shop.ts` and rebuild.

---

## Option A — Docker (simplest, any VPS)
```bash
cd SVT-Shop
cp backend/.env.production.example backend/.env   # then edit JWT_SECRET, admin pw, etc.
docker build -t svt-shop .
docker run -d --name svt-shop -p 4100:4100 \
  --env-file backend/.env \
  -v svt_data:/app/backend/prisma \      # persists the SQLite DB
  -v svt_uploads:/app/backend/uploads \  # persists product/LR images
  --restart unless-stopped svt-shop
# Seed the admin + sample catalogue once:
docker exec -it svt-shop npm run db:seed
```
Then point a reverse proxy (below) at `localhost:4100`.

## Option B — Plain VPS (Node + PM2)
```bash
# one-time
cd SVT-Shop/backend
cp .env.production.example .env      # edit it
npm install
npm run build:client                 # builds ../storefront/dist
npm run setup                        # prisma generate + db push + seed (admin + samples)
# run with PM2 so it restarts on crash/reboot
npm i -g pm2
pm2 start "npm run start:prod" --name svt-shop
pm2 save && pm2 startup
```

### HTTPS with Caddy (auto SSL, 4 lines)
`/etc/caddy/Caddyfile`:
```
yourdomain.com {
    reverse_proxy localhost:4100
}
```
`sudo systemctl reload caddy` → done, HTTPS is automatic. Point your domain's DNS
`A` record at the server IP first.

## Option C — Render.com (managed, no server admin)
- New **Web Service** from this repo.
- Environment: **Docker** (uses the included `Dockerfile`).
- Add a **persistent disk** mounted at `/app/backend/prisma` (for the DB) and
  optionally `/app/backend/uploads`.
- Add the env vars from `.env.production.example`.
- Deploy. Render gives you HTTPS + a URL automatically. Run the seed once from
  the Render shell: `npm run db:seed`.

---

## After it's live
1. Open `https://yourdomain.com/admin/login` → change the admin password.
2. Add your **real products + photos** (Admin → Products).
3. Test a full order with **mock payment**, then plug in Razorpay keys and test a
   ₹1 live order.
4. Backups: the server auto-copies the DB to `backend/backups/` hourly (keeps 48).
   Also copy that folder (or the mounted volume) off-server periodically.

## Updating later
```bash
git pull                       # or copy new files
cd backend && npm run build:client && pm2 restart svt-shop
# (Docker) docker build -t svt-shop . && docker restart svt-shop
```
Schema changes apply automatically & safely on start (`prisma db push`).
