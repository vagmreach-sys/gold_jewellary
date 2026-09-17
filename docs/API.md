# VAGMREACH API Reference (`/api/v1`)

Base URL (local): `http://localhost:4000/api/v1`

All JSON responses:

```json
{ "success": true, "data": { ... }, "meta": { ... } }
```

Errors: `{ "success": false, "error": "message" }`

Use cookies (`cartId`) for cart session — browser `fetch` with `credentials: 'include'`, or pass `X-Cart-Id` header.

---

## Health & OpenAPI

```bash
curl.exe http://localhost:4000/health
curl.exe http://localhost:4000/openapi.json
```

---

## Catalog

### List products

```bash
curl.exe "http://localhost:4000/api/v1/products?category=necklace&sort=price_asc"
```

Query: `category`, `q`, `sort` (`price_asc` | `price_desc`), `page`, `limit`

### Product detail

```bash
curl.exe http://localhost:4000/api/v1/products/1
```

### Reviews

```bash
curl.exe "http://localhost:4000/api/v1/products/1/reviews?page=1&limit=5"
```

---

## Cart

### Get cart

```bash
curl.exe -c cookies.txt -b cookies.txt http://localhost:4000/api/v1/cart
```

### Add item

```bash
curl.exe -c cookies.txt -b cookies.txt -X POST http://localhost:4000/api/v1/cart/items ^
  -H "Content-Type: application/json" ^
  -d "{\"productId\":1,\"quantity\":1}"
```

### Update quantity

```bash
curl.exe -b cookies.txt -X PATCH http://localhost:4000/api/v1/cart/items/1 ^
  -H "Content-Type: application/json" ^
  -d "{\"quantity\":2}"
```

### Remove item

```bash
curl.exe -b cookies.txt -X DELETE http://localhost:4000/api/v1/cart/items/1
```

### Clear cart

```bash
curl.exe -b cookies.txt -X DELETE http://localhost:4000/api/v1/cart
```

### Reserve stock (10 min TTL)

```bash
curl.exe -b cookies.txt -X POST http://localhost:4000/api/v1/cart/reserve
```

### Reservation status

```bash
curl.exe -b cookies.txt http://localhost:4000/api/v1/cart/reservation
```

### Release reservation

```bash
curl.exe -b cookies.txt -X POST http://localhost:4000/api/v1/cart/reservation/release
```

---

## Shipping

### Resolve pincode

```bash
curl.exe http://localhost:4000/api/v1/shipping/pincode/500001
```

### Courier rates

```bash
curl.exe -b cookies.txt "http://localhost:4000/api/v1/shipping/rates?pincode=500033"
```

---

## Checkout & orders

### Validate checkout

```bash
curl.exe -b cookies.txt -X POST http://localhost:4000/api/v1/checkout/validate ^
  -H "Content-Type: application/json" ^
  -d "{\"customerName\":\"Priya Nambiar\",\"customerPhone\":\"9845012345\",\"address\":\"Jubilee Hills\",\"pincode\":\"500033\",\"courier\":\"bluedart_apex\"}"
```

### Create order

```bash
curl.exe -b cookies.txt -X POST http://localhost:4000/api/v1/orders ^
  -H "Content-Type: application/json" ^
  -d "{\"customerName\":\"Priya Nambiar\",\"customerPhone\":\"9845012345\",\"address\":\"Jubilee Hills\",\"pincode\":\"500033\",\"courier\":\"bluedart_apex\"}"
```

### Get order

```bash
curl.exe http://localhost:4000/api/v1/orders/<order-uuid>
```

---

## Payments (Razorpay test)

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `server/.env`.

### Create Razorpay order

```bash
curl.exe -X POST http://localhost:4000/api/v1/payments/razorpay/create ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"<order-uuid>\"}"
```

Returns `keyId`, `razorpayOrderId`, `amount` (paise). Open Razorpay Checkout.js on the storefront with these values.

### Verify payment (after Checkout handler)

```bash
curl.exe -X POST http://localhost:4000/api/v1/payments/razorpay/verify ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"<order-uuid>\",\"razorpay_order_id\":\"order_xxx\",\"razorpay_payment_id\":\"pay_xxx\",\"razorpay_signature\":\"...\"}"
```

### Cash on delivery

```bash
curl.exe -X POST http://localhost:4000/api/v1/payments/cod ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"<order-uuid>\"}"
```

---

## Tracking

Demo AWB from seed: `BLUEDART-88219034IN`

```bash
curl.exe http://localhost:4000/api/v1/tracking/BLUEDART-88219034IN
```

---

## Live activity

```bash
curl.exe http://localhost:4000/api/v1/activity/live
```

### Record product view

