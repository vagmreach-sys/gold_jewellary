let currentUser = null;
let editingProductId = null;
let selectedOrderId = null;
let currentProductMedia = [];

function showLogin(err) {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  const el = document.getElementById("login-error");
  if (err) {
    el.textContent = err;
    el.classList.remove("hidden");
  } else el.classList.add("hidden");
}

function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("header-login-btn")?.classList.add("hidden");
  document.getElementById("logout-btn")?.classList.remove("hidden");
}

async function completeAdminLogin(res) {
  if (res.user.role !== "ADMIN") {
    showLogin("This account is not an admin. Use staff credentials or log out from the customer site first.");
    return;
  }
  currentUser = res.user;
  showApp();
  updateMediaUploadState();
  refreshPreview();
  await loadProducts();
  await loadOrders();
  await loadAdminAds();
}

function draftFromForm() {
  const f = document.getElementById("product-form");
  const fd = new FormData(f);
  return {
    title: fd.get("title"),
    slug: fd.get("slug"),
    category: fd.get("category"),
    price: Number(fd.get("price")),
    originalPrice: Number(fd.get("originalPrice")),
    weight: fd.get("weight"),
    stock: Number(fd.get("stock")),
    rating: Number(fd.get("rating")),
    imageSvg: fd.get("imageSvg") || "<svg></svg>",
    isActive: fd.get("isActive") === "on",
    availableStock: Number(fd.get("stock")),
    viewersCount: 3,
    media: currentProductMedia,
  };
}

function refreshPreview() {
  const draft = draftFromForm();
  const product = {
    ...draft,
    id: editingProductId || 0,
    category: draft.category || "Category",
  };
  document.getElementById("product-preview").innerHTML = VagmreachProductRenderer.renderStorefrontCard(product, {
    preview: true,
  });
  document.getElementById("product-preview-gallery").innerHTML =
    VagmreachProductRenderer.renderMediaGalleryBlock(product, {
      galleryId: "admin-preview-gallery",
    });
  VagmreachProductRenderer.initGallery(document.getElementById("product-preview-gallery"));
}

function updateMediaUploadState() {
  const btn = document.getElementById("media-upload-btn");
  btn.disabled = !editingProductId;
  btn.title = editingProductId ? "" : "Save the product first to get an ID";
}

function renderMediaList() {
  const list = document.getElementById("media-list");
  if (!currentProductMedia.length) {
    list.innerHTML = '<p class="text-xs text-stone-500">No uploads yet.</p>';
    return;
  }
  list.innerHTML = currentProductMedia
    .map(
      (m) => `
    <div class="flex items-center gap-2 bg-white border border-cream-300 rounded-lg p-2 text-xs">
      ${
        m.type === "VIDEO"
          ? `<video src="${m.url}" class="w-14 h-14 object-cover rounded bg-black" muted></video>`
          : `<img src="${m.url}" alt="" class="w-14 h-14 object-cover rounded" />`
      }
      <span class="flex-1 text-stone-700">${m.type === "VIDEO" ? "Video" : "Photo"}${m.isPrimary ? " · primary" : ""}</span>
      ${
        editingProductId
          ? `<button type="button" class="text-red-700 hover:underline" data-delete-media="${m.id}">Remove</button>`
          : ""
      }
    </div>`,
    )
    .join("");

  list.querySelectorAll("[data-delete-media]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mediaId = btn.getAttribute("data-delete-media");
      if (!confirm("Remove this file?")) return;
      try {
        const updated = await VagmreachAPI.adminDeleteProductMedia(editingProductId, mediaId);
        currentProductMedia = updated.media || [];
        renderMediaList();
        refreshPreview();
        document.getElementById("media-msg").textContent = "Media removed.";
      } catch (err) {
        document.getElementById("media-msg").textContent = err.message;
      }
    });
  });
}

function resetProductForm() {
  editingProductId = null;
  currentProductMedia = [];
  document.getElementById("product-form").reset();
  document.querySelector('[name="isActive"]').checked = true;
  document.getElementById("product-form-title").textContent = "Product details";
  document.getElementById("product-submit-btn").textContent = "Save product";
  document.getElementById("product-cancel-edit").classList.add("hidden");
  document.getElementById("media-photos").value = "";
  document.getElementById("media-video").value = "";
  document.getElementById("media-msg").textContent = "";
  renderMediaList();
  updateMediaUploadState();
  refreshPreview();
}

