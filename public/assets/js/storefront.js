let PRODUCTS = [];
let cart = [];
let cartTotals = { subtotal: 0, gst: 0, grandTotal: 0 };
let currentFilter = "all";
let reservationInterval = null;
let currentOrderId = null;
let selectedCourier = "bluedart_apex";
let selectedPaymentMethod = "upi";
let currentUser = null;
let selectedAddressId = null;
let pendingCheckoutAfterAuth = false;
let pendingCheckoutStepAfterAuth = null;
/** @type {null | "loginSubmit" | "persistOnly"} */
let productTermsPendingAction = null;

function vgmSyncModalScrollLock() {
  const anyOpen = [
    "auth-modal",
    "checkout-modal",
    "tracking-modal",
    "product-detail-modal",
    "account-modal",
    "product-terms-modal",
  ].some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
  const drawerOpen = !document.getElementById("cart-drawer")?.classList.contains("translate-x-full");
  if (anyOpen || drawerOpen) {
    if (!document.body.classList.contains("vgm-modal-open")) {
      document.body.classList.add("vgm-modal-open");
    }
  } else {
    document.body.classList.remove("vgm-modal-open");
  }
}

function parseCityState(val) {
  const parts = String(val || "").split(",").map((s) => s.trim());
  return { city: parts[0] || val || "", state: parts[1] || "India" };
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden");
  document.getElementById("auth-error").classList.add("hidden");
  pendingCheckoutAfterAuth = false;
  pendingCheckoutStepAfterAuth = null;
  vgmSyncModalScrollLock();
}

function toggleMobileNav(open) {
  const panel = document.getElementById("mobile-nav-panel");
  const btn = document.getElementById("mobile-nav-toggle");
  if (!panel || !btn) return;
  const shouldOpen = open === undefined ? panel.classList.contains("hidden") : Boolean(open);
  panel.classList.toggle("hidden", !shouldOpen);
  btn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  btn.setAttribute("aria-label", shouldOpen ? "Close menu" : "Open menu");
}

function closeMobileNav() {
  toggleMobileNav(false);
}

window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;

let authCustomerMode = "login";

function getAuthMethod() {
  const picked = document.querySelector('input[name="auth-method"]:checked');
  return picked?.value === "otp" ? "otp" : "password";
}

function syncAuthMethodUI() {
  const method = getAuthMethod();
  const isOtp = method === "otp";
  document.getElementById("auth-field-password")?.classList.toggle("hidden", isOtp);
  document.getElementById("auth-field-otp")?.classList.toggle("hidden", !isOtp);
  const submitBtn = document.getElementById("auth-submit-btn");
  if (submitBtn) {
    submitBtn.textContent = authCustomerMode === "register" ? "Create account" : "Login";
  }
  const loginTab = document.getElementById("auth-customer-tab-login");
  const registerTab = document.getElementById("auth-customer-tab-register");
  if (loginTab && registerTab) {
    const active = authCustomerMode === "login";
    loginTab.classList.toggle("bg-gold-500", active);
    loginTab.classList.toggle("text-black", active);
    loginTab.classList.toggle("font-semibold", active);
    loginTab.classList.toggle("bg-cream-200", !active);
    loginTab.classList.toggle("text-stone-600", !active);
    registerTab.classList.toggle("bg-gold-500", !active);
    registerTab.classList.toggle("text-black", !active);
    registerTab.classList.toggle("font-semibold", !active);
    registerTab.classList.toggle("bg-cream-200", active);
    registerTab.classList.toggle("text-stone-600", active);
  }
}

function setAuthCustomerMode(mode) {
  authCustomerMode = mode === "register" ? "register" : "login";
  const title = document.getElementById("auth-modal-title");
  if (title) {
    title.textContent =
      authCustomerMode === "register"
        ? "Customer registration"
        : pendingCheckoutAfterAuth
          ? "Sign in to complete purchase"
          : "Customer login";
  }
  syncAuthMethodUI();
}

function openLoginModal(forCheckout = false) {
  pendingCheckoutAfterAuth = forCheckout;
  const title = document.getElementById("auth-modal-title");
  const subtitle = document.getElementById("auth-modal-subtitle");
  if (title) {
    title.textContent = forCheckout ? "Sign in to complete purchase" : "Customer login";
  }
  if (subtitle) {
    subtitle.textContent =
      authCustomerMode === "register"
        ? "Register with mobile + password (Option 1) or mobile + OTP (Option 2). Only these fields are required."
        : forCheckout
          ? "Sign in to continue to payment. You can browse and enter shipping details as a guest until this step."
          : "Choose Option 1 (mobile + password) or Option 2 (mobile + OTP). Browse without an account.";
  }
  authCustomerMode = "login";
  document.getElementById("auth-error")?.classList.add("hidden");
  const passwordRadio = document.querySelector('input[name="auth-method"][value="password"]');
  if (passwordRadio instanceof HTMLInputElement) passwordRadio.checked = true;
  syncAuthMethodUI();
  document.getElementById("auth-modal").classList.remove("hidden");
  vgmSyncModalScrollLock();
}