```bash
curl.exe -X POST http://localhost:4000/api/v1/activity/product-view ^
  -H "Content-Type: application/json" ^
  -d "{\"productId\":1}"
```

---

## Postman

Import `docs/postman_collection.json` and set collection variable `baseUrl` = `http://localhost:4000/api/v1`.

---

## Authentication (session cookie `vgm_session`)

Login/register responses set an HTTP-only cookie. Use `-c` / `-b` with curl or `credentials: 'include'` in fetch.

### Register (CUSTOMER only)

```bash
curl.exe -c cookies.txt -X POST http://localhost:4000/api/v1/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"mobile\":\"9876543210\",\"password\":\"secret12\",\"name\":\"Test User\"}"
```

### Login (password)

```bash
curl.exe -c cookies.txt -b cookies.txt -X POST http://localhost:4000/api/v1/auth/login/password ^
  -H "Content-Type: application/json" ^
  -d "{\"mobile\":\"9888888888\",\"password\":\"customer123\"}"
```

### OTP (dev: set OTP_DEV_MODE=true, OTP_DEV_CODE=123456)

```bash
curl.exe -X POST http://localhost:4000/api/v1/auth/otp/request -H "Content-Type: application/json" -d "{\"mobile\":\"9876543210\"}"
curl.exe -c cookies.txt -X POST http://localhost:4000/api/v1/auth/otp/verify ^
  -H "Content-Type: application/json" ^
  -d "{\"mobile\":\"9876543210\",\"otp\":\"123456\",\"name\":\"OTP User\"}"
```

### Current user

```bash
curl.exe -b cookies.txt http://localhost:4000/api/v1/auth/me
```

### Logout

```bash
curl.exe -b cookies.txt -X POST http://localhost:4000/api/v1/auth/logout
```

**Seeded admin:** mobile `9999999999`, password `admin123`.

---

## My account (`/me/*`, requires login)

### Addresses

```bash
curl.exe -b cookies.txt http://localhost:4000/api/v1/me/addresses
curl.exe -b cookies.txt -X POST http://localhost:4000/api/v1/me/addresses ^
  -H "Content-Type: application/json" ^
  -d "{\"label\":\"Home\",\"recipientName\":\"Priya\",\"phone\":\"9888888888\",\"line1\":\"Flat 1\",\"city\":\"Hyderabad\",\"state\":\"Telangana\",\"pincode\":\"500001\",\"isDefault\":true}"
curl.exe -b cookies.txt -X PATCH http://localhost:4000/api/v1/me/addresses/<address-id> ^
  -H "Content-Type: application/json" ^
  -d "{\"line1\":\"Updated line\"}"
curl.exe -b cookies.txt -X DELETE http://localhost:4000/api/v1/me/addresses/<address-id>
```

### Order history

```bash
curl.exe -b cookies.txt http://localhost:4000/api/v1/me/orders
```

### Checkout & payments (require login)

Pass session cookie on `checkout/validate`, `POST /orders`, and `/payments/*`. Body may use `addressId` instead of inline address fields.

---

## Admin (`/admin/*`, requires ADMIN session)

### Products

```bash
curl.exe -b admin-cookies.txt http://localhost:4000/api/v1/admin/products
curl.exe -b admin-cookies.txt -X POST http://localhost:4000/api/v1/admin/products ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"New Ring\",\"slug\":\"new-ring\",\"category\":\"Ring\",\"price\":299900,\"originalPrice\":349900,\"stock\":5,\"isActive\":true}"
curl.exe -b admin-cookies.txt -X PATCH http://localhost:4000/api/v1/admin/products/1 ^
  -H "Content-Type: application/json" ^
  -d "{\"stock\":10}"
curl.exe -b admin-cookies.txt -X DELETE http://localhost:4000/api/v1/admin/products/1
```

(`DELETE` sets `isActive: false`.)

### Orders & shipments

```bash
curl.exe -b admin-cookies.txt http://localhost:4000/api/v1/admin/orders
curl.exe -b admin-cookies.txt http://localhost:4000/api/v1/admin/orders/<order-uuid>
curl.exe -b admin-cookies.txt -X PATCH http://localhost:4000/api/v1/admin/orders/<order-uuid> ^
  -H "Content-Type: application/json" ^
  -d "{\"status\":\"SHIPPED\"}"
curl.exe -b admin-cookies.txt -X PATCH http://localhost:4000/api/v1/admin/shipments/<shipment-uuid> ^
  -H "Content-Type: application/json" ^
  -d "{\"awb\":\"BLUEDART-99999999IN\",\"carrier\":\"BlueDart\",\"orderStatus\":\"SHIPPED\",\"event\":{\"title\":\"Out for delivery\",\"description\":\"Admin update\"}}"
```
