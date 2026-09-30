
      const API_BASE = window.API_BASE || "https://gloriya.in/api";

      function getProductIdFromURL() {
        const qid = new URLSearchParams(location.search).get("id");
        if (qid) return qid;
        const m = location.pathname.match(/\/product\/(\d+)/i);
        return m ? m[1] : null;
      }

      async function fetchJSON(url, options = {}) {
        const res = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.headers||{}) } });
        const ct = res.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await res.json() : await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}\n` + (typeof body === "string" ? body.slice(0,200) : JSON.stringify(body)));
        if (typeof body === "string") throw new Error(`Expected JSON, got HTML/text @ ${url}`);
        return body;
      }

      function moneyINR(n) {
        try { return new Intl.NumberFormat("en-IN",{ style:"currency", currency:"INR", maximumFractionDigits: 0 }).format(n); }
        catch { return "₹" + n; }
      }

      function mediaSrc(url) {
        if (!url) return "/assets/placeholder-local.png";
        try {
          const raw = String(url);
          const apiOrigin = new URL(API_BASE).origin;
          const abs = (/^https?:\/\//i.test(raw))
            ? raw
            : ((raw.startsWith("/uploads/") || raw.startsWith("uploads/"))
                ? apiOrigin + "/" + raw.replace(/^\//, "")
                : window.location.origin + "/" + raw.replace(/^\//, ""));
          const u = new URL(abs);
          u.pathname = encodeURI(u.pathname);
          return u.toString();
        } catch (e) { return encodeURI(url); }
      }

      function escapeHtml(s) {
        return String(s || "").replace(/[&<>"'\/]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;"}[c]));
      }

      async function fetchSiteDiscounts() {
        try {
          const res = await fetch(`${API_BASE}/admin/discounts`);
          if (!res.ok) return [];
          const data = await res.json();
          if (!Array.isArray(data)) return [];
          return data.map(d => {
            const copy = Object.assign({}, d);
            copy.type = String(copy.type || "percentage");
            copy.value = Number(copy.value || 0);
            copy.active = !!copy.active;
            if (Array.isArray(copy.product_ids)) copy.product_ids = copy.product_ids.map(x => Number(x)).filter(n => !isNaN(n));
            else copy.product_ids = [];
            return copy;
          });
        } catch (e) { console.warn("discount fetch failed", e); return []; }
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
          if (d.type === "percentage") final = final * (1 - (Number(d.value) || 0)/100);
          else final = final - (Number(d.value) || 0);
        });
        return Math.max(0, Math.round(final));
      }

      async function loadProduct() {
        const id = getProductIdFromURL();
        if (!id) {
          document.getElementById("productContainer").innerHTML =
            `<div class="alert alert-warning">Missing product id in URL. Use <code>?id=123</code> or <code>/product/123</code>.</div>`;
          return;
        }
        let p;
        try {
          p = await fetchJSON(`${API_BASE}/products/${id}`);
        } catch (e) {
          document.getElementById("productContainer").innerHTML = `<div class="alert alert-danger">Failed to load product.</div>`;
          console.error(e);
          return;
        }

        let media = [];
        if (Array.isArray(p.media) && p.media.length) {
          media = p.media.map(m => {
            const url = typeof m === "string" ? m : (m?.url || "");
            const type = typeof m === "string"
              ? (/\.(mp4|webm|mov)$/i.test(url) ? "video" : "image")
              : (m?.type || (/\.(mp4|webm|mov)$/i.test(url) ? "video" : "image"));
            return { url, type };
          }).filter(m => m.url);
        } else if (p.image) {
          media = [{ url: p.image, type: (/\.(mp4|webm|mov)$/i.test(p.image) ? "video" : "image") }];
        }

        // Remove exact duplicate media entries while preserving upload order.
        // Some older product records contain the same image multiple times.
        const seenMedia = new Set();
        media = media.filter(m => {
          const key = String(m.url || "").trim();
          if (!key || seenMedia.has(key)) return false;
          seenMedia.add(key);
          return true;
        });

        // Keep the primary product image first when it exists in the media list.
        if (p.image) {
          const primary = media.find(m => String(m.url) === String(p.image));
          if (primary) media = [primary, ...media.filter(m => m !== primary)];
        }

        const discounts = await fetchSiteDiscounts();
        const rawPrice = Number(p.price || 0);
        const discounted = applyDiscountsToPrice(rawPrice, p.id, discounts);

        const invRaw = (p.inventory !== undefined && p.inventory !== null) ? Number(p.inventory) : null;
        const stockFlag = (p.stock === undefined || p.stock === null) ? true : !!p.stock;
        const hasInventoryField = invRaw !== null && !Number.isNaN(invRaw);
        const inventory = hasInventoryField ? invRaw : null;
        const inStock = stockFlag && (inventory === null || inventory > 0);

        const stockHtml = inStock
          ? (inventory !== null
              ? `<span class="gl-stock-in"><span class="gl-stock-dot"></span>In stock · ${inventory} available</span>`
              : `<span class="gl-stock-in"><span class="gl-stock-dot"></span>In stock</span>`)
          : `<span class="gl-stock-out"><span class="gl-stock-dot"></span>Out of stock</span>`;

        const priceHtml = (discounted < rawPrice)
          ? `<span class="gl-price-current">${moneyINR(discounted)}</span><span class="gl-price-old">${moneyINR(rawPrice)}</span>`
          : `<span class="gl-price-current">${moneyINR(rawPrice)}</span>`;

        const crumb = document.getElementById("crumbName");
        if (crumb) crumb.textContent = p.name || "Product";

        const catHtml = p.category
          ? `<span class="gl-category-badge">${escapeHtml(p.category)}</span>`
          : "";

        const effectivePrice = (discounted < rawPrice ? discounted : rawPrice);
        const primaryImage = p.image || (media[0] && media[0].url) || "";

        const actionsHtml = inStock
          ? `
            <button id="addToCartBtn" class="btn-gl-primary"
                    data-id="${p.id}" data-name="${escapeHtml(p.name)}"
                    data-price="${effectivePrice}" data-image="${primaryImage}">
              <i class="fa fa-cart-plus me-2"></i>Add to Cart
            </button>
            <button id="buyNowBtn" class="btn-gl-primary"
                    style="background:var(--gold);border-color:var(--gold);"
                    data-id="${p.id}"
                    data-name="${escapeHtml(p.name)}"
                    data-price="${effectivePrice}"
                    data-image="${primaryImage}">
              Buy Now
            </button>
          `
          : `
            <button id="notifyBtn" class="btn-gl-outline">
              <i class="fa fa-bell me-2"></i>Notify me
            </button>
          `;

        document.getElementById("productContainer").innerHTML = `
          <div class="row g-4 align-items-start">

            <!-- Gallery -->
            <div class="col-lg-6">
              <div class="gl-gallery-wrap">
                <div class="gl-carousel-wrap">
                  <div id="productCarousel" class="carousel slide" data-bs-ride="false">
                    <div class="carousel-inner">
                      ${media.map((m,i) => {
                        const s = mediaSrc(m.url || "");
                        if ((m.type||"").startsWith("video")) {
                          return `<div class="carousel-item ${i===0?"active":""}" data-index="${i}">
                                    <video class="d-block w-100" controls preload="metadata" style="max-height:520px;object-fit:cover;"><source src="${s}"></video>
                                  </div>`;
                        }
                        return `<div class="carousel-item ${i===0?"active":""}" data-index="${i}">
                                  <img src="${s}" class="d-block gl-mainimg" alt="${escapeHtml(p.name || '')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/placeholder-local.png';">
                                </div>`;
                      }).join("")}
                    </div>
                    ${media.length > 1 ? `
                    <button class="carousel-control-prev" type="button" data-bs-target="#productCarousel" data-bs-slide="prev">
                      <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                      <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#productCarousel" data-bs-slide="next">
                      <span class="carousel-control-next-icon" aria-hidden="true"></span>
                      <span class="visually-hidden">Next</span>
                    </button>` : ""}
                  </div>
                </div>
                ${media.length ? `
                <div class="gl-thumbs">
                  ${media.map((m,i) => {
                    const active = i===0 ? "active" : "";
                    if ((m.type||"").startsWith("video")) {
                      return `<div class="gl-thumb-video ${active}" data-index="${i}" title="Play video">
                                <i class="fa-solid fa-play fa-xs"></i>
                              </div>`;
                    }
                    return `<img src="${mediaSrc(m.url)}" data-index="${i}"
                                 class="gl-thumb ${active}" alt="thumb"
                                 loading="lazy" decoding="async">`;
                  }).join("")}
                </div>` : ""}
              </div>
            </div>

            <!-- Info -->
            <div class="col-lg-6">
              <div class="gl-info-card">

                ${catHtml}
                <h1 class="gl-product-title">${escapeHtml(p.name)}</h1>

                <div class="d-flex align-items-center gap-3 mb-3">
                  <div class="gl-stars">
                    <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i>
                    <i class="fa fa-star"></i><i class="fa fa-star-half-stroke"></i>
                  </div>
                  <span class="gl-review-count">${p.rating || 4.8} · ${p.rating_count || 120}+ reviews</span>
                </div>

                <hr class="gl-divider">

                <div id="stockBlock" class="mb-3">${stockHtml}</div>

                <div class="d-flex align-items-baseline gap-3 mb-1">
                  <div id="priceBlock">${priceHtml}</div>
                </div>
                <div class="gl-tax-note mb-4">Tax included · Free delivery above ₹999</div>

                <div class="gl-action-row">
                  ${actionsHtml}
                  <button class="btn-gl-outline btn-wishlist">
                    <i class="fa fa-heart me-2"></i>Wishlist
                  </button>
                  <button class="btn-gl-outline" id="shareBtn">
                    <i class="fa fa-share-nodes me-2"></i>Share
                  </button>
                </div>

                <hr class="gl-divider">

                <div class="mb-4">
                  <div class="gl-section-label">Item Details</div>
                  <div class="gl-desc-collapse" id="descCollapse">
                    <div class="gl-desc-text" id="etsyDesc">
                      ${(p.description || "").split('\n').map(s => `<p class="mb-1">${escapeHtml(s)}</p>`).join('')}
                    </div>
                  </div>
                  <button class="gl-read-more" id="readMoreBtn">
                    Read more <i class="fa fa-chevron-down fa-xs"></i>
                  </button>
                </div>

                <hr class="gl-divider">

                <div class="gl-section-label mb-2">Shipping &amp; Returns</div>
                <div class="gl-shipping-box">
                  <div><strong>📦 Dispatch:</strong> 1–2 business days from Jaipur</div>
                  <div><strong>🚚 Delivery:</strong> Free Pan-India on orders over ₹999</div>
                  <div><strong>🔄 Returns:</strong> Easy 7-day exchange on unused items</div>
                  <div class="mt-1">Questions? <a href="/contact.html" style="color:var(--gold);">Contact us</a></div>
                </div>

              </div>
            </div>
          </div>

          <!-- Reviews -->
          <section class="mt-5 pt-3" id="reviewsSection">
            <hr class="gl-divider">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h4 class="gl-suggested-title mb-0">Customer Reviews</h4>
              <button type="button" class="btn-gl-outline" id="openReviewBtn">Write a Review</button>
            </div>
            <div id="reviewList" class="mt-3"></div>
            <div id="reviewFormWrap" style="display:none;" class="mt-4">
              <form id="reviewForm" class="card p-3 border-0 shadow-sm">
                <div class="row g-2">
                  <div class="col-md-6"><input id="reviewName" class="form-control" placeholder="Your name" required></div>
                  <div class="col-md-6"><input id="reviewEmail" type="email" class="form-control" placeholder="Email" required></div>
                  <div class="col-12"><select id="reviewRating" class="form-select" required><option value="">Rating</option><option value="5">★★★★★ 5</option><option value="4">★★★★☆ 4</option><option value="3">★★★☆☆ 3</option><option value="2">★★☆☆☆ 2</option><option value="1">★☆☆☆☆ 1</option></select></div>
                  <div class="col-12"><textarea id="reviewText" class="form-control" rows="4" placeholder="Share your experience…" required></textarea></div>
                  <div class="col-md-6"><label class="form-label">Photo (optional)</label><input id="reviewImage" class="form-control" type="file" accept="image/*"></div>
                  <div class="col-md-6"><label class="form-label">Video (optional)</label><input id="reviewVideo" class="form-control" type="file" accept="video/mp4,video/webm"></div>
                  <div class="col-12"><small class="text-muted">You may add one photo and/or one short video with your review.</small></div>
                  <div class="col-12"><button class="btn-gl-primary" type="submit">Submit Review</button></div>
                </div>
              </form>
            </div>
          </section>

          <!-- Suggested -->
          <div class="mt-5 pt-3">
            <h4 class="gl-suggested-title">You may also like</h4>
            <div id="suggestedRow" class="row g-3"></div>
          </div>
        `;

        // ── Read More ──
        const descCollapse = document.getElementById("descCollapse");
        const readMoreBtn  = document.getElementById("readMoreBtn");
        if (readMoreBtn && descCollapse) {
          readMoreBtn.addEventListener("click", () => {
            const expanded = descCollapse.classList.toggle("expanded");
            readMoreBtn.innerHTML = expanded
              ? `Read less <i class="fa fa-chevron-up fa-xs"></i>`
              : `Read more <i class="fa fa-chevron-down fa-xs"></i>`;
          });
        }

        // ── Gallery thumbs ──
        document.querySelectorAll(".gl-thumb, .gl-thumb-video").forEach((thumb) => {
          thumb.addEventListener("click", () => {
            const idx = Number(thumb.dataset.index || 0);
            const carousel = document.querySelector("#productCarousel");
            if (!carousel) return;
            const bs = bootstrap.Carousel.getOrCreateInstance(carousel);
            bs.to(idx);
            document.querySelectorAll(".gl-thumb, .gl-thumb-video").forEach(x => x.classList.remove("active"));
            thumb.classList.add("active");
          });
        });
        const carouselEl = document.getElementById("productCarousel");
        if (carouselEl) {
          carouselEl.addEventListener("slid.bs.carousel", function(e) {
            const idx = e.to || 0;
            document.querySelectorAll(".gl-thumb, .gl-thumb-video").forEach(x => x.classList.remove("active"));
            const t = document.querySelector(`.gl-thumb[data-index="${idx}"], .gl-thumb-video[data-index="${idx}"]`);
            if (t) t.classList.add("active");
          });
        }

        // ── Sticky bar (if present) ──
        const stickyPriceEl = document.getElementById("stickyPrice");
        if (stickyPriceEl) stickyPriceEl.textContent = moneyINR(effectivePrice);
        const stickyAddEl = document.getElementById("stickyAdd");
        if (stickyAddEl) {
          stickyAddEl.onclick = () => addToCart({ id: p.id, name: p.name, price: effectivePrice, image: primaryImage });
        }

        // ── Add to Cart ──
        const addBtn = document.getElementById("addToCartBtn");
        if (addBtn) {
          addBtn.addEventListener("click", () => {
            addToCart({ id: p.id, name: p.name, price: effectivePrice, image: primaryImage });
          });
        }

        // ── Buy Now ──
        const buyBtn = document.getElementById("buyNowBtn");
        if (buyBtn) {
          buyBtn.addEventListener("click", () => {
            const qty = parseInt(document.getElementById("qty")?.value || "1", 10);
            localStorage.setItem("buy_now_item", JSON.stringify({ id: p.id, name: p.name, price: effectivePrice, image: primaryImage, qty }));
            window.location.href = "/checkout.html?buy_now=1";
          });
        }

        // ── Notify ──
        const notifyBtn = document.getElementById("notifyBtn");
        if (notifyBtn) {
          notifyBtn.addEventListener("click", () => showToast("🔔 We'll notify you when this is back in stock."));
        }

        // ── Share ──
        document.getElementById("shareBtn").addEventListener("click", async () => {
          // Try to share the product image as a file + name only
          if (primaryImage && navigator.canShare) {
            try {
              const imgRes = await fetch(mediaSrc(primaryImage));
              const blob   = await imgRes.blob();
              const ext    = (blob.type || "image/jpeg").split("/")[1] || "jpg";
              const file   = new File([blob], `${p.name || "product"}.${ext}`, { type: blob.type });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ title: p.name, files: [file] });
                return;
              }
            } catch (_) { /* fall through to clipboard */ }
          }
          // Fallback: share just the name + url if file share not supported
          if (navigator.share) {
            try {
              await navigator.share({ title: p.name, url: location.href });
              return;
            } catch (_) { /* dismissed or failed */ }
          }
          // Last resort: copy URL
          try { await navigator.clipboard.writeText(location.href); } catch (_) {}
          showToast("🔗 Link copied");
        });

        // ── Reviews ──
        initReviews(p.id);

        // ── Suggested ──
        fetchSuggestedProducts(p.id, 4).then(sug => {
          const sugEl = document.getElementById("suggestedRow");
          if (sugEl) {
            sugEl.innerHTML = sug.map(sp => `
              <div class="col-6 col-md-3">
                <div class="gl-sug-card" onclick="location.href='product.html?id=${sp.id}'">
                  <div class="gl-sug-img-wrap">
                    <img src="${mediaSrc((sp.media && sp.media[0] && sp.media[0].url) || sp.image || '')}"
                         alt="${escapeHtml(sp.name || '')}" loading="lazy" decoding="async"
                         onerror="this.src='/assets/placeholder-local.png'">
                  </div>
                  <div class="gl-sug-info">
                    <div class="gl-sug-name">${escapeHtml(sp.name || '')}</div>
                    <div class="gl-sug-price">${moneyINR(sp.price || 0)}</div>
                  </div>
                </div>
              </div>
            `).join("");
          }
        }).catch(() => {});
      }

      async function fetchSuggestedProducts(currentId, limit = 4) {
        try {
          const all = await fetchJSON(`${API_BASE}/products/`);
          const pool = (Array.isArray(all) ? all : []).filter(p => String(p.id) !== String(currentId));
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          return pool.slice(0, limit);
        } catch (e) { console.warn("Suggested fetch failed", e); return []; }
      }

      function addToCart(p) {
        const qty = parseInt(document.getElementById("qty")?.value || "1", 10) || 1;
        let cart = JSON.parse(localStorage.getItem("cart") || "[]");
        const found = cart.find((i) => String(i.id) === String(p.id));
        if (found) { found.qty = (found.qty || 1) + qty; found.price = Number(p.price || found.price); }
        else cart.push({ id: p.id, name: p.name, price: Number(p.price), image: p.image, qty });
        localStorage.setItem("cart", JSON.stringify(cart));
        showToast("🛒 Added to Cart!");
        window.dispatchEvent(new Event('cart:updated'));
      }

      document.addEventListener("click", (e) => {
        if (e.target.closest(".btn-wishlist")) {
          const id = getProductIdFromURL();
          let wl = JSON.parse(localStorage.getItem("wishlist") || "[]");
          if (!wl.includes(String(id))) { wl.push(String(id)); localStorage.setItem("wishlist", JSON.stringify(wl)); window.dispatchEvent(new Event("wishlist:updated")); showToast("❤️ Added to Wishlist!"); }
          else showToast("💖 Already in Wishlist!");
        }
      });

      function showToast(msg) {
        if (typeof window.notify === 'function') { window.notify(msg); return; }
        const toast = document.createElement("div");
        toast.className = "cart-toast";
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2200);
      }

      async function loadReviews(productId) {
        const list = document.getElementById("reviewList");
        if (!list) return;
        try {
          const reviews = await fetchJSON(`${API_BASE}/reviews/product/${encodeURIComponent(productId)}`);
          if (!reviews.length) {
            list.innerHTML = `<p class="text-muted">No reviews yet. Be the first to review this product.</p>`;
            return;
          }
          list.innerHTML = reviews.map(r => `
            <div class="border-bottom py-3">
              <div class="d-flex justify-content-between gap-2">
                <strong>${escapeHtml(r.name || "Customer")}</strong>
                <span>${"★".repeat(Number(r.rating)||0)}${"☆".repeat(5-(Number(r.rating)||0))}</span>
              </div>
              <div class="small text-muted mb-1">${escapeHtml(r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "")}</div>
              <p class="mb-2">${escapeHtml(r.text || "")}</p>
              ${(r.media||[]).length ? `<div class="d-flex flex-wrap gap-2">${(r.media||[]).map(m => m.type === "video" ? `<video src="${escapeHtml(mediaSrc(m.url))}" controls style="width:180px;max-height:180px;border-radius:10px"></video>` : `<img src="${escapeHtml(mediaSrc(m.url))}" alt="Customer review" style="width:180px;height:180px;object-fit:cover;border-radius:10px">`).join("")}</div>` : ""}
            </div>`).join("");
        } catch (e) {
          list.innerHTML = `<p class="text-muted">Reviews are temporarily unavailable.</p>`;
        }
      }

      function initReviews(productId) {
        loadReviews(productId);
        const open = document.getElementById("openReviewBtn");
        const wrap = document.getElementById("reviewFormWrap");
        const form = document.getElementById("reviewForm");
        if (open && wrap) open.onclick = () => { wrap.style.display = wrap.style.display === "none" ? "block" : "none"; };
        if (form) form.addEventListener("submit", async (e) => {
          e.preventDefault();
          try {
            const fd = new FormData();
            fd.append("productId", String(Number(productId)));
            fd.append("name", document.getElementById("reviewName").value.trim());
            fd.append("email", document.getElementById("reviewEmail").value.trim());
            fd.append("rating", String(Number(document.getElementById("reviewRating").value)));
            fd.append("text", document.getElementById("reviewText").value.trim());
            const imageFile = document.getElementById("reviewImage")?.files?.[0];
            const videoFile = document.getElementById("reviewVideo")?.files?.[0];
            if (imageFile) fd.append("image", imageFile);
            if (videoFile) fd.append("video", videoFile);
            const res = await fetch(`${API_BASE}/reviews`, { method:"POST", body:fd });
            const data = await res.json().catch(()=>({}));
            if (!res.ok) throw new Error(data.msg || "Review submission failed");
            showToast("❤️ Thank you for your review!");
            form.reset(); wrap.style.display="none"; loadReviews(productId);
          } catch(err) { showToast("⚠️ Unable to submit review."); console.error(err); }
        });
      }

      let CURRENT_PRODUCT = null;
      document.addEventListener("DOMContentLoaded", async () => {
        await loadProduct();
        const id = getProductIdFromURL();
        fetchJSON(`${API_BASE}/products/${id}`).then(p => CURRENT_PRODUCT = p).catch(() => {});
      });
    