function getStorefrontDisplayName(user) {
  if (!user) return "";
  if (user.role === "CUSTOMER" && user.name) {
    const n = user.name.replace(/^VAGMREACH\s+/i, "").trim();
    return n || user.name;
  }
  const mobile = String(user.mobile || "").replace(/\D/g, "");
  if (mobile.length >= 4) return `···${mobile.slice(-4)}`;
  return "Member";
}

function setDesktopAuthBar(showUser) {
  const userBar = document.getElementById("header-auth-user");
  if (!userBar) return;
  if (showUser) {
    userBar.classList.remove("hidden");
    userBar.classList.add("md:flex");
  } else {
    userBar.classList.add("hidden");
    userBar.classList.remove("md:flex");
  }
}

function updateAuthNavUI() {
  const userBarMobile = document.getElementById("header-auth-user-mobile");
  const label = document.getElementById("header-user-label");
  const labelMobile = document.getElementById("header-user-label-mobile");
  const who = currentUser ? getStorefrontDisplayName(currentUser) : "";
  const hiText = currentUser ? `Hi, ${who}` : "";
  if (currentUser) {
    setDesktopAuthBar(true);
    userBarMobile?.classList.remove("hidden");
    userBarMobile?.classList.add("flex");
    document.querySelector(".mobile-nav-auth")?.classList.remove("hidden");
    if (label) {
      label.textContent = hiText;
      if (currentUser.role === "ADMIN") {
        label.title =
          "You are signed in on the shop (staff account). Use a customer login for normal shopping, or open /admin/ for catalog tools.";
      } else {
        label.title = "Signed in";
      }
    }
    if (labelMobile) {
      labelMobile.textContent = hiText;
      labelMobile.title = label?.title || "Signed in";
    }
  } else {
    setDesktopAuthBar(false);
    userBarMobile?.classList.add("hidden");
    userBarMobile?.classList.remove("flex");
    document.querySelector(".mobile-nav-auth")?.classList.add("hidden");
  }
}

async function customerLogout() {
  try {
    await VagmreachAPI.logout();
  } catch {
    /* ignore */
  }
  currentUser = null;
  updateAuthNavUI();
  closeAccountModal();
}

function showAuthError(msg, kind = "error") {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden", "text-red-600", "text-emerald-700");
  el.classList.add(kind === "info" ? "text-emerald-700" : "text-red-600");
}

async function resumePendingCheckoutAfterAuth() {
  if (!pendingCheckoutAfterAuth) return;
  pendingCheckoutAfterAuth = false;
  const resumeStep = pendingCheckoutStepAfterAuth ?? 1;
  pendingCheckoutStepAfterAuth = null;
  const checkoutOpen = !document.getElementById("checkout-modal")?.classList.contains("hidden");
  if (!checkoutOpen) {
    await openCheckoutModal(true);
  } else {
    await applyCheckoutUserDefaults();
  }
  if (resumeStep === 3) {
    goToCheckoutStep(3);
  } else if (resumeStep !== 1) {
    goToCheckoutStep(resumeStep);
  }
}

function shouldShowProductTermsModal(user) {
  return user && user.role === "CUSTOMER" && !user.productTermsAccepted;
}

function openProductTermsModal(pendingAction = "persistOnly") {
  productTermsPendingAction = pendingAction;
  const radio = document.getElementById("product-terms-agree-radio");
  const confirmBtn = document.getElementById("product-terms-confirm");
  const errEl = document.getElementById("product-terms-error");
  if (radio) radio.checked = false;
  if (confirmBtn) confirmBtn.disabled = true;
  if (errEl) {
    errEl.textContent = "";
    errEl.classList.add("hidden");
  }
  document.getElementById("product-terms-modal")?.classList.remove("hidden");
  vgmSyncModalScrollLock();
}

function closeProductTermsModal() {
  document.getElementById("product-terms-modal")?.classList.add("hidden");
  productTermsPendingAction = null;
  vgmSyncModalScrollLock();
}

function onProductTermsAgreeChange() {
  const radio = document.getElementById("product-terms-agree-radio");
  const confirmBtn = document.getElementById("product-terms-confirm");
  if (confirmBtn && radio) confirmBtn.disabled = !radio.checked;
}

async function confirmProductTermsAgreement() {
  const radio = document.getElementById("product-terms-agree-radio");
  const errEl = document.getElementById("product-terms-error");
  if (!radio?.checked) {
    if (errEl) {
      errEl.textContent = "Please select I agree to continue.";
      errEl.classList.remove("hidden");
    }
    return;
  }
  const confirmBtn = document.getElementById("product-terms-confirm");
  if (confirmBtn) confirmBtn.disabled = true;
  const action = productTermsPendingAction || "persistOnly";
  try {
    if (action === "loginSubmit") {
      closeProductTermsModal();
      await executeAuthSubmit();
      return;
    }
    const res = await VagmreachAPI.acceptProductTerms();
    currentUser = res.user;
    closeProductTermsModal();
    await resumePendingCheckoutAfterAuth();
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message || "Could not continue. Please try again.";
      errEl.classList.remove("hidden");
    }
    if (confirmBtn) confirmBtn.disabled = !!radio.checked;
  }
}

