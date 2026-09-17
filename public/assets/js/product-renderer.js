window.VagmreachProductRenderer = {
  formatPrice(paise) {
    return "₹" + Number(paise).toLocaleString("en-IN");
  },

  mediaList(product) {
    return Array.isArray(product.media) ? product.media : [];
  },

  photos(product) {
    return this.mediaList(product).filter((m) => m.type === "PHOTO");
  },

  video(product) {
    return this.mediaList(product).find((m) => m.type === "VIDEO") || null;
  },

  primaryPhoto(product) {
    const photos = this.photos(product);
    return photos.find((p) => p.isPrimary) || photos[0] || null;
  },

  renderCardMediaInner(item) {
    const photos = this.photos(item);
    const primary = this.primaryPhoto(item);
    const video = this.video(item);

    if (primary) {
      const extra =
        photos.length > 1
          ? `<span class="absolute top-2 left-2 z-10 text-[10px] font-bold bg-royal-900/85 text-gold-300 border border-gold-500/40 px-2 py-0.5 rounded-full">+${photos.length - 1} photos</span>`
          : "";
      const videoBadge = video
        ? `<span class="absolute top-2 right-2 z-10 text-[10px] font-bold bg-royal-900/85 text-gold-300 border border-gold-500/40 px-2 py-0.5 rounded-full">▶ Video</span>`
        : "";
      return `
        <img src="${primary.url}" alt="${item.title || "Product"}" class="w-full h-full object-cover" loading="lazy" />
        ${extra}
        ${videoBadge}
      `;
    }

    if (item.primaryImageUrl || item.imageUrl) {
      const url = item.primaryImageUrl || item.imageUrl;
      return `<img src="${url}" alt="${item.title || "Product"}" class="w-full h-full object-cover" loading="lazy" />`;
    }

    return `<div class="w-full h-full flex items-center justify-center p-4 [&>svg]:max-h-full [&>svg]:max-w-full">${item.imageSvg || ""}</div>`;
  },

  renderMediaGalleryBlock(product, { galleryId = "vgm-gallery", compact = false } = {}) {
    const photos = this.photos(product);
    const video = this.video(product);
    const primary = this.primaryPhoto(product) || photos[0];

    if (!photos.length && !video) {
      return `<div class="rounded-xl bg-cream-100 border border-cream-300 ${compact ? "h-48" : "h-64"} flex items-center justify-center p-6">${product.imageSvg || "<span class='text-stone-500 text-sm'>No photos yet</span>"}</div>`;
    }

    const mainSrc = primary?.url || "";
    const thumbClass = compact ? "w-12 h-12" : "w-16 h-16";
    const thumbs = photos
      .map(
        (p, i) => `
        <button type="button" class="vgm-gallery-thumb shrink-0 ${thumbClass} rounded-lg overflow-hidden border-2 ${i === 0 ? "border-gold-500" : "border-cream-300"} focus:outline-none" data-gallery-thumb="${galleryId}" data-url="${p.url}" aria-label="Photo ${i + 1}">
          <img src="${p.url}" alt="" class="w-full h-full object-cover" />
        </button>`,
      )
      .join("");

    const mainFrame = compact
      ? `<div class="relative rounded-xl overflow-hidden border border-cream-300 bg-cream-100 flex items-center justify-center max-h-[min(36dvh,280px)] sm:max-h-[min(40dvh,320px)]">
          <img id="${galleryId}-main" src="${mainSrc}" alt="${product.title || "Product"}" class="w-full h-full max-h-[min(36dvh,280px)] sm:max-h-[min(40dvh,320px)] object-contain" />
        </div>`
      : `<div class="relative rounded-xl overflow-hidden border border-cream-300 bg-cream-100 aspect-[4/3] max-h-[min(42dvh,360px)]">
          <img id="${galleryId}-main" src="${mainSrc}" alt="${product.title || "Product"}" class="w-full h-full object-cover" />
        </div>`;

    const videoBlock = video
      ? `
      <div class="${compact ? "mt-3" : "mt-4"}">
        <p class="text-[11px] uppercase tracking-wider font-semibold text-stone-600 mb-2">Product video</p>
        <video class="w-full rounded-xl border border-cream-300 bg-black ${compact ? "max-h-[min(28dvh,220px)]" : "max-h-72"}" controls playsinline preload="metadata" src="${video.url}"></video>
      </div>`
      : "";

    return `
      <div data-gallery-root="${galleryId}" class="min-w-0">
        ${mainFrame}
        ${
          photos.length > 1
            ? `<div class="flex gap-2 mt-2 sm:mt-3 overflow-x-auto pb-1">${thumbs}</div>`
            : ""
        }
        ${videoBlock}
      </div>
    `;
  },

  initGallery(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll("[data-gallery-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const galleryId = btn.getAttribute("data-gallery-thumb");
        const url = btn.getAttribute("data-url");
        const main = rootEl.querySelector(`#${galleryId}-main`);
        if (main && url) main.setAttribute("src", url);
        rootEl.querySelectorAll(`[data-gallery-thumb="${galleryId}"]`).forEach((b) => {
          b.classList.remove("border-gold-500");
          b.classList.add("border-cream-300");
        });
        btn.classList.add("border-gold-500");
        btn.classList.remove("border-cream-300");
      });
    });
  },

  renderProductDetailView(product) {
    const stock = product.availableStock ?? product.stock ?? 0;
    const pctOff =
      product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;
    const galleryId = `vgm-detail-${product.id}`;

    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start" data-light-panel>
        <div class="min-w-0 order-1">
          ${this.renderMediaGalleryBlock(product, { galleryId, compact: true })}
        </div>
        <div class="space-y-3 min-w-0 order-2 lg:sticky lg:top-0">
          <span class="text-[11px] uppercase text-stone-600 tracking-wider font-semibold">${product.category}</span>
          <h2 class="font-cinzel text-xl sm:text-2xl font-bold text-stone-900 leading-snug">${product.title}</h2>
          <p class="text-sm text-stone-600">${product.weight} · ★ ${product.rating} · ${stock} in stock</p>
          <div class="flex flex-wrap items-baseline gap-2 pt-1">
            <span class="font-cinzel text-xl sm:text-2xl font-bold text-[#755815]">${this.formatPrice(product.price)}</span>
            <span class="text-sm text-stone-500 line-through">${this.formatPrice(product.originalPrice)}</span>
            ${pctOff > 0 ? `<span class="text-xs text-emerald-700 font-semibold">${pctOff}% OFF</span>` : ""}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 sm:pt-4">
            <button type="button" onclick="addToCart(${product.id}); toggleProductDetailModal(false);" class="w-full py-2.5 rounded-xl border border-cream-300 bg-cream-50 text-stone-800 text-xs font-semibold hover:border-gold-400">+ Add to Vault</button>
            <button type="button" onclick="quickBuyItem(${product.id}); toggleProductDetailModal(false);" class="w-full py-2.5 rounded-xl bg-gold-500 text-regal-900 text-xs font-bold uppercase tracking-wider">Quick Buy</button>
          </div>
        </div>
      </div>
    `;
  },

  /** Admin preview — compact card, no cart actions */
  renderCard(product) {
    const inactive = product.isActive === false;
    const outOfStock = (product.availableStock ?? product.stock ?? 0) <= 0;
    const title = product.title || "Product title";
    const price = product.price ?? 0;
    const original = product.originalPrice ?? price;
    const weight = product.weight || "1g";
    const rating = product.rating ?? 4.8;

    return `
      <article class="bg-white border border-cream-200 rounded-2xl p-4 shadow-sm max-w-xs mx-auto">
        ${inactive ? '<p class="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-2">Hidden from storefront</p>' : ""}
        <div class="w-full h-40 rounded-lg overflow-hidden relative bg-cream-100">${this.renderCardMediaInner(product)}</div>
        <h3 class="font-serif text-stone-900 text-sm mt-3 line-clamp-2">${title}</h3>
        <p class="text-[10px] text-stone-500 mt-1">${weight} • ★ ${rating}</p>
        <div class="flex items-baseline gap-2 mt-2">
          <span class="text-gold-600 font-semibold">${this.formatPrice(price)}</span>
          ${original > price ? `<span class="text-xs text-stone-400 line-through">${this.formatPrice(original)}</span>` : ""}
        </div>
        <button type="button" class="mt-3 w-full py-2 rounded-lg text-xs font-medium ${outOfStock ? "bg-stone-200 text-stone-500" : "bg-stone-900 text-gold-500"}" disabled>
          ${outOfStock ? "Out of stock" : "Add to vault"}
        </button>
      </article>
    `;
  },

  /** Storefront grid — same layout as customer shop */
  renderStorefrontCard(item, options = {}) {
    const preview = options.preview === true;
    const stock = item.availableStock ?? item.stock ?? 0;
    const pctOff =
      item.originalPrice > item.price
        ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
        : 0;
    const openDetail = preview ? "" : `onclick="openProductDetail(${item.id})"`;
    const cursor = preview ? "" : "cursor-pointer";

    return `
      <div class="bg-cream-50 border border-gold-400/30 hover:border-gold-400/60 rounded-2xl p-5 shadow-xl shadow-black/25 transition-all duration-300 gold-card-glow flex flex-col justify-between group relative">
        <div class="flex items-center justify-between mb-3">
          <span class="product-weight-badge text-[10px] font-mono font-bold bg-amber-50 text-[#5C4413] border border-[#947219]/50 px-2 py-0.5 rounded">
            ${item.weight}
          </span>
          <span class="text-[11px] text-[#947219] font-semibold flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#B89225] animate-pulse"></span>
            Only ${stock} left
          </span>
        </div>
        <div ${openDetail} class="w-full h-56 rounded-xl bg-gradient-to-b from-cream-200 via-cream-100 to-gold-50 border border-cream-300 flex items-center justify-center relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 ${cursor}" title="View photos & video">
          ${this.renderCardMediaInner(item)}
          <div class="absolute bottom-2 right-2 text-[10px] bg-white/90 border border-cream-300 px-2 py-0.5 rounded text-stone-600 shadow-sm pointer-events-none">
            👁 ${item.viewersCount ?? item.viewers ?? 0} viewing now
          </div>
          ${
            !preview
              ? `<div class="absolute bottom-2 left-2 text-[10px] bg-royal-900/80 text-gold-200 px-2 py-0.5 rounded border border-gold-500/30 pointer-events-none">Gallery</div>`
              : ""
          }
        </div>
        <div class="mt-4 space-y-2 flex-1">
          <div class="flex items-center justify-between">
            <span class="text-[11px] uppercase text-stone-600 tracking-wider font-semibold">${item.category}</span>
            <span class="text-xs text-[#947219] font-semibold">★ ${item.rating}</span>
          </div>
          <h3 class="font-cinzel font-bold text-stone-900 text-base group-hover:text-[#755815] transition-colors">
            ${item.title}
          </h3>
          <div class="flex items-baseline gap-2 pt-1">
            <span class="font-cinzel text-xl font-bold text-[#755815]">${this.formatPrice(item.price)}</span>
            <span class="text-xs text-stone-600 line-through">${this.formatPrice(item.originalPrice)}</span>
            ${pctOff > 0 ? `<span class="text-[11px] text-emerald-700 font-semibold">${pctOff}% OFF</span>` : ""}
          </div>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2 pt-2 border-t border-cream-300/80">
          <button type="button" ${preview ? "disabled" : `onclick="addToCart(${item.id})"`} class="w-full py-2.5 rounded-xl border border-cream-300 bg-cream-50 text-stone-700 text-xs font-semibold hover:border-gold-400 hover:text-gold-800 transition ${preview ? "opacity-60" : ""}">
            + Add to Vault
          </button>
          <button type="button" ${preview ? "disabled" : `onclick="quickBuyItem(${item.id})"`} class="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-regal-900 text-xs font-bold uppercase tracking-wider transition shadow-md ${preview ? "opacity-60" : ""}">
            Quick Buy
          </button>
        </div>
      </div>
    `;
  },
};