function fillProductForm(p) {
  editingProductId = p.id;
  currentProductMedia = p.media || [];
  const f = document.getElementById("product-form");
  f.title.value = p.title;
  f.slug.value = p.slug;
  f.category.value = p.category;
  f.price.value = p.price;
  f.originalPrice.value = p.originalPrice;
  f.weight.value = p.weight;
  f.stock.value = p.stock;
  f.rating.value = p.rating;
  f.imageSvg.value = p.imageSvg || "";
  f.isActive.checked = p.isActive !== false;
  document.getElementById("product-form-title").textContent = `Edit product #${p.id}`;
  document.getElementById("product-submit-btn").textContent = "Update product";
  document.getElementById("product-cancel-edit").classList.remove("hidden");
  renderMediaList();
  updateMediaUploadState();
  refreshPreview();
}

async function init() {
  try {
    const me = await VagmreachAPI.getMe();
    if (me.user.role !== "ADMIN") {
      showLogin("Not an admin account. Use the Login form below with staff mobile/password.");
      return;
    }
    currentUser = me.user;
    showApp();
    updateMediaUploadState();
    await loadProducts();
    await loadOrders();
  } catch {
    showLogin();
  }
}

async function loadProducts() {
  const products = await VagmreachAPI.adminListProducts();
  const list = document.getElementById("product-list");
  list.innerHTML = products
    .map(
      (p) => `
      <div data-light-panel class="bg-cream-50/90 border border-gold-500/20 p-3 rounded-xl text-sm flex flex-wrap justify-between items-center gap-2 text-stone-800">
        <span>#${p.id} ${p.title} (stock ${p.stock}) ${(p.media || []).length ? `· ${(p.media || []).filter((m) => m.type === "PHOTO").length} photos` : ""} ${(p.media || []).some((m) => m.type === "VIDEO") ? "· video" : ""} ${p.isActive ? "" : "<span class='text-amber-800'>[inactive]</span>"}</span>
        <div class="flex gap-2">
          <button type="button" class="text-amber-800 font-medium" data-edit-product="${p.id}">Edit</button>
          <button type="button" class="text-red-700" data-delete-product="${p.id}">Deactivate</button>
        </div>
      </div>`,
    )
    .join("");

  list.querySelectorAll("[data-edit-product]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit-product");
      const p = await VagmreachAPI.adminGetProduct(id);
      fillProductForm(p);
    });
  });
  list.querySelectorAll("[data-delete-product]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-product");
      if (!confirm("Soft-delete (hide from storefront)?")) return;
      await VagmreachAPI.adminDeleteProduct(id);
      await loadProducts();
      if (String(editingProductId) === id) resetProductForm();
    });
  });
}

async function loadOrders() {
  const orders = await VagmreachAPI.adminListOrders();
  const list = document.getElementById("orders-list");
  list.innerHTML = orders
    .map(
      (o) => `
      <button type="button" data-order-id="${o.id}" class="w-full text-left bg-cream-50/90 border border-gold-500/20 p-3 rounded-xl text-sm hover:border-gold-400 text-stone-800 ${selectedOrderId === o.id ? "border-gold-500" : ""}">
        <strong>${o.orderNumber}</strong> ${o.status} — ${o.customerName} — ₹${o.grandTotal}
      </button>`,
    )
    .join("");

  list.querySelectorAll("[data-order-id]").forEach((btn) => {
    btn.addEventListener("click", () => showOrderDetail(btn.getAttribute("data-order-id")));
  });
}

