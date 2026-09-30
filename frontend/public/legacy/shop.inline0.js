
      const PAGE_SIZE = 12;
      window.API_BASE = window.API_BASE || "https://gloriya.in/api";

      // --- Discount support ---
      let SITE_DISCOUNTS = [];

      async function fetchSiteDiscounts() {
        try {
          const res = await fetch(`${window.API_BASE}/admin/discounts`);
          if (!res.ok) return [];
          const data = await res.json();
          SITE_DISCOUNTS = Array.isArray(data) ? data.map(d => {
            const copy = Object.assign({}, d);
            copy.type = String(copy.type || "percentage");
            copy.value = Number(copy.value || 0);
            copy.active = !!copy.active;
            if (Array.isArray(copy.product_ids)) copy.product_ids = copy.product_ids.map(x => Number(x)).filter(n => !isNaN(n));
            else copy.product_ids = [];
            return copy;
          }) : [];
          return SITE_DISCOUNTS;
        } catch (e) {
          console.warn("Failed to fetch discounts:", e);
          SITE_DISCOUNTS = [];
          return SITE_DISCOUNTS;
        }
      }

      function discountIsActiveNow(d) {
        if (!d || !d.active) return false;
        const now = Date.now();
        if (d.starts_at) { const s = Date.parse(d.starts_at); if (!isNaN(s) && now < s) return false; }
        if (d.ends_at)   { const e = Date.parse(d.ends_at);   if (!isNaN(e) && now > e) return false; }
        return true;
      }

      function applyDiscountsToPrice(price, productId, discounts) {
        let final = Number(price) || 0;
        const pid = Number(productId);
        (discounts || []).forEach(d => {
          if (!discountIsActiveNow(d)) return;
          if (Array.isArray(d.product_ids) && d.product_ids.length && !d.product_ids.includes(pid)) return;
          if (d.type === "percentage") final = final * (1 - (Number(d.value) || 0) / 100);
          else final = final - (Number(d.value) || 0);
        });
        return Math.max(0, Math.round(final));
      }

      // State
      let ALL = [];
      let VIEW = [];
      let page = 1;

      // Elements
      const grid      = () => document.getElementById("productGrid");
      const q         = () => document.getElementById("q");
      const cat       = () => document.getElementById("category");
      const priceMin  = () => document.getElementById("priceMin");
      const priceMax  = () => document.getElementById("priceMax");
      const inStock   = () => document.getElementById("inStock");
      const sortSel   = () => document.getElementById("sort");
      const resultCount = () => document.getElementById("resultCount");
      const clearAll  = () => document.getElementById("clearAll");
      const pageInfo  = () => document.getElementById("pageInfo");
      const mcat      = () => document.getElementById("m-category");
      const mMin      = () => document.getElementById("m-priceMin");
      const mMax      = () => document.getElementById("m-priceMax");
      const mStock    = () => document.getElementById("m-inStock");

      const moneyINR = (n) => {
        try { return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n); }
        catch { return "₹" + n; }
      };

      async function fetchJSON(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const ct = res.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await res.json() : await res.text();
        if (!res.ok) throw new Error(typeof body === "string" ? body : JSON.stringify(body));
        if (typeof body === "string") throw new Error("Expected JSON but got HTML");
        return body;
      }

      const CATEGORY_DEFINITIONS = [
        { slug: "ring", label: "Ring", terms: [/\bring\b/] },
        { slug: "necklace", label: "Necklace", terms: [/\bnecklaces?\b/, /\bneck\s*sets?\b/, /\bchokers?\b/] },
        { slug: "bangles", label: "Bangles", terms: [/\bbangles?\b/] },
        { slug: "maang-teeka", label: "Maang Teeka", terms: [/\bmaang\s*teeka\b/, /\bmaang\s*tikka\b/] },
        { slug: "bracelet", label: "Bracelet", terms: [/\bbracelets?\b/] },
        { slug: "matha-patti", label: "Matha Patti", terms: [/\bmatha\s*patti\b/] },
        { slug: "borla", label: "Borla", terms: [/\bborla\b/] },
        { slug: "western-jewellery", label: "Western Jewellery", terms: [/\bwestern\s+jewell?ery\b/, /\bwestern\b/] },
        { slug: "nose-pin", label: "Nose Pin", terms: [/\bnose\s*pin\b/, /\bnose\s*ring\b/] },
        { slug: "watch", label: "Watch", terms: [/\bwatches?\b/] },
        { slug: "earring", label: "Earring", terms: [/\b earrings?\b/, /^earrings?$/] },
      ];

      function normalizeCategory(c) {
        const s = String(c || "").toLowerCase().trim().replace(/[_\s]+/g, "-");
        if (!s) return "";
        if (s === "rings" || s === "ring") return "ring";
        if (s === "necklace" || s === "necklaces" || s === "necklace-set" || s === "neck-set" || s === "neck-sets") return "necklace";
        if (s === "bangle" || s === "bangles") return "bangles";
        if (s === "maang-teeka" || s === "maang-tikka") return "maang-teeka";
        if (s === "bracelet" || s === "bracelets") return "bracelet";
        if (s === "matha-patti") return "matha-patti";
        if (s === "borla") return "borla";
        if (s === "western-jewellery" || s === "western-jewelry") return "western-jewellery";
        if (s === "nose-pin" || s === "nose-ring") return "nose-pin";
        if (s === "watch" || s === "watches") return "watch";
        if (s === "earring" || s === "earrings") return "earring";
        return "";
      }

      function deriveCategory(p) {
        const explicit = normalizeCategory(p.category);
        if (explicit) return explicit;
        const hay = `${p.name || ""} ${p.description || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
        for (const category of CATEGORY_DEFINITIONS) {
          if (category.terms.some(re => re.test(hay))) return category.slug;
        }
        return "";
      }

      function detectCategoryFromSearch(term) {
        const t = String(term || "").toLowerCase().trim();
        return normalizeCategory(t);
      }

      function skeletons(n = 8) {
        return Array.from({ length: n }).map((_, i) => `
          <div class="col-6 col-sm-6 col-md-4 col-lg-3">
            <div class="gl-card">
              <div class="gl-card-img-wrap gl-skeleton" style="aspect-ratio:1"></div>
              <div class="gl-card-body gap-2 d-flex flex-column">
                <div class="gl-skeleton" style="height:14px;width:85%"></div>
                <div class="gl-skeleton" style="height:14px;width:55%"></div>
                <div class="gl-skeleton mt-1" style="height:36px;width:100%"></div>
              </div>
            </div>
          </div>`).join("");
      }

      function escapeHtml(s) {
        return String(s || "").replace(/[&<>"'\/]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;"}[c]));
      }

      function mediaSrc(url) {
        if (!url) return "/assets/placeholder-local.png";
        const raw = String(url);
        if (/^https?:\/\//i.test(raw)) return raw;
        try {
          const apiOrigin = new URL(API_BASE).origin;
          return (raw.startsWith("/uploads/") || raw.startsWith("uploads/"))
            ? apiOrigin + "/" + raw.replace(/^\//, "")
            : window.location.origin + "/" + raw.replace(/^\//, "");
        } catch { return raw; }
      }

      function renderGrid() {
        const start = (page - 1) * PAGE_SIZE;
        const items = VIEW.slice(start, start + PAGE_SIZE);

        grid().innerHTML = items.map((p, idx) => {
          const out = !p.stock || p.stock <= 0;
          const rawPrice = Number(p.price) || 0;
          const discounted = applyDiscountsToPrice(rawPrice, p.id, SITE_DISCOUNTS);
          const hasDiscount = discounted < rawPrice;

          const priceHtml = hasDiscount
            ? `<span class="gl-card-price-old">${moneyINR(rawPrice)}</span>${moneyINR(discounted)}`
            : moneyINR(rawPrice);

          const img = mediaSrc(p.image || p.media?.[0]?.url || "/static/img/placeholder-1x1.jpg");
          const effectivePrice = hasDiscount ? discounted : rawPrice;

          const delay = Math.min(idx * 40, 300);

          return `
            <div class="col-6 col-sm-6 col-md-4 col-lg-3 gl-card-wrap" style="animation-delay:${delay}ms">
              <div class="gl-card">
                <a href="product.html?id=${p.id}" class="text-decoration-none">
                  <div class="gl-card-img-wrap">
                    <img src="${img}" alt="${escapeHtml(p.name)}"
                         loading="lazy" decoding="async"
                         onerror="this.src='/static/img/placeholder-1x1.jpg'">
                    ${out ? `<div class="gl-oos-overlay"><span class="gl-oos-tag">Out of stock</span></div>` : ""}
                  </div>
                </a>
                <div class="gl-card-body">
                  <div class="gl-card-name">${escapeHtml(p.name)}</div>
                  <div class="gl-card-price">${priceHtml}</div>
                  <div class="gl-card-actions">
                    ${out
                      ? `<button class="gl-btn-notify" onclick="setReminder('${p.id}')"><i class="fa fa-bell fa-xs me-1"></i>Notify me</button>`
                      : `<button class="gl-btn-cart btn-add"
                              data-id="${p.id}"
                              data-name="${escapeHtml(p.name)}"
                              data-price="${effectivePrice}"
                              data-image="${img}">
                          <i class="fa fa-cart-plus fa-xs"></i>Add to Cart
                        </button>`
                    }
                    <button class="gl-btn-quick" data-quick="${p.id}" title="Quick view">
                      <i class="fa fa-eye fa-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>`;
        }).join("");

        const total = VIEW.length;
        const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
        page = Math.min(page, maxPage);
        resultCount().textContent = `${total} item${total === 1 ? "" : "s"} · Page ${page} of ${maxPage}`;
        pageInfo().textContent = `${page} / ${maxPage}`;
        document.getElementById("prev").disabled = page <= 1;
        document.getElementById("next").disabled = page >= maxPage;
        clearAll().classList.toggle("d-none", !hasAnyFilter());
      }

      function hasAnyFilter() {
        return !!(
          q().value.trim() ||
          cat().value ||
          priceMin().value ||
          priceMax().value ||
          inStock().checked ||
          sortSel().value !== "rel"
        );
      }

      function buildCategories() {
        const options = ['<option value="">All categories</option>']
          .concat(CATEGORY_DEFINITIONS.map(c => `<option value="${c.slug}">${c.label}</option>`))
          .join("");
        document.getElementById("category").innerHTML = options;
        document.getElementById("m-category").innerHTML = options;
      }

      function applyFilters() {
        const term = q().value.trim().toLowerCase();
        const searchCat = detectCategoryFromSearch(term);
        const rawCat = (cat().value || "").trim();
        const c = rawCat ? normalizeCategory(rawCat) : (searchCat || "");
        const min = parseFloat(priceMin().value) || 0;
        const max = parseFloat(priceMax().value) || Number.POSITIVE_INFINITY;
        const stockOnly = inStock().checked;

        VIEW = ALL.filter((p) => {
          const matchesText =
            (searchCat && !rawCat)
              ? true
              : !term ||
                (p.name || "").toLowerCase().includes(term) ||
                (p.description || "").toLowerCase().includes(term);
          const pc = deriveCategory(p);
          const matchesCat = !c || pc === c;
          const price = Number(p.price) || 0;
          const matchesPrice = price >= min && price <= max;
          const matchesStock = !stockOnly || !!p.stock;
          return matchesText && matchesCat && matchesPrice && matchesStock;
        });

        const s = sortSel().value;
        const by = {
          priceAsc:  (a, b) => (a.price || 0) - (b.price || 0),
          priceDesc: (a, b) => (b.price || 0) - (a.price || 0),
          nameAsc:   (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
          newest:    (a, b) => (b.id || 0) - (a.id || 0),
        }[s];
        if (by) VIEW.sort(by);

        page = 1;
        renderGrid();
        syncQueryParams();
      }

      function syncQueryParams() {
        const params = new URLSearchParams();
        if (q().value.trim()) params.set("q", q().value.trim());
        if (cat().value) params.set("cat", cat().value);
        if (priceMin().value) params.set("min", priceMin().value);
        if (priceMax().value) params.set("max", priceMax().value);
        if (inStock().checked) params.set("stock", "1");
        if (sortSel().value !== "rel") params.set("sort", sortSel().value);
        history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params.toString()}` : ""));
      }

      function readQueryParams() {
        const u = new URLSearchParams(location.search);
        q().value = u.get("q") || "";
        const rawIncoming = u.get("cat") || "";
        const incomingCat = rawIncoming ? normalizeCategory(rawIncoming) : "";
        cat().value = incomingCat;
        priceMin().value = u.get("min") || "";
        priceMax().value = u.get("max") || "";
        inStock().checked = u.get("stock") === "1";
        sortSel().value = u.get("sort") || "rel";
        document.getElementById("m-category").value = cat().value;
        document.getElementById("m-priceMin").value = priceMin().value;
        document.getElementById("m-priceMax").value = priceMax().value;
        document.getElementById("m-inStock").checked = inStock().checked;
      }

      const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

      document.getElementById("prev").onclick = () => { page = Math.max(1, page - 1); renderGrid(); };
      document.getElementById("next").onclick = () => { const mx = Math.ceil(VIEW.length / PAGE_SIZE) || 1; page = Math.min(mx, page + 1); renderGrid(); };

      q().addEventListener("input", debounce(applyFilters, 250));
      [cat(), priceMin(), priceMax(), inStock(), sortSel()].forEach(el => el.addEventListener("change", applyFilters));
      clearAll().onclick = () => {
        q().value = ""; cat().value = ""; priceMin().value = ""; priceMax().value = "";
        inStock().checked = false; sortSel().value = "rel"; applyFilters();
      };

      document.getElementById("m-apply").addEventListener("click", () => {
        cat().value = mcat().value;
        priceMin().value = mMin().value;
        priceMax().value = mMax().value;
        inStock().checked = mStock().checked;
        applyFilters();
      });

      document.addEventListener("click", (e) => {
        const add = e.target.closest(".btn-add");
        if (add) {
          const product = { id:add.dataset.id, name:add.dataset.name, price:Number(add.dataset.price), image:add.dataset.image, qty:1 };
          let cart = JSON.parse(localStorage.getItem("cart") || "[]");
          const x = cart.find(i => String(i.id) === String(product.id));
          if (x) x.qty = (x.qty || 1) + 1; else cart.push(product);
          localStorage.setItem("cart", JSON.stringify(cart));
          window.dispatchEvent(new Event('cart:updated'));
          window.dispatchEvent(new CustomEvent('cart:notify', { detail: '🛒 Added to Cart' }));
          showToast("🛒 Added to Cart");
        }

        const quickBtn = e.target.closest("[data-quick]");
        if (quickBtn) {
          const pid = quickBtn.getAttribute("data-quick");
          const p = ALL.find(x => String(x.id) === String(pid));
          if (!p) return;

          const modalEl = document.getElementById("quickModal");
          const galleryInner = document.getElementById("qmGalleryInner");
          const galleryThumbs = document.getElementById("qmGalleryThumbs");
          const carouselEl = document.getElementById("quickGalleryCarousel");
          const nameEl = document.getElementById("qmName");
          const priceEl = document.getElementById("qmPrice");
          const descEl = document.getElementById("qmDesc");
          const addEl = document.getElementById("qmAdd");
          const wishEl = document.getElementById("qmWish");
          const viewEl = document.getElementById("qmView");
          if (!modalEl || !galleryInner || !galleryThumbs || !carouselEl || !nameEl || !priceEl || !descEl || !addEl || !wishEl || !viewEl) {
            console.error("Quick View modal markup is missing.");
            return;
          }

          const rawMedia = Array.isArray(p.media) ? p.media : [];
          const media = (() => {
            const list = rawMedia.length
              ? rawMedia.map(m => typeof m === "string"
                  ? { url:m, type:/\.(mp4|webm|mov)$/i.test(m) ? "video" : "image"}
                  : {url:m?.url || "", type:m?.type || (/\.(mp4|webm|mov)$/i.test(m?.url || "") ? "video" : "image")})
                  .filter(m => m.url)
              : [{ url:p.image || "/assets/placeholder-local.png", type:"image" }];
            const seen = new Set();
            return list.filter(m => {
              const key = String(m.url || "").trim();
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          })();
          const img = media[0]?.url || "/assets/placeholder-local.png";
          const rawPrice = Number(p.price) || 0;
          const discounted = applyDiscountsToPrice(rawPrice, p.id, SITE_DISCOUNTS);
          const finalPrice = discounted < rawPrice ? discounted : rawPrice;

          galleryInner.innerHTML = media.map((m, i) => {
            const src = mediaSrc(m.url);
            const active = i === 0 ? "active" : "";
            if (String(m.type || "").startsWith("video")) {
              return `<div class="carousel-item ${active}"><video class="d-block w-100 gl-quick-image" controls preload="metadata"><source src="${src}"></video></div>`;
            }
            return `<div class="carousel-item ${active}"><img src="${src}" alt="${escapeHtml(p.name || "Product image")}" class="d-block gl-quick-image" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/placeholder-local.png'"></div>`;
          }).join("");

          galleryThumbs.innerHTML = media.map((m, i) => {
            const src = mediaSrc(m.url);
            return `<button type="button" class="gl-quick-thumb ${i===0 ? "active" : ""}" data-index="${i}" aria-label="View image ${i+1}"><img src="${src}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/assets/placeholder-local.png'"></button>`;
          }).join("");
          galleryThumbs.querySelectorAll(".gl-quick-thumb").forEach(btn => btn.addEventListener("click", () => {
            const bs = window.bootstrap?.Carousel?.getOrCreateInstance(carouselEl);
            if (bs) bs.to(Number(btn.dataset.index || 0));
            galleryThumbs.querySelectorAll(".gl-quick-thumb").forEach(x => x.classList.remove("active"));
            btn.classList.add("active");
          }));
          if (!carouselEl.dataset.quickGalleryBound) {
            carouselEl.addEventListener("slid.bs.carousel", (event) => {
              galleryThumbs.querySelectorAll(".gl-quick-thumb").forEach(x => x.classList.remove("active"));
              const activeThumb = galleryThumbs.querySelector(`.gl-quick-thumb[data-index="${event.to}"]`);
              if (activeThumb) activeThumb.classList.add("active");
            });
            carouselEl.dataset.quickGalleryBound = "1";
          }

          nameEl.textContent = p.name || "Jewellery Product";
          priceEl.textContent = moneyINR(finalPrice);
          descEl.textContent = (p.description || "Discover this beautiful Gloriya Jewellery piece.").slice(0, 260) + ((p.description || "").length > 260 ? "…" : "");

          addEl.onclick = () => {
            let cart = JSON.parse(localStorage.getItem("cart") || "[]");
            const x = cart.find(i => String(i.id) === String(p.id));
            if (x) x.qty = (x.qty || 1) + 1;
            else cart.push({ id:p.id, name:p.name, price:finalPrice, image:img, qty:1 });
            localStorage.setItem("cart", JSON.stringify(cart));
            window.dispatchEvent(new Event("cart:updated"));
            showToast("🛒 Added to Cart");
          };

          wishEl.onclick = () => {
            let wl = JSON.parse(localStorage.getItem("wishlist") || "[]");
            const id = String(p.id);
            if (!wl.includes(id)) {
              wl.push(id);
              localStorage.setItem("wishlist", JSON.stringify(wl));
              window.dispatchEvent(new Event("wishlist:updated"));
              showToast("❤️ Added to Wishlist");
            } else {
              showToast("💖 Already in Wishlist");
            }
          };

          viewEl.href = `/product.html?id=${encodeURIComponent(p.id)}`;

          if (window.bootstrap?.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
          } else {
            // Defensive fallback if Bootstrap has not finished loading.
            modalEl.classList.add("show");
            modalEl.style.display = "block";
            modalEl.removeAttribute("aria-hidden");
            document.body.classList.add("modal-open");
            const close = () => {
              modalEl.classList.remove("show");
              modalEl.style.display = "none";
              modalEl.setAttribute("aria-hidden", "true");
              document.body.classList.remove("modal-open");
              modalEl.removeEventListener("click", onBackdrop);
            };
            const onBackdrop = (event) => { if (event.target === modalEl) close(); };
            modalEl.addEventListener("click", onBackdrop);
            modalEl.querySelectorAll("[data-bs-dismiss=\"modal\"]").forEach(btn => btn.onclick = close);
          }
        }
      });

      function showToast(msg) {
        if (typeof window.notify === 'function') { window.notify(msg); return; }
        const el = document.createElement("div");
        el.className = "cart-toast";
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2200);
      }

      async function setReminder(productId) {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) return alert("Please log in to set a reminder.");
        try {
          const res = await fetch(`${window.API_BASE}/reminder/${productId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          });
          if (!res.ok) throw new Error("Failed");
          alert("✅ Reminder set! We'll notify you when it's back.");
        } catch { alert("⚠️ Could not set reminder. Try again later."); }
      }
      window.setReminder = setReminder;

      async function boot() {
        if (typeof window.notify !== 'function') {
          try {
            const path = window.location.pathname;
            const isNested = path.includes("/user/") || path.includes("/admin/") || path.split("/").length > 2;
            const prefix = isNested ? "../" : "./";
            const res = await fetch(`${prefix}partials/notifier.html`);
            if (res.ok) document.getElementById("notifier").innerHTML = await res.text();
          } catch(_) {}
        }

        grid().innerHTML = skeletons(8);
        try {
          const data = await fetchJSON(`${window.API_BASE}/products/`);
          ALL = Array.isArray(data) ? data : [];
          await fetchSiteDiscounts();
          buildCategories();
          readQueryParams();
          if (!cat().value) { VIEW = ALL.slice(); }
          applyFilters();
        } catch (e) {
          grid().innerHTML = `<div class="col-12"><div class="alert alert-danger">Error loading products.</div></div>`;
          console.error(e);
        }
      }
      document.addEventListener("DOMContentLoaded", boot);
    