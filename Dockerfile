# ── SVT-Shop — single-container build (storefront + API on one server) ────────
# Build:  docker build -t svt-shop .
# Run:    docker run -p 4100:4100 --env-file backend/.env -v svt_data:/app/backend/prisma -v svt_uploads:/app/backend/uploads svt-shop

FROM node:20-slim AS build
WORKDIR /app

# Build the storefront
COPY storefront/package*.json storefront/
RUN cd storefront && npm install
COPY storefront/ storefront/
RUN cd storefront && npm run build

# Install backend deps + generate Prisma client
COPY backend/package*.json backend/
RUN cd backend && npm install
COPY backend/ backend/
RUN cd backend && npx prisma generate

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# openssl is needed by Prisma at runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/backend /app/backend
COPY --from=build /app/storefront/dist /app/storefront/dist

WORKDIR /app/backend
EXPOSE 4100
# Applies schema (safe/additive) then starts the server which also serves the SPA.
CMD ["npm", "run", "start:prod"]