async function showOrderDetail(orderId) {
  selectedOrderId = orderId;
  await loadOrders();
  const o = await VagmreachAPI.adminGetOrder(orderId);
  const panel = document.getElementById("order-detail-panel");
  const ship = o.shipment;
  panel.innerHTML = `
    <h3 class="font-semibold mb-2 text-stone-900">${o.orderNumber}</h3>
    <p class="text-xs text-stone-600 mb-2">${o.customerName} · ${o.customerPhone}<br/>${o.address}, ${o.city} ${o.pincode}</p>
    <p class="text-xs mb-3 text-stone-700">Status: <strong>${o.status}</strong> · Total ₹${o.grandTotal}</p>
    <label class="text-xs block mb-1 text-stone-700">Order status</label>
    <select id="order-status-select" class="border border-cream-300 rounded-lg p-2 text-sm w-full mb-3 bg-white">
      ${["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]
        .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
        .join("")}
    </select>
    <button type="button" id="save-order-status" class="bg-gold-500 text-royal-950 px-3 py-1 rounded-lg text-sm mb-4 font-medium">Save status</button>
    ${
      ship
        ? `<p class="text-xs font-medium text-stone-800">Shipment AWB: ${ship.awb} (${ship.carrier})</p>
    <input id="ship-awb" class="border border-cream-300 rounded-lg p-2 text-sm w-full mt-2 bg-white" placeholder="New AWB" value="${ship.awb}" />
    <input id="ship-carrier" class="border border-cream-300 rounded-lg p-2 text-sm w-full mt-2 bg-white" placeholder="Carrier" value="${ship.carrier}" />
    <input id="ship-event-title" class="border border-cream-300 rounded-lg p-2 text-sm w-full mt-2 bg-white" placeholder="Tracking event title" />
    <button type="button" id="save-shipment" class="mt-2 bg-stone-800 text-gold-300 px-3 py-1 rounded-lg text-sm">Update shipment</button>`
        : "<p class='text-xs text-stone-500'>No shipment yet (created after payment).</p>"
    }
  `;

  document.getElementById("save-order-status")?.addEventListener("click", async () => {
    const status = document.getElementById("order-status-select").value;
    await VagmreachAPI.adminUpdateOrder(orderId, { status });
    await showOrderDetail(orderId);
    await loadOrders();
  });

  document.getElementById("save-shipment")?.addEventListener("click", async () => {
    if (!ship) return;
    await VagmreachAPI.adminUpdateShipment(ship.id, {
      awb: document.getElementById("ship-awb").value,
      carrier: document.getElementById("ship-carrier").value,
      orderStatus: "SHIPPED",
      event: {
        title: document.getElementById("ship-event-title").value || "Status updated",
        description: "Updated by admin",
      },
    });
    await showOrderDetail(orderId);
    await loadOrders();
  });
}

document.getElementById("product-form").addEventListener("input", refreshPreview);
document.getElementById("product-form").addEventListener("change", refreshPreview);

document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = draftFromForm();
  try {
    if (editingProductId) {
      await VagmreachAPI.adminUpdateProduct(editingProductId, d);
      document.getElementById("product-msg").textContent = "Product updated.";
    } else {
      const created = await VagmreachAPI.adminCreateProduct(d);
      editingProductId = created.id;
      currentProductMedia = created.media || [];
      document.getElementById("product-form-title").textContent = `Edit product #${created.id}`;
      document.getElementById("product-submit-btn").textContent = "Update product";
      document.getElementById("product-cancel-edit").classList.remove("hidden");
      document.getElementById("product-msg").textContent = "Product created. You can upload photos and video now.";
    }
    updateMediaUploadState();
    renderMediaList();
    refreshPreview();
    await loadProducts();
  } catch (err) {
    document.getElementById("product-msg").textContent = err.message;
  }
});

document.getElementById("media-upload-btn")?.addEventListener("click", async () => {
  if (!editingProductId) return;
  const photoInput = document.getElementById("media-photos");
  const videoInput = document.getElementById("media-video");
  const formData = new FormData();
  for (const file of photoInput.files || []) {
    formData.append("photos", file);
  }
  if (videoInput.files?.[0]) {
    formData.append("video", videoInput.files[0]);
  }
  const maxPhoto = 5 * 1024 * 1024;
  const maxVideo = 50 * 1024 * 1024;
  for (const file of photoInput.files || []) {
    if (file.size > maxPhoto) {
      document.getElementById("media-msg").textContent = `"${file.name}" is too large. Each photo must be under 5MB.`;
      return;
    }
  }
  if (videoInput.files?.[0] && videoInput.files[0].size > maxVideo) {
    document.getElementById("media-msg").textContent = "Video must be under 50MB.";
    return;
  }
  if (!photoInput.files?.length && !videoInput.files?.[0]) {
    document.getElementById("media-msg").textContent = "Choose photos and/or a video file.";
    return;
  }
  try {
    const updated = await VagmreachAPI.adminUploadProductMedia(editingProductId, formData);
    currentProductMedia = updated.media || [];
    photoInput.value = "";
    videoInput.value = "";
    document.getElementById("media-msg").textContent = "Upload complete.";
    renderMediaList();
    refreshPreview();
    await loadProducts();
  } catch (err) {
    document.getElementById("media-msg").textContent = err.message;
  }
});

