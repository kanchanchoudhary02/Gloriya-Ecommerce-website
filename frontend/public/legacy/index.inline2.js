(function () {
  const api = window.API_BASE || "https://gloriya.in/api";

  function money(n) {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return "₹" + n;
    }
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function trendProduct(p) {
    const out = Number(p.inventory ?? (p.stock ? 1 : 0)) <= 0 && p.stock === false;
    const image = p.image || (p.media?.find(m => (m?.type || "image") === "image")?.url) || "/assets/placeholder-local.png";
    return `
      <div class="col-md-4 mb-4">
        <div class="trending-card">
          <div class="trending-img">
            <a href="product.html?id=${encodeURIComponent(p.id)}">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async"
                   onerror="this.onerror=null;this.src='/assets/placeholder-local.png';">
            </a>
            <span class="trending-label"><i class="fa-solid fa-fire"></i> Trending</span>
          </div>
          <div class="trending-info">
            <h5>${escapeHtml(p.name)}</h5>
            <div class="trending-price">${money(p.price)}</div>
            ${out ? `<span class="badge bg-secondary rounded-pill px-3 py-2">Out of Stock</span>` : `
              <button class="trending-btn btn-add" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" data-image="${escapeHtml(image)}">
                <i class="fa-solid fa-bag-shopping"></i> Add to Cart
              </button>`}
          </div>
        </div>
      </div>`;
  }

  function trendSlide(products, active = false) {
    return `<div class="carousel-item ${active ? "active" : ""}">
      <div class="row justify-content-center g-3">${products.map(trendProduct).join("")}</div>
    </div>`;
  }

  function wireTrendingCarousel() {
    const carousel = document.getElementById("trendCarousel");
    const inner = document.getElementById("trendInner");
    if (!carousel || !inner) return;

    const slides = inner.querySelectorAll(".carousel-item");
    const prev = carousel.querySelector(".carousel-control-prev");
    const next = carousel.querySelector(".carousel-control-next");
    const hasSlides = slides.length > 1;

    if (prev) prev.disabled = !hasSlides;
    if (next) next.disabled = !hasSlides;
    carousel.classList.toggle("single-slide", !hasSlides);

    if (!hasSlides) return;

    // Use Bootstrap's API explicitly so the arrows work even when the carousel
    // was inserted dynamically after Bootstrap initialized the page.
    if (window.bootstrap?.Carousel) {
      const instance = bootstrap.Carousel.getOrCreateInstance(carousel, {
        interval: 4200,
        ride: false,
        pause: "hover",
        touch: true,
        wrap: true
      });
      prev?.addEventListener("click", e => { e.preventDefault(); instance.prev(); });
      next?.addEventListener("click", e => { e.preventDefault(); instance.next(); });
      instance.cycle();
    }
  }

  async function loadTrending() {
    const wrap = document.getElementById("trendInner");
    if (!wrap) return;
    try {
      const res = await fetch(`${api}/products/?trending=1&limit=4`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Trending products API returned ${res.status}`);
      const products = await res.json();
      const items = Array.isArray(products) ? products.slice(0, 4) : [];
      const origin = new URL(api, window.location.origin).origin;
      const resolve = (url) => {
        if (!url) return "/assets/placeholder-local.png";
        if (/^https?:\/\//i.test(url)) return url;
        return (url.startsWith("/uploads/") || url.startsWith("uploads/"))
          ? origin + "/" + url.replace(/^\//, "")
          : url;
      };
      if (!items.length) {
        wrap.innerHTML = `<div class="carousel-item active"><div class="p-5 text-muted">No trending products selected yet.</div></div>`;
        wireTrendingCarousel();
        return;
      }
      const slides = [];
      for (let i = 0; i < items.length; i += 2) {
        const group = items.slice(i, i + 2);
        slides.push(`<div class="carousel-item ${i === 0 ? "active" : ""}">
          <div class="row justify-content-center g-4">
            ${group.map((product) => {
              const image = resolve(product.image || product.media?.find(m => (m?.type || "image") === "image")?.url);
              return `<div class="col-12 col-md-6">
                <a href="product.html?id=${encodeURIComponent(product.id)}" class="d-block text-decoration-none">
                  <div class="trending-card">
                    <div class="trending-img">
                      <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"
                           onerror="this.onerror=null;this.src='/assets/placeholder-local.png';">
                      <span class="trending-label"><i class="fa-solid fa-fire"></i> Trending</span>
                    </div>
                    <div class="trending-info">
                      <h5>${escapeHtml(product.name)}</h5>
                      <div class="trending-price">${money(product.price)}</div>
                    </div>
                  </div>
                </a>
              </div>`;
            }).join("")}
          </div>
        </div>`);
      }
      wrap.innerHTML = slides.join("");
      wireTrendingCarousel();
    } catch (e) {
      console.error("Trending load error:", e);
      wrap.innerHTML = `<div class="carousel-item active"><div class="p-5 text-muted">Unable to load trending products.</div></div>`;
      wireTrendingCarousel();
    }
  }

  document.addEventListener("DOMContentLoaded", loadTrending);
})();