function maybeShowProductTermsModal(user) {
  if (!shouldShowProductTermsModal(user)) return false;
  openProductTermsModal("persistOnly");
  return true;
}

async function persistProductTermsAfterLogin() {
  if (!currentUser || currentUser.role !== "CUSTOMER" || currentUser.productTermsAccepted) return;
  try {
    const res = await VagmreachAPI.acceptProductTerms();
    currentUser = res.user;
  } catch {
    openProductTermsModal("persistOnly");
  }
}

async function afterAuthSuccess() {
  closeAuthModal();
  try {
    const me = await VagmreachAPI.getMe();
    currentUser = me.user;
  } catch {
    currentUser = null;
  }
  await persistProductTermsAfterLogin();
  updateAuthNavUI();
  if (maybeShowProductTermsModal(currentUser)) return;
  await resumePendingCheckoutAfterAuth();
}

function readAuthMobile() {
  return document.getElementById("auth-mobile")?.value?.trim() || "";
}

async function sendAuthOtp() {
  try {
    const mobile = readAuthMobile();
    if (!mobile) {
      showAuthError("Enter your mobile number first.");
      return;
    }
    const res = await VagmreachAPI.requestOtp(mobile);
    if (res.devOtp) showAuthError(`OTP sent. Dev code: ${res.devOtp}`, "info");
    else showAuthError("OTP sent to your mobile.", "info");
  } catch (e) {
    showAuthError(e.message);
  }
}

async function executeAuthSubmit() {
  const mobile = readAuthMobile();
  const method = getAuthMethod();
  try {
    if (method === "password") {
      const password = document.getElementById("auth-password")?.value || "";
      if (authCustomerMode === "register") {
        await VagmreachAPI.register(mobile, password);
      } else {
        await VagmreachAPI.loginPassword(mobile, password);
      }
    } else {
      const otp = document.getElementById("auth-otp-code")?.value?.trim() || "";
      await VagmreachAPI.verifyOtp(mobile, otp);
    }
    await syncCartFromApi();
    await afterAuthSuccess();
  } catch (e) {
    showAuthError(e.message);
  }
}

async function submitAuthForm() {
  const mobile = readAuthMobile();
  const method = getAuthMethod();
  if (!mobile) {
    showAuthError("Mobile number is required.");
    return;
  }

  if (method === "password") {
    const password = document.getElementById("auth-password")?.value || "";
    if (!password) {
      showAuthError("Password is required.");
      return;
    }
  } else {
    const otp = document.getElementById("auth-otp-code")?.value?.trim() || "";
    if (!otp) {
      showAuthError("Enter the OTP sent to your mobile.");
      return;
    }
  }

  if (authCustomerMode === "login" && !currentUser?.productTermsAccepted) {
    openProductTermsModal("loginSubmit");
    return;
  }

  await executeAuthSubmit();
}

document.querySelectorAll('input[name="auth-method"]').forEach((el) => {
  el.addEventListener("change", () => {
    document.getElementById("auth-error")?.classList.add("hidden");
    syncAuthMethodUI();
  });
});
document.getElementById("auth-customer-tab-login")?.addEventListener("click", () => {
  setAuthCustomerMode("login");
  const subtitle = document.getElementById("auth-modal-subtitle");
  if (subtitle) {
    subtitle.textContent = pendingCheckoutAfterAuth
      ? "Sign in to continue to payment. You can browse and enter shipping details as a guest until this step."
      : "Choose Option 1 (mobile + password) or Option 2 (mobile + OTP). Browse without an account.";
  }
  document.getElementById("auth-error")?.classList.add("hidden");
});
document.getElementById("auth-customer-tab-register")?.addEventListener("click", () => {
  setAuthCustomerMode("register");
  const subtitle = document.getElementById("auth-modal-subtitle");
  if (subtitle) {
    subtitle.textContent =
      "Register with mobile + password (Option 1) or mobile + OTP (Option 2). Only these fields are required.";
  }
  document.getElementById("auth-error")?.classList.add("hidden");
});

