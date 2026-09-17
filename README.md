# VAGMREACH — jewellery ecommerce (single repo)

Amazon-style storefront + admin dashboard + Express API + Prisma (SQLite dev).

## Quick start

```powershell
cd server
copy .env.example .env
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:4000 | Customer storefront |
| http://localhost:4000/admin/ | Admin dashboard |
| http://localhost:4000/health | API health |
| http://localhost:4000/openapi.json | OpenAPI |

**Dev users** (`server/seed/users.json`):

- Customer: `9888888888` / `customer123`
- Admin: `9999999999` / `admin123`
- OTP (dev): set `OTP_DEV_MODE=true`, code in `OTP_DEV_CODE` (default `123456`)

## Docs

- [docs/PLAN.md](docs/PLAN.md) — full product & API spec
- [docs/API.md](docs/API.md) — curl examples
- [docs/EDGE_CASES.md](docs/EDGE_CASES.md) — positive/negative scenarios + smoke test

## Smoke test (edge cases)

With `npm run dev` running in another terminal:

```powershell
cd server
npm run test:smoke
```

## Build

```powershell
cd server
npm run build
npm start
```

## Pending (optional production items)

- Razorpay webhook `POST /webhooks/razorpay`
- Real SMS provider for OTP
- Filter out-of-stock SKUs on public catalog API