document.getElementById("product-cancel-edit")?.addEventListener("click", resetProductForm);

document.getElementById("login-btn").addEventListener("click", async () => {
  try {
    const mobile = document.getElementById("login-mobile").value;
    const password = document.getElementById("login-password").value;
    const res = await VagmreachAPI.loginPassword(mobile, password);
    await completeAdminLogin(res);
  } catch (err) {
    showLogin(err.message);
  }
});

document.getElementById("admin-auth-tab-password")?.addEventListener("click", () => {
  document.getElementById("admin-auth-password")?.classList.remove("hidden");
  document.getElementById("admin-auth-otp")?.classList.add("hidden");
  document.getElementById("admin-auth-tab-password")?.classList.add("bg-gold-500", "text-royal-950", "font-semibold");
  document.getElementById("admin-auth-tab-otp")?.classList.remove("bg-gold-500", "text-royal-950", "font-semibold");
});

document.getElementById("admin-auth-tab-otp")?.addEventListener("click", () => {
  document.getElementById("admin-auth-otp")?.classList.remove("hidden");
  document.getElementById("admin-auth-password")?.classList.add("hidden");
  document.getElementById("admin-auth-tab-otp")?.classList.add("bg-gold-500", "text-royal-950", "font-semibold");
  document.getElementById("admin-auth-tab-password")?.classList.remove("bg-gold-500", "text-royal-950", "font-semibold");
});

document.getElementById("admin-otp-request")?.addEventListener("click", async () => {
  try {
    const mobile = document.getElementById("admin-otp-mobile").value;
    const res = await VagmreachAPI.requestOtp(mobile);
    const el = document.getElementById("login-error");
    el.textContent = res.devOtp ? `Dev OTP: ${res.devOtp}` : "OTP sent";
    el.classList.remove("hidden");
  } catch (err) {
    showLogin(err.message);
  }
});

document.getElementById("admin-otp-verify")?.addEventListener("click", async () => {
  try {
    const mobile = document.getElementById("admin-otp-mobile").value;
    const otp = document.getElementById("admin-otp-code").value;
    const res = await VagmreachAPI.verifyOtp(mobile, otp);
    await completeAdminLogin(res);
  } catch (err) {
    showLogin(err.message);
  }
});

document.getElementById("header-login-btn")?.addEventListener("click", () => {
  showLogin();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await VagmreachAPI.logout();
  currentUser = null;
  showLogin();
});

const HERO_AD_SLOT = 1;
let currentHeroAd = null;

function adSlotPanel() {
  return document.querySelector(`#admin-ad-slots [data-ad-slot="${HERO_AD_SLOT}"]`);
}

function readAdTextFields(panel) {
  return {
    title: panel.querySelector(".admin-ad-title")?.value?.trim() || "",
    priceText: panel.querySelector(".admin-ad-price")?.value?.trim() || "",
    offerText: panel.querySelector(".admin-ad-offer")?.value?.trim() || "",
    description: panel.querySelector(".admin-ad-description")?.value?.trim() || "",
    linkUrl: panel.querySelector(".admin-ad-link")?.value?.trim() || "",
    isActive: panel.querySelector(".admin-ad-active")?.checked ?? true,
  };
}