async function loadCheckoutAddresses() {
  const box = document.getElementById("saved-addresses");
  if (!box) return;
  try {
    const list = await VagmreachAPI.getAddresses();
    if (!list.length) {
      box.innerHTML = "";
      selectedAddressId = null;
      return;
    }
    box.innerHTML =
      "<p class=\"font-semibold text-stone-700\">Saved addresses</p>" +
      list
        .map(
          (a) =>
            `<label class="flex gap-2 p-2 border rounded-lg cursor-pointer"><input type="radio" name="saved-address" value="${a.id}" ${a.isDefault ? "checked" : ""} onchange="selectSavedAddress('${a.id}')" /> ${a.recipientName}, ${a.line1}, ${a.pincode}</label>`,
        )
        .join("");
    const def = list.find((a) => a.isDefault) || list[0];
    if (def) selectSavedAddress(def.id);
  } catch {
    box.innerHTML = "";
  }
}

function selectSavedAddress(id) {
  selectedAddressId = id;
}

async function maybeSaveAddressFromForm() {
  if (!currentUser) return;
  if (!document.getElementById("save-address-check")?.checked) return;
  const { city, state } = parseCityState(document.getElementById("cust-city").value);
  try {
    await VagmreachAPI.createAddress({
      label: "Checkout",
      recipientName: document.getElementById("cust-name").value.trim(),
      phone: document.getElementById("cust-phone").value.trim(),
      line1: document.getElementById("cust-address").value.trim(),
      city,
      state,
      pincode: document.getElementById("cust-pincode").value.trim(),
      isDefault: true,
    });
  } catch {
    /* non-blocking */
  }
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const filtered =
    currentFilter === "all"
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === currentFilter);

  grid.innerHTML = filtered
    .map((item) => VagmreachProductRenderer.renderStorefrontCard(item))
    .join("");
}

function toggleProductDetailModal(show) {
  const modal = document.getElementById("product-detail-modal");
  if (show) modal.classList.remove("hidden");
  else modal.classList.add("hidden");
  vgmSyncModalScrollLock();
}

async function openProductDetail(productId) {
  try {
    let product = PRODUCTS.find((p) => p.id === productId);
    if (!product?.media?.length) {
      product = await VagmreachAPI.getProduct(productId);
      const idx = PRODUCTS.findIndex((p) => p.id === productId);
      if (idx >= 0) PRODUCTS[idx] = { ...PRODUCTS[idx], ...product };
    }
    const body = document.getElementById("product-detail-body");
    body.innerHTML = VagmreachProductRenderer.renderProductDetailView(product);
    VagmreachProductRenderer.initGallery(body);
    toggleProductDetailModal(true);
    VagmreachAPI.recordProductView(productId);
  } catch (e) {
    alert(e.message || "Could not load product");
  }
}

window.toggleProductDetailModal = toggleProductDetailModal;
window.openProductDetail = openProductDetail;
window.openLoginModal = openLoginModal;
window.continueToPayment = continueToPayment;
window.submitAuthForm = submitAuthForm;
window.sendAuthOtp = sendAuthOtp;
window.confirmProductTermsAgreement = confirmProductTermsAgreement;
window.onProductTermsAgreeChange = onProductTermsAgreeChange;
window.customerLogout = customerLogout;

async function refreshCatalogFromApi() {
  try {
    PRODUCTS = await VagmreachAPI.getProducts();
    renderProducts();
  } catch {
    /* ignore background refresh errors */
  }
}

function filterProducts(category) {
  currentFilter = category;
  const target = event?.target instanceof Element ? event.target : null;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active", "bg-gold-500", "text-black");
    btn.classList.add("bg-royal-800/70", "text-gold-500", "border", "border-gold-500/25");
  });
  if (target) {
    target.classList.add("active", "bg-gold-500", "text-black");
    target.classList.remove("bg-royal-800/70", "text-gold-500", "border", "border-gold-500/25");
  }
  renderProducts();
}

async function syncCartFromApi() {
  const data = await VagmreachAPI.getCart();
  cart = data.items || [];
  cartTotals = data.totals || { subtotal: 0, gst: 0, grandTotal: 0 };
  updateCartUI();
  if (data.reservation?.remainingSeconds) {
    startReservationPolling();
  }
}

async function addToCart(productId) {
  try {
    await VagmreachAPI.addToCart(productId, 1);
    await syncCartFromApi();
    toggleCartDrawer(true);
  } catch (e) {
    alert(e.message);
  }
}

async function quickBuyItem(productId) {
  await addToCart(productId);
  toggleCartDrawer(false);
  openCheckoutModal();
}

async function removeFromCart(productId) {
  await VagmreachAPI.removeFromCart(productId);
  await syncCartFromApi();
}

