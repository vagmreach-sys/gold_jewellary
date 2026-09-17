window.API_BASE = window.API_BASE || "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${window.API_BASE}/api/v1${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const json = await res.json();
  if (!json.success) {
    const err = json.error;
    const msg = typeof err === "object" ? err.message || err.code : err;
    const e = new Error(msg || "Request failed");
    if (typeof err === "object" && err.code) e.code = err.code;
    throw e;
  }
  return json.data;
}

window.VagmreachAPI = {
  getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct(id) {
    return apiFetch(`/products/${id}`);
  },
  getCart() {
    return apiFetch("/cart");
  },
  addToCart(productId, quantity = 1) {
    return apiFetch("/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    });
  },
  removeFromCart(productId) {
    return apiFetch(`/cart/items/${productId}`, { method: "DELETE" });
  },
  getShippingPincode(pin) {
    return apiFetch(`/shipping/pincode/${pin}`);
  },
  getShippingRates(pincode) {
    return apiFetch(`/shipping/rates?pincode=${encodeURIComponent(pincode)}`);
  },
  validateCheckout(payload) {
    return apiFetch("/checkout/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createOrder(payload) {
    return apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createRazorpayPayment(orderId) {
    return apiFetch("/payments/razorpay/create", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
  },
  verifyRazorpayPayment(payload) {
    return apiFetch("/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  confirmCod(orderId) {
    return apiFetch("/payments/cod", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
  },
  getTracking(id) {
    return apiFetch(`/tracking/${encodeURIComponent(id)}`);
  },
  getLiveActivity() {
    return apiFetch("/activity/live");
  },
  recordProductView(productId) {
    return apiFetch("/activity/product-view", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }).catch(() => null);
  },
  getReservation() {
    return apiFetch("/cart/reservation");
  },
  getMe() {
    return apiFetch("/auth/me");
  },
  loginPassword(mobile, password) {
    return apiFetch("/auth/login/password", {
      method: "POST",
      body: JSON.stringify({ mobile, password }),
    });
  },
  register(mobile, password, name) {
    const body = { mobile, password };
    if (name) body.name = name;
    return apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  requestOtp(mobile) {
    return apiFetch("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    });
  },
  verifyOtp(mobile, otp, name) {
    const body = { mobile, otp };
    if (name) body.name = name;
    return apiFetch("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  logout() {
    return apiFetch("/auth/logout", { method: "POST" });
  },
  acceptProductTerms() {
    return apiFetch("/auth/accept-product-terms", {
      method: "POST",
      body: JSON.stringify({ agreed: true }),
    });
  },
  getAddresses() {
    return apiFetch("/me/addresses");
  },
  createAddress(payload) {
    return apiFetch("/me/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAddress(id, payload) {
    return apiFetch(`/me/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteAddress(id) {
    return apiFetch(`/me/addresses/${id}`, { method: "DELETE" });
  },
  getMyOrders() {
    return apiFetch("/me/orders");
  },
  adminListProducts() {
    return apiFetch("/admin/products");
  },
  adminGetProduct(id) {
    return apiFetch(`/admin/products/${id}`);
  },
  adminCreateProduct(payload) {
    return apiFetch("/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  adminUpdateProduct(id, payload) {
    return apiFetch(`/admin/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  adminDeleteProduct(id) {
    return apiFetch(`/admin/products/${id}`, { method: "DELETE" });
  },
  async adminUploadProductMedia(productId, formData) {
    const res = await fetch(`${window.API_BASE}/api/v1/admin/products/${productId}/media`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        res.ok
          ? "Invalid server response"
          : "Upload failed on server. Use photos under 5MB each and one video under 50MB (MP4/WebM).",
      );
    }
    if (!json.success) {
      const err = json.error;
      const msg = typeof err === "object" ? err.message || err.code : err;
      throw new Error(msg || "Upload failed");
    }
    return json.data;
  },
  adminDeleteProductMedia(productId, mediaId) {
    return apiFetch(`/admin/products/${productId}/media/${mediaId}`, { method: "DELETE" });
  },
  adminListOrders() {
    return apiFetch("/admin/orders");
  },
  adminGetOrder(id) {
    return apiFetch(`/admin/orders/${id}`);
  },
  adminUpdateOrder(id, payload) {
    return apiFetch(`/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  adminUpdateShipment(id, payload) {
    return apiFetch(`/admin/shipments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};