function renderAdminAdSlot(ad) {
  const panel = adSlotPanel();
  if (!panel) return;
  const preview = panel.querySelector(".admin-ad-preview");
  const titleEl = panel.querySelector(".admin-ad-title");
  const priceEl = panel.querySelector(".admin-ad-price");
  const offerEl = panel.querySelector(".admin-ad-offer");
  const descEl = panel.querySelector(".admin-ad-description");
  const linkEl = panel.querySelector(".admin-ad-link");
  const activeEl = panel.querySelector(".admin-ad-active");
  if (ad) {
    preview.innerHTML = `<img src="${ad.imageUrl}" alt="" class="w-full h-full object-cover" />`;
    titleEl.value = ad.title || "";
    priceEl.value = ad.priceText || "";
    offerEl.value = ad.offerText || "";
    descEl.value = ad.description || "";
    linkEl.value = ad.linkUrl || "";
    activeEl.checked = ad.isActive !== false;
  } else {
    preview.innerHTML = "";
    preview.textContent = "No image";
    titleEl.value = "";
    priceEl.value = "";
    offerEl.value = "";
    descEl.value = "";
    linkEl.value = "";
    activeEl.checked = true;
  }
}

async function loadAdminAds() {
  try {
    const data = await VagmreachAPI.adminListAds();
    currentHeroAd = (data.ads || []).find((a) => a.slot === HERO_AD_SLOT) || null;
    renderAdminAdSlot(currentHeroAd);
  } catch {
    /* ignore until logged in */
  }
}

function wireAdminAdSlot() {
  const panel = adSlotPanel();
  if (!panel) return;
  const msg = panel.querySelector(".admin-ad-msg");

  panel.querySelector(".admin-ad-upload")?.addEventListener("click", async () => {
    const fileInput = panel.querySelector(".admin-ad-file");
    const file = fileInput?.files?.[0];
    if (!file) {
      if (msg) msg.textContent = "Choose an image first.";
      return;
    }
    const fields = readAdTextFields(panel);
    const formData = new FormData();
    formData.append("image", file);
    formData.append("title", fields.title);
    formData.append("priceText", fields.priceText);
    formData.append("offerText", fields.offerText);
    formData.append("description", fields.description);
    formData.append("linkUrl", fields.linkUrl);
    formData.append("isActive", fields.isActive ? "true" : "false");
    try {
      const res = await VagmreachAPI.adminUploadAd(HERO_AD_SLOT, formData);
      currentHeroAd = res.ad;
      renderAdminAdSlot(currentHeroAd);
      fileInput.value = "";
      if (msg) msg.textContent = "Saved. Refresh the shop to see it.";
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });

  panel.querySelector(".admin-ad-save-text")?.addEventListener("click", async () => {
    if (!currentHeroAd) {
      if (msg) msg.textContent = "Upload an image first, or use Upload / replace.";
      return;
    }
    const fields = readAdTextFields(panel);
    try {
      const res = await VagmreachAPI.adminUpdateAd(HERO_AD_SLOT, {
        title: fields.title || null,
        priceText: fields.priceText || null,
        offerText: fields.offerText || null,
        description: fields.description || null,
        linkUrl: fields.linkUrl || null,
        isActive: fields.isActive,
      });
      currentHeroAd = res.ad;
      renderAdminAdSlot(currentHeroAd);
      if (msg) msg.textContent = "Text saved. Refresh the shop to see changes.";
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });

  panel.querySelector(".admin-ad-remove")?.addEventListener("click", async () => {
    if (!currentHeroAd) {
      if (msg) msg.textContent = "Nothing to remove.";
      return;
    }
    if (!confirm("Remove the hero ad?")) return;
    try {
      await VagmreachAPI.adminDeleteAd(HERO_AD_SLOT);
      currentHeroAd = null;
      renderAdminAdSlot(null);
      if (msg) msg.textContent = "Removed.";
    } catch (e) {
      if (msg) msg.textContent = e.message;
    }
  });
}

wireAdminAdSlot();

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.remove("text-[#F5D061]", "font-medium", "border-gold-500");
      b.classList.add("text-stone-500");
    });
    btn.classList.add("text-[#F5D061]", "font-medium", "border-b-2", "border-gold-500");
    btn.classList.remove("text-stone-500");
    document.getElementById("tab-products").classList.toggle("hidden", btn.dataset.tab !== "products");
    document.getElementById("tab-ads").classList.toggle("hidden", btn.dataset.tab !== "ads");
    document.getElementById("tab-orders").classList.toggle("hidden", btn.dataset.tab !== "orders");
    if (btn.dataset.tab === "ads") loadAdminAds();
  });
});

renderMediaList();
updateMediaUploadState();
refreshPreview();
init();