function updateCartUI() {
  const counter = document.getElementById("cart-counter");
  const itemsContainer = document.getElementById("cart-items-list");
  const subtotalEl = document.getElementById("cart-subtotal");
  const taxEl = document.getElementById("cart-tax");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-start-btn");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  counter.textContent = totalItems;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
          <div class="h-64 flex flex-col items-center justify-center text-center text-stone-500 space-y-3">
            <svg class="w-12 h-12 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            <p class="text-sm">Your Gold Vault is currently empty.</p>
            <a href="#collections" onclick="toggleCartDrawer(false)" class="text-xs text-gold-400 underline">Browse 1 Gram Gold Creations</a>
          </div>
        `;
    subtotalEl.textContent = "₹0";
    taxEl.textContent = "₹0";
    totalEl.textContent = "₹0";
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add("opacity-50", "cursor-not-allowed");
    return;
  }

  checkoutBtn.disabled = false;
  checkoutBtn.classList.remove("opacity-50", "cursor-not-allowed");

  subtotalEl.textContent = "₹" + cartTotals.subtotal.toLocaleString("en-IN");
  taxEl.textContent = "₹" + cartTotals.gst.toLocaleString("en-IN");
  totalEl.textContent = "₹" + cartTotals.grandTotal.toLocaleString("en-IN");

  itemsContainer.innerHTML = cart
    .map(
      (item) => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-cream-50 border border-cream-300 gap-3">
          <div class="w-12 h-12 rounded-lg bg-white flex items-center justify-center p-1 border border-cream-300 shrink-0 overflow-hidden">
            ${item.imageSvg}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-stone-900 truncate">${item.title}</h4>
            <div class="text-[11px] text-gold-400 font-mono">₹${item.price.toLocaleString("en-IN")} × ${item.quantity}</div>
          </div>
          <button onclick="removeFromCart(${item.productId})" class="text-stone-500 hover:text-red-400 p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      `,
    )
    .join("");
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-drawer-backdrop");
  if (open) {
    backdrop.classList.remove("hidden");
    drawer.classList.remove("translate-x-full");
  } else {
    backdrop.classList.add("hidden");
    drawer.classList.add("translate-x-full");
  }
  vgmSyncModalScrollLock();
}

