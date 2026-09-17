# VAGMREACH — BDD manual test scenarios

Use this document for **end-to-end manual QA** on http://localhost:4000 (storefront) and http://localhost:4000/admin/ (staff).

**Prerequisites**

- Server: `cd jewellary_project/server && npm run dev`
- Automated subset: `npm run test:smoke` (18 checks; server must be running)
- Seed users: Customer `9888888888` / `customer123`; Admin `9999999999` / `admin123`
- Dev OTP: `OTP_DEV_MODE=true`, code in `.env` (`OTP_DEV_CODE`, default `123456`)

**Format:** Gherkin-style **Given / When / Then**. Tags: `@positive` `@negative` `@storefront` `@admin` `@api`

---

## Feature: Guest shopping (no account)

### Scenario P-G1 — Browse catalog without login @positive @storefront

- **Given** I open the storefront home page
- **When** the page loads
- **Then** I see the navy (`#081426`) theme, gold chrome, and a product grid
- **And** I am not prompted to log in
- **And** Header should not show login button

### Scenario P-G2 — Filter products by category @positive @storefront

- **Given** I am on the storefront with products loaded
- **When** I tap a category filter pill (e.g. Necklace)
- **Then** only products in that category are shown
- **And** the active pill has gold background with dark text (`#081426`)

### Scenario P-G3 — Guest add to cart @positive @storefront @api

- **Given** I am not logged in
- **When** I click **Add to cart** on an in-stock item
- **Then** the cart drawer opens with the line item and totals (incl. GST)
- **And** refreshing the page keeps the cart (same `cartId` cookie)

### Scenario N-G1 — Add out-of-stock quantity @negative @storefront

- **Given** a SKU has very low available stock (e.g. 1 unit left)
- **When** I try to add more than available stock via API or repeated adds beyond limit
- **Then** I see an error such as insufficient stock / only N units available
- **And** the cart is not corrupted

---

## Feature: Customer registration and login

### Scenario P-A1 — Register with Option 1 (mobile + password) @positive @storefront

- **Given** I open the auth modal from **Login**
- **When** I select the **Register** tab
- **And** I choose **Option 1 — Mobile number + password**
- **And** I enter a **new** 10-digit mobile (starts 6–9) and password (min 6 chars)
- **And** I click **Create account**
- **Then** the modal closes
- **And** the header shows **Hi, ···{last4}** or my name and **My account** / **Log out**

### Scenario P-A2 — Register with Option 2 (mobile + OTP) @positive @storefront

- **Given** I am on **Register** with **Option 2 — Mobile number + OTP**
- **When** I enter a **new** mobile and click **Send OTP to mobile**
- **Then** I see a green info message (in dev: OTP code shown)
- **When** I enter the OTP and click **Create account**
- **Then** I am signed in as **CUSTOMER** with session cookie set

### Scenario P-A3 — Login existing customer (password) @positive @storefront

- **Given** seed customer `9888888888` / `customer123`
- **When** I use **Login** tab, Option 1, and submit **Login**
- **Then** I am signed in and can open **My account**

### Scenario P-A4 — Login existing customer (OTP) @positive @storefront

- **Given** an existing customer mobile
- **When** I use Option 2, send OTP, verify with correct code
- **Then** I am logged in (no duplicate user row)

### Scenario N-A1 — Register duplicate mobile (password) @negative @storefront @api

- **Given** mobile `9888888888` already exists
- **When** I register again with the same mobile and any password
- **Then** I see **Mobile already registered** (HTTP 400)

### Scenario N-A2 — Wrong password login @negative @storefront @api

- **When** I login with correct mobile and wrong password
- **Then** I see invalid credentials (HTTP 401)
- **And** no session cookie is issued

### Scenario N-A3 — Wrong or expired OTP @negative @storefront @api

- **When** I verify OTP with `000000` or an old code
- **Then** I see invalid/expired OTP (HTTP 401)

### Scenario N-A4 — Role spoofing in register body @negative @api

- **When** `POST /api/v1/auth/register` includes `"role":"ADMIN"` in JSON
- **Then** created user still has `role: CUSTOMER` (automated: smoke **P-reg** / **N5**)

### Scenario N-A5 — Customer cannot access admin API @negative @api

- **Given** I am logged in as customer
- **When** I call `GET /api/v1/admin/products`
- **Then** HTTP **403** Forbidden

---

## Feature: Checkout gate and orders

### Scenario P-C1 — Checkout requires login @positive @storefront

- **Given** I am a guest with items in cart
- **When** I open checkout / proceed to pay
- **Then** the auth modal appears (checkout copy)
- **When** I log in successfully
- **Then** checkout opens with shipping steps

### Scenario P-C2 — Pincode lookup @positive @storefront @api

- **When** I enter pincode `500001` (or use shipping API)
- **Then** city/state autofill or API returns serviceable location

### Scenario P-C3 — Save address and place COD order @positive @storefront @api

- **Given** I am logged in with cart items and stock reserved
- **When** I complete shipping steps and choose **COD**
- **Then** order moves to paid/confirmed path and I see success UI
- **And** **My account → orders** lists the order

### Scenario N-C1 — Place order without login @negative @api

- **When** `POST /api/v1/orders` with no session
- **Then** HTTP **401** LOGIN_REQUIRED (smoke **N1**)

### Scenario N-C2 — Invalid pincode @negative @storefront @api

