# VAGMREACH — positive & negative edge cases

Use with [PLAN.md](PLAN.md) (full spec) and [API.md](API.md) (curl). **Manual BDD scenarios:** [BDD_MANUAL_TEST.md](BDD_MANUAL_TEST.md). Run automated checks: `cd server && npm run test:smoke` (API must be up on `PORT`, default **4000**).

**Dev logins** ([users.json](../server/seed/users.json)): Customer `9888888888` / `customer123`; Admin `9999999999` / `admin123`. OTP dev code: `.env` `OTP_DEV_CODE` (default `123456`).

---

## Development completion snapshot

| Area | Status |
|------|--------|
| Shop API (A–E), Auth, `/me`, Admin API/UI (G–H) | **Complete** |
| Storefront checkout gate, cart, Razorpay/COD paths | **Complete** |
| API docs + OpenAPI | **Complete** |
| Root README | **Complete** ([README.md](../README.md)) |
| Edge-case doc + smoke script | **This file + `npm run test:smoke`** |
| `POST /webhooks/razorpay` (G.1) | **Pending** |
| Production SMS OTP | **Pending** (use `OTP_DEV_MODE`) |
| Hide `stock = 0` on public catalog API | **Pending** (optional) |
| Full automated test suite (Jest/Vitest) | **Pending** |

Core ecommerce flows are **shippable for dev/demo**; production hardening items above remain optional follow-ups.

---

## Positive edge cases (expected success)

| # | Scenario | How to verify | Expected |
|---|----------|---------------|----------|
| P1 | Guest browses catalog | `GET /api/v1/products` | `success: true`, only `isActive` products |
| P2 | Guest add-to-cart | `POST /api/v1/cart/items` + `cartId` cookie | Line added; totals include GST |
| P3 | Guest cart survives refresh | Same `cartId` cookie, `GET /api/v1/cart` | Same lines |
| P4 | Pincode autofill | `GET /api/v1/shipping/pincode/500001` | City/state returned |
| P5 | Shipping rates | `GET /api/v1/shipping/rates?pincode=500001&cartId=…` | Courier options |
| P6 | Stock reservation | `POST /api/v1/cart/reserve` | `expiresAt` ~600s ahead |
| P7 | Customer login (password) | `POST /api/v1/auth/login/password` | Session cookie; `role: CUSTOMER` |
| P8 | Guest cart merge on login | Add as guest → login as customer | Quantities merged, capped by stock |
| P9 | Save address | `POST /api/v1/me/addresses` (auth) | Address listed on `GET /me/addresses` |
| P10 | Checkout validate | `POST /api/v1/checkout/validate` (auth) | Serviceability OK for valid pincode |
| P11 | Create order | `POST /api/v1/orders` (auth, valid cart/reservation) | `PENDING_PAYMENT`, address snapshot on order |
| P12 | COD complete | `POST /api/v1/payments/cod` | Order `PAID`, AWB/shipment stub |
| P13 | Order history | `GET /api/v1/me/orders` | Includes paid orders for user |
| P14 | Admin login | Password as `9999999999` | `role: ADMIN` |
| P15 | Admin product CRUD | `POST/PATCH /api/v1/admin/products` | Active SKU on `GET /products` within ~30s poll |
| P16 | Admin order update | `PATCH /api/v1/admin/orders/:id` | Status changes persist |
| P17 | Tracking demo AWB | `GET /api/v1/tracking/BLUEDART-88219034IN` (seed) | Timeline events |
| P18 | Idempotent payment verify | Repeat `POST …/razorpay/verify` with same payment id | Same success payload, no double stock decrement |
| P19 | OTP new customer | `otp/request` + `otp/verify` with new mobile + name | Creates `CUSTOMER`, session issued |
| P20 | Admin preview panel | Edit product in `/admin/` | Preview matches `renderStorefrontCard` draft |

---

## Negative edge cases (expected failure / safe behavior)

| # | Scenario | How to verify | Expected |
|---|----------|---------------|----------|
| N1 | Checkout without login | `POST /api/v1/orders` no cookie | **401** `LOGIN_REQUIRED` |
| N2 | `/me/*` without session | `GET /api/v1/me/addresses` | **401** |
| N3 | Wrong password | `POST /auth/login/password` bad password | **401** invalid credentials |
| N4 | Customer calls admin API | Customer session → `GET /api/v1/admin/products` | **403** `FORBIDDEN` |
| N5 | Client sends `role: ADMIN` in body | Register/login payloads | Ignored; role from DB only |
| N6 | Inactive product on shop | `GET /products/:id` for deactivated SKU | **404** |
| N7 | Duplicate admin slug | `POST /admin/products` duplicate slug | **409** `CONFLICT` |
| N8 | Address not owned | `PATCH /me/addresses/:otherUserId` | **403** (not 404 enumeration) |
| N9 | Invalid pincode | Address or checkout with `12345` | **400** validation |
| N10 | Reservation expired at pay | Wait > TTL or skip reserve → pay | **409** `RESERVATION_EXPIRED` or order rejected |
| N11 | Insufficient stock | Add qty > available | **409** `INSUFFICIENT_STOCK` |
| N12 | Another user's order | Customer A → `GET /orders/:id` for B's order | **403** |
| N13 | Razorpay bad signature | `POST /payments/razorpay/verify` tampered sig | **400**, order stays `PENDING_PAYMENT` |
| N14 | OTP wrong / expired | Bad OTP or after TTL | **401**; attempts limited |
| N15 | Admin UI as customer | Customer opens `/admin/` | Login fails or APIs **403** |
| N16 | Double admin soft-delete | `DELETE /admin/products/:id` twice | Second call safe; product stays inactive |
| N17 | Payment amount mismatch | Verify with wrong amount (if tampered) | Reject verify; log/security handling |
| N18 | Session expired mid-checkout | Clear cookie → `POST /orders` | **401**; guest `cartId` may remain |
| N19 | Brute force (light) | Many rapid login attempts | Rate limit response |
| N20 | Webhook missing (G.1) | Browser closed after Razorpay pay | Manual reconcile or webhook **not implemented yet** |

---

## Manual UI checklist (storefront)

See **[BDD_MANUAL_TEST.md](BDD_MANUAL_TEST.md)** for full Given/When/Then scenarios. Quick checks:
- [ ] Catalog grid loads; filter chips work.
- [ ] Cart drawer, 10‑min timer bar when reserved.
- [ ] Checkout opens auth modal when logged out.
- [ ] My Orders / Addresses modals after login.
- [ ] Razorpay or COD completes success modal.

---

## Automated smoke test

```powershell
cd jewellary_project\server
npm run dev
# separate terminal:
npm run test:smoke
```

The script runs a subset of **P** and **N** cases against `http://localhost:4000` and prints pass/fail.