function startReservationPolling() {
  if (reservationInterval) return;
  reservationInterval = setInterval(async () => {
    try {
      const r = await VagmreachAPI.getReservation();
      const timerEl = document.getElementById("reservation-timer");
      if (!r.active) {
        clearInterval(reservationInterval);
        reservationInterval = null;
        await syncCartFromApi();
        toggleCartDrawer(false);
        return;
      }
      const mins = Math.floor(r.remainingSeconds / 60);
      const secs = r.remainingSeconds % 60;
      if (timerEl) {
        timerEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
    } catch {
      /* ignore */
    }
  }, 1000);
}

async function calculateShippingRates() {
  const pin = document.getElementById("shipping-pincode").value.trim();
  if (!pin || pin.length < 6) return;

  try {
    const data = await VagmreachAPI.getShippingRates(pin);
    const resultsBox = document.getElementById("shipping-results");
    const courierContainer = document.getElementById("courier-cards-container");
    const displayPin = document.getElementById("res-pincode");
    const cityBadge = document.getElementById("pincode-city-badge");

    cityBadge.textContent = data.location.hub;
    cityBadge.classList.remove("hidden");
    displayPin.textContent = `${pin} (${data.cityState})`;

    courierContainer.innerHTML = data.couriers
      .map(
        (c, i) => `
        <div class="p-3.5 rounded-xl border ${i === 0 ? "border-gold-500/50" : "border-cream-300"} bg-white space-y-1">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-stone-900">${c.name}</span>
            <span class="text-emerald-400 font-bold">${c.priceLabel}</span>
          </div>
          <p class="text-[11px] text-stone-400">${c.eta}</p>
          <div class="text-[10px] ${i === 0 ? "text-gold-400" : "text-stone-500"} font-mono">Status: ${c.status}</div>
        </div>
      `,
      )
      .join("");

    resultsBox.classList.remove("hidden");
  } catch (e) {
    alert(e.message);
  }
}

async function autofillLocation(pincode) {
  if (pincode.length !== 6) return;
  try {
    const data = await VagmreachAPI.getShippingPincode(pincode);
    document.getElementById("cust-city").value = data.cityState;
    document.getElementById("step2-pincode-display").textContent = pincode;
  } catch {
    /* ignore */
  }
}

async function applyCheckoutUserDefaults() {
  syncCheckoutGuestUI();
  if (!currentUser) return;
  await loadCheckoutAddresses();
  if (currentUser.name) document.getElementById("cust-name").value = currentUser.name;
  if (currentUser.mobile) document.getElementById("cust-phone").value = currentUser.mobile;
}

function syncCheckoutGuestUI() {
  const saveRow = document.getElementById("save-address-row");
  if (saveRow) {
    saveRow.classList.toggle("hidden", !currentUser);
  }
  if (!currentUser) {
    const saveCheck = document.getElementById("save-address-check");
    if (saveCheck) saveCheck.checked = false;
  }
}

async function requireAuthForCheckoutPayment() {
  if (currentUser) {
    if (maybeShowProductTermsModal(currentUser)) {
      pendingCheckoutAfterAuth = true;
      pendingCheckoutStepAfterAuth = 3;
      return false;
    }
    return true;
  }
  try {
    const me = await VagmreachAPI.getMe();
    currentUser = me.user;
    updateAuthNavUI();
    await applyCheckoutUserDefaults();
    if (maybeShowProductTermsModal(currentUser)) {
      pendingCheckoutAfterAuth = true;
      pendingCheckoutStepAfterAuth = 3;
      return false;
    }
    return true;
  } catch {
    pendingCheckoutAfterAuth = true;
    pendingCheckoutStepAfterAuth = 3;
    openLoginModal(true);
    return false;
  }
}

async function continueToPayment() {
  const ok = await requireAuthForCheckoutPayment();
  if (!ok) return;
  goToCheckoutStep(3);
}

async function openCheckoutModal(skipAuthCheck = false) {
  if (cart.length === 0) return;
  if (!skipAuthCheck) {
    try {
      const me = await VagmreachAPI.getMe();
      currentUser = me.user;
      updateAuthNavUI();
    } catch {
      currentUser = null;
    }
  }
  toggleCartDrawer(false);
  await applyCheckoutUserDefaults();
  goToCheckoutStep(1);
  document.getElementById("step3-total-display").textContent =
    "₹" + cartTotals.grandTotal.toLocaleString("en-IN");
  document.getElementById("checkout-session-token").textContent =
    "VGM-" + Math.random().toString(36).substr(2, 6).toUpperCase();
  document.getElementById("checkout-modal").classList.remove("hidden");
  vgmSyncModalScrollLock();
}

function closeCheckoutModal() {
  document.getElementById("checkout-modal").classList.add("hidden");
  document.getElementById("checkout-processing").classList.add("hidden");
  document.getElementById("checkout-success").classList.add("hidden");
  document.getElementById("checkout-step-1").classList.remove("hidden");
  currentOrderId = null;
  vgmSyncModalScrollLock();
}

function goToCheckoutStep(step) {
  const s1 = document.getElementById("checkout-step-1");
  const s2 = document.getElementById("checkout-step-2");
  const s3 = document.getElementById("checkout-step-3");
  const t1 = document.getElementById("step-tab-1");
  const t2 = document.getElementById("step-tab-2");
  const t3 = document.getElementById("step-tab-3");

  [s1, s2, s3].forEach((el) => el.classList.add("hidden"));
  [t1, t2, t3].forEach((el) => {
    el.classList.remove("border-gold-500", "text-gold-400");
    el.classList.add("border-transparent", "text-stone-500");
  });

  if (step === 1) {
    s1.classList.remove("hidden");
    t1.classList.add("border-gold-500", "text-gold-400");
  } else if (step === 2) {
    s2.classList.remove("hidden");
    t2.classList.add("border-gold-500", "text-gold-400");
  } else if (step === 3) {
    s3.classList.remove("hidden");
    t3.classList.add("border-gold-500", "text-gold-400");
    ensureOrderCreated();
  }
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  const tabs = ["upi", "card", "netbanking", "cod"];
  tabs.forEach((m) => {
    document.getElementById(`method-${m}`).classList.add("hidden");
    const tabEl = document.getElementById(`tab-${m}`);
    tabEl.classList.remove("text-gold-400", "border-gold-500");
    tabEl.classList.add("text-stone-400", "border-transparent");
  });
  document.getElementById(`method-${method}`).classList.remove("hidden");
  const activeTab = document.getElementById(`tab-${method}`);
  activeTab.classList.add("text-gold-400", "border-gold-500");
  activeTab.classList.remove("text-stone-400", "border-transparent");
}

function verifyVpa() {
  const vpa = document.getElementById("vpa-input").value.trim();
  const statusEl = document.getElementById("vpa-status");
  if (vpa.includes("@")) statusEl.classList.remove("hidden");
}

function readSelectedCourier() {
  const checked = document.querySelector('input[name="courier-choice"]:checked');
  const label = checked?.value || "BlueDart Air";
  if (label.includes("Delhivery")) return "delhivery_surface";
  if (label.includes("Armored")) return "dtdc_insured";
  return "bluedart_apex";
}

function checkoutPayload() {
  selectedCourier = readSelectedCourier();
  const { city, state } = parseCityState(document.getElementById("cust-city").value);
  const base = {
    courier: selectedCourier,
    city,
    state,
  };
  if (selectedAddressId) {
    return { ...base, addressId: selectedAddressId };
  }
  return {
    ...base,
    customerName: document.getElementById("cust-name").value.trim(),
    customerPhone: document.getElementById("cust-phone").value.trim(),
    address: document.getElementById("cust-address").value.trim(),
    pincode: document.getElementById("cust-pincode").value.trim(),
  };
}

async function ensureOrderCreated() {
  if (currentOrderId) return currentOrderId;
  await maybeSaveAddressFromForm();
  const payload = checkoutPayload();
  await VagmreachAPI.validateCheckout(payload);
  const order = await VagmreachAPI.createOrder(payload);
  currentOrderId = order.orderId;
  if (order.checkoutSessionId) {
    document.getElementById("checkout-session-token").textContent = order.checkoutSessionId;
  }
  return currentOrderId;
}

async function executePayment() {
  const s3 = document.getElementById("checkout-step-3");
  const processing = document.getElementById("checkout-processing");
  const success = document.getElementById("checkout-success");

  try {
    const orderId = await ensureOrderCreated();

    if (selectedPaymentMethod === "cod") {
      s3.classList.add("hidden");
      processing.classList.remove("hidden");
      const result = await VagmreachAPI.confirmCod(orderId);
      processing.classList.add("hidden");
      success.classList.remove("hidden");
      document.getElementById("confirmed-order-id").textContent = result.orderNumber;
      await syncCartFromApi();
      return;
    }

    const pay = await VagmreachAPI.createRazorpayPayment(orderId);
    const options = {
      key: pay.keyId,
      amount: pay.amount,
      currency: pay.currency,
      name: "VAGMREACH",
      description: pay.orderNumber,
      order_id: pay.razorpayOrderId,
      handler: async function (response) {
        processing.classList.remove("hidden");
        s3.classList.add("hidden");
        try {
          const verified = await VagmreachAPI.verifyRazorpayPayment({
            orderId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          processing.classList.add("hidden");
          success.classList.remove("hidden");
          document.getElementById("confirmed-order-id").textContent = verified.orderNumber;
          await syncCartFromApi();
        } catch (err) {
          processing.classList.add("hidden");
          s3.classList.remove("hidden");
          alert(err.message);
        }
      },
      theme: { color: "#D4AF37" },
    };
    const rzp = new Razorpay(options);
    rzp.on("payment.failed", function () {
      alert("Payment failed. Please try again.");
    });
    rzp.open();
  } catch (e) {
    alert(e.message);
  }
}

function resetCart() {
  syncCartFromApi();
}

function toggleTrackingModal(open) {
  const modal = document.getElementById("tracking-modal");
  if (open) modal.classList.remove("hidden");
  else modal.classList.add("hidden");
  vgmSyncModalScrollLock();
}

async function simulateAwbQuery() {
  const input = document.getElementById("track-awb-input");
  const awb = input.value.trim();
  input.classList.add("border-gold-400");
  setTimeout(() => input.classList.remove("border-gold-400"), 800);
  try {
    const data = await VagmreachAPI.getTracking(awb);
    const modal = document.querySelector("#tracking-modal .space-y-4.pt-2");
    if (modal && data.timeline?.length) {
      modal.innerHTML = data.timeline
        .map((ev, i) => {
          const active = i === 0;
          return `
        <div class="relative pl-6 border-l-2 ${active ? "border-emerald-500" : "border-stone-700"} space-y-1">
          <div class="absolute -left-[7px] top-0 w-3 h-3 rounded-full ${active ? "bg-emerald-500" : "bg-stone-700"}"></div>
          <div class="text-xs font-bold ${active ? "text-stone-900" : "text-stone-500"}">${ev.title}</div>
          <div class="text-[11px] text-stone-400">${ev.description}</div>
          <div class="text-[10px] text-stone-500 font-mono">${new Date(ev.occurredAt).toLocaleString("en-IN")}</div>
        </div>`;
        })
        .join("");
    }
  } catch (e) {
    alert(e.message);
  }
}

async function refreshLiveShoppers() {
  try {
    const data = await VagmreachAPI.getLiveActivity();
    const el = document.getElementById("active-shoppers-count");
    if (el) el.textContent = data.activeShoppers;
  } catch {
    /* ignore */
  }
}

async function openAccountModal(tab) {
  try {
    await VagmreachAPI.getMe();
  } catch {
    pendingCheckoutAfterAuth = false;
    openLoginModal(false);
    return;
  }
  document.getElementById("account-modal").classList.remove("hidden");
  showAccountTab(tab || "orders");
  vgmSyncModalScrollLock();
}

function closeAccountModal() {
  document.getElementById("account-modal").classList.add("hidden");
  vgmSyncModalScrollLock();
}

function showAccountTab(tab) {
  document.getElementById("account-tab-orders").classList.toggle("hidden", tab !== "orders");
  document.getElementById("account-tab-addresses").classList.toggle("hidden", tab !== "addresses");
  if (tab === "orders") loadMyOrders();
  if (tab === "addresses") loadMyAddresses();
}

function escapeHtmlAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

function isOrderShipmentComplete(order) {
  const status = String(order?.status || "").toUpperCase();
  return status === "DELIVERED" || status === "COMPLETED";
}

function canShowOrderTrackButton(order) {
  const awb = order?.shipment?.awb;
  if (!awb) return false;
  if (isOrderShipmentComplete(order)) return false;
  const status = String(order?.status || "").toUpperCase();
  if (status === "CANCELLED") return false;
  return true;
}

function renderOrderTrackAction(order) {
  if (isOrderShipmentComplete(order)) {
    return `<span class="mt-2 inline-block text-[10px] font-semibold text-emerald-700">Shipment delivered</span>`;
  }
  if (!canShowOrderTrackButton(order)) return "";
  const awb = escapeHtmlAttr(order.shipment.awb);
  return `<button type="button" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-700 border border-gold-500/45 bg-gold-500/10 px-2.5 py-1 rounded-md hover:bg-gold-500/20" onclick="trackOrderShipment('${awb}')">Track shipment</button>`;
}

async function trackOrderShipment(awb) {
  const id = String(awb || "").trim();
  if (!id) return;
  closeAccountModal();
  const input = document.getElementById("track-awb-input");
  if (input) input.value = id;
  toggleTrackingModal(true);
  await simulateAwbQuery();
}

window.trackOrderShipment = trackOrderShipment;

async function loadMyOrders() {
  const el = document.getElementById("my-orders-list");
  try {
    const orders = await VagmreachAPI.getMyOrders();
    const list = Array.isArray(orders) ? orders : [];
    el.innerHTML = list.length
      ? list
          .map(
            (o) =>
              `<div class="border border-cream-300 rounded-lg p-3 text-xs"><strong>${escapeHtmlAttr(o.orderNumber)}</strong> — ${escapeHtmlAttr(o.status)} — ₹${Number(o.grandTotal).toLocaleString("en-IN")}<br/><span class="text-stone-500">${new Date(o.createdAt).toLocaleString()}</span>${renderOrderTrackAction(o)}</div>`,
          )
          .join("")
      : '<p class="text-stone-500 text-xs">No orders yet.</p>';
  } catch (e) {
    el.innerHTML = `<p class="text-red-600 text-xs">${escapeHtmlAttr(e.message)}</p>`;
  }
}

async function loadMyAddresses() {
  const el = document.getElementById("my-addresses-list");
  try {
    const list = await VagmreachAPI.getAddresses();
    el.innerHTML = list.length
      ? list
          .map(
            (a) => `
        <div class="border border-cream-300 rounded-lg p-3 text-xs flex justify-between gap-2">
          <div>${a.isDefault ? "<strong>Default</strong> — " : ""}${a.recipientName}, ${a.line1}, ${a.city} ${a.pincode}</div>
          <div class="flex gap-2 shrink-0">
            <button type="button" class="text-gold-600" onclick="editAddressPrompt('${a.id}')">Edit</button>
            <button type="button" class="text-red-600" onclick="deleteMyAddress('${a.id}')">Delete</button>
          </div>
        </div>`,
          )
          .join("")
      : '<p class="text-stone-500 text-xs">No saved addresses.</p>';
    el.innerHTML +=
      '<button type="button" onclick="addAddressPrompt()" class="mt-3 text-xs text-gold-600 font-semibold">+ Add address</button>';
  } catch (e) {
    el.innerHTML = `<p class="text-red-600 text-xs">${e.message}</p>`;
  }
}

async function deleteMyAddress(id) {
  if (!confirm("Delete this address?")) return;
  await VagmreachAPI.deleteAddress(id);
  await loadMyAddresses();
}

async function addAddressPrompt() {
  const recipientName = prompt("Recipient name");
  if (!recipientName) return;
  const line1 = prompt("Address line");
  const pincode = prompt("Pincode (6 digits)");
  const city = prompt("City");
  const state = prompt("State", "Telangana");
  const phone = prompt("Phone", currentUser?.mobile || "");
  await VagmreachAPI.createAddress({
    recipientName,
    line1,
    city,
    state,
    pincode,
    phone,
    isDefault: true,
  });
  await loadMyAddresses();
}

async function editAddressPrompt(id) {
  const list = await VagmreachAPI.getAddresses();
  const a = list.find((x) => x.id === id);
  if (!a) return;
  const line1 = prompt("Address line", a.line1);
  if (line1 === null) return;
  await VagmreachAPI.updateAddress(id, { line1 });
  await loadMyAddresses();
}

function initSiteHeaderScroll() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function initMobileNavResize() {
  const mq = window.matchMedia("(min-width: 768px)");
  const onChange = () => {
    if (mq.matches) closeMobileNav();
  };
  mq.addEventListener("change", onChange);
}

window.onload = async function () {
  initSiteHeaderScroll();
  initMobileNavResize();
  try {
    PRODUCTS = await VagmreachAPI.getProducts();
    PRODUCTS.forEach((p) => VagmreachAPI.recordProductView(p.id));
    renderProducts();
    await syncCartFromApi();
    refreshLiveShoppers();
    setInterval(refreshLiveShoppers, 4000);
    setInterval(refreshCatalogFromApi, 30000);
    try {
      const me = await VagmreachAPI.getMe();
      currentUser = me.user;
    } catch {
      currentUser = null;
    }
    updateAuthNavUI();
    maybeShowProductTermsModal(currentUser);
  } catch (e) {
    console.error(e);
    alert("Could not load catalog. Is the API server running on port 4000?");
  }
};