- **When** pincode `12345` is used
- **Then** validation error (HTTP 400) (smoke **N9**)

### Scenario N-C3 — Reservation expired @negative @storefront

- **Given** cart reservation TTL (~600s) elapsed without payment
- **When** I try to pay
- **Then** reservation/order rejected with expired or stock error

### Scenario N-C4 — View another user’s order @negative @api

- **Given** customer A and order owned by B
- **When** A calls `GET /api/v1/orders/:id` for B’s order
- **Then** HTTP **403**

---

## Feature: Product media and gallery

### Scenario P-M1 — Storefront gallery from admin uploads @positive @storefront @admin

- **Given** admin uploaded photos (+ optional one video) for a SKU
- **When** I open that product on the shop (card or detail modal)
- **Then** I see primary image, thumbnails, and video when present
- **And** modal scroll stays inside panel (~92dvh)

### Scenario N-M1 — Inactive product hidden @negative @api

- **When** admin deactivates a product
- **Then** `GET /api/v1/products/:id` for shop returns **404** (smoke **N6** for unknown id)

---

## Feature: Staff admin portal

### Scenario P-S1 — Admin login at /admin/ @positive @admin

- **Given** I open http://localhost:4000/admin/
- **When** I log in with `9999999999` / `admin123` (password or OTP tab on admin UI)
- **Then** I reach the admin dashboard
- **And** **View shop** returns to storefront

### Scenario P-S2 — Product CRUD and live preview @positive @admin

- **When** I create or edit a product and save
- **Then** preview panel matches storefront card renderer
- **When** product is active
- **Then** it appears on shop catalog within ~30s poll

### Scenario P-S3 — Upload product media @positive @admin

- **When** I upload JPEG photos (≤5MB each, max 12) and one MP4/WebM video (≤50MB)
- **Then** files appear under `/uploads/products/{id}/` and show on shop

### Scenario N-S1 — Customer blocked from admin UI @negative @admin

- **Given** customer credentials
- **When** I try to use admin login or admin APIs
- **Then** login fails or APIs return **403**

### Scenario N-S2 — Duplicate product slug @negative @admin @api

- **When** I create a product with an existing slug
- **Then** HTTP **409** CONFLICT

### Scenario N-S3 — Oversized upload @negative @admin

- **When** I upload a photo >5MB or video >50MB
- **Then** clear JSON error message (no HTML error page)

---

## Feature: Payments and tracking

### Scenario P-P1 — Razorpay test payment @positive @storefront

- **Given** valid Razorpay test keys in `.env`
- **When** I pay via UPI/card test flow
- **Then** verify endpoint confirms payment and order status updates

### Scenario N-P1 — Tampered Razorpay signature @negative @api

- **When** `POST /api/v1/payments/razorpay/verify` with bad signature
- **Then** HTTP **400**; order stays pending payment

### Scenario P-T1 — Tracking demo AWB @positive @storefront @api

- **When** I track seed AWB (e.g. `BLUEDART-88219034IN`) or use tracking modal
- **Then** timeline events display

### Scenario N-T1 — Unknown AWB @negative @api

- **When** I track a non-existent AWB
- **Then** HTTP **404**

---

## Feature: Session, security, and known gaps

### Scenario P-SEC1 — Logout clears session @positive @storefront

- **When** I click **Log out**
- **Then** header returns to **Login**
- **And** protected APIs return 401 without cookie

### Scenario N-SEC1 — `/me` without session @negative @api

- **When** `GET /api/v1/me/addresses` with no cookie
- **Then** HTTP **401** (smoke **N2**)

### Scenario N-GAP1 — Razorpay webhook not implemented @negative @api

- **When** payment completes but browser closes before client verify
- **Then** there is **no** `POST /webhooks/razorpay` reconciliation yet (manual ops or client verify required)

### Scenario N-GAP2 — Production SMS OTP @negative @ops

- **When** `OTP_DEV_MODE=false` without SMS provider
- **Then** OTP delivery is not production-ready (dev mode required for demo)

---

## Automated coverage map

| Smoke ID | BDD area |
|----------|----------|
| P-health, P1, P2, P4 | Guest catalog & cart |
| P7, P9-read, N2, N3 | Auth & `/me` |
| P-reg, N-reg-dup, P19, N14 | Registration & OTP |
| N9 | Pincode validation |
| N1, N4, N6 | Orders & authorization |
| P14, P15-read | Admin access |

Run: `cd jewellary_project/server && npm run test:smoke`

---

## Manual UI checklist (quick pass)

- [ ] Sticky header solid navy on scroll
- [ ] Auth modal: Login / Register tabs + Option 1 / Option 2 radios
- [ ] Checkout modal scroll inside panel on small viewport
- [ ] Cart drawer safe-area on mobile
- [ ] Admin navy/gold matches shop; media upload + preview
- [ ] No **Staff login** link on customer header

---

## Product readiness summary

| Area | Status |
|------|--------|
| Storefront + cart + checkout gate | Ready for dev/demo |
| Customer register/login (password + OTP) | Ready |
| Admin catalog, orders, media | Ready |
| API docs + smoke tests | Ready |
| Razorpay webhook G.1 | Not implemented |
| Production SMS OTP | Not implemented |
| Hide zero-stock on public API | Optional / not done |

**Verdict:** Suitable as a **full dev/demo product**; production go-live needs webhook, SMS, and ops hardening per [PLAN.md](PLAN.md).
