// admin.js (corrected)
// NOTE: This file is intended to replace your existing admin.js in admin panel.
// It keeps your original structure but fixes discount handling and cache invalidation bugs,
// and makes product_id comparisons numeric and robust.

const API_BASE = window.API_BASE || ((location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "http://localhost:5000/api" : "https://gloriya-ecommerce-website.onrender.com/api");
const MAX_MEDIA_FILES = 10;

function resolveMediaUrl(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    const apiOrigin = new URL(API_BASE).origin;
    if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
      return `${apiOrigin}/${raw.replace(/^\/+/, "")}`;
    }
    return `${window.location.origin}/${raw.replace(/^\/+/, "")}`;
  } catch {
    return raw;
  }
}

// Attach the login token to every admin API request. The backend is the source of truth.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (url.includes(`${API_BASE}/admin/`) || url.includes(`${API_BASE}/reviews/admin/`)) {
    const token = localStorage.getItem("auth_token") || "";
    const headers = new Headers(init.headers || {});
    headers.set("Accept", headers.get("Accept") || "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    init = { ...init, headers };
  }
  return nativeFetch(input, init).then(res => {
    if ((url.includes(`${API_BASE}/admin/`) || url.includes(`${API_BASE}/reviews/admin/`)) && (res.status === 401 || res.status === 403)) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      window.location.href = "../login.html?error=admin-session";
    }
    return res;
  });
};

const user = JSON.parse(localStorage.getItem("user") || "null");
if (!user || user.role !== "admin" || !localStorage.getItem("auth_token")) {
  window.location.href = "../login.html";
}

/**
 * createPreviewImage helper
 */
function createPreviewImage(src, attrs = {}) {
  const img = document.createElement("img");
  img.src = resolveMediaUrl(src) || "/assets/placeholder-local.png";
  img.onerror = function () {
    this.onerror = null;
    this.src = "/assets/placeholder-local.png";
  };
  Object.entries(attrs).forEach(([k, v]) => img.setAttribute(k, v));
  return img;
}

document.addEventListener("DOMContentLoaded", async () => {
  const adminTabs = document.getElementById("adminTabs");
  if (adminTabs && !adminTabs.querySelector('[data-tab="reviews"]')) {
    adminTabs.insertAdjacentHTML("beforeend", '<li class="nav-item"><a class="nav-link" href="#" data-tab="reviews"><i class="fa-regular fa-star me-1"></i>Reviews</a></li><li class="nav-item"><a class="nav-link" href="#" data-tab="returns"><i class="fa-solid fa-rotate-left me-1"></i>Cancellations & Returns</a></li>');
  }
  loadSummary();
  loadProducts();
  setupTabs();
  bindProductForm();
  bindAttributeButtons();
  bindCategorySizeToggle();
  bindDiscountForm();
  bindDiscountModalProductSearch();
});

// ========== DASHBOARD SUMMARY ==========
async function loadSummary() {
  const container = document.getElementById("summaryCards");
  try {
    const res = await fetch(`${API_BASE}/admin/summary`);
    const stats = await res.json();
    container.innerHTML = `
      <div class="col-md-3"><div class="card p-3"><h5>Users</h5><p>${stats.total_users}</p></div></div>
      <div class="col-md-3"><div class="card p-3"><h5>Products</h5><p>${stats.total_products}</p></div></div>
      <div class="col-md-3"><div class="card p-3"><h5>Orders</h5><p>${stats.total_orders}</p></div></div>
      <div class="col-md-3"><div class="card p-3"><h5>Pending</h5><p>${stats.pending_orders}</p></div></div>
    `;
  } catch (err) {
    console.error("loadSummary error", err);
    container.innerHTML = `<p class="text-danger">Failed to load dashboard.</p>`;
  }
}

// ========== TABS ==========
function setupTabs() {
  const tabs = document.querySelectorAll("#adminTabs .nav-link");
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      tabs.forEach((t) => t.classList.remove("active"));
      // Use currentTarget, not target, so clicking an icon/span inside the tab
      // does not lose the data-tab value.
      e.currentTarget.classList.add("active");
      const tabName = e.currentTarget.dataset.tab;
      if (tabName === "products") loadProducts();
      else if (tabName === "trending") loadTrendingAdmin();
      else if (tabName === "users") loadUsers();
      else if (tabName === "orders") loadOrders();
      else if (tabName === "discounts") loadDiscounts();
      else if (tabName === "reviews") loadAdminReviews();
      else if (tabName === "returns") loadAdminReturns();
      else if (tabName === "summary") {
        // Summary is rendered on the dashboard; keep the tab responsive.
        loadSummary();
      }
    });
  });
}

// ========== USERS ==========
async function loadUsers() {
  const content = document.getElementById("tabContent");
  content.innerHTML = "<p>Loading users...</p>";
  try {
    const res = await fetch(`${API_BASE}/admin/users`);
    const users = await res.json();
    content.innerHTML = `
      <table class="table table-striped">
        <thead><tr><th>Name</th><th>Email</th><th>Orders</th><th>Wishlist</th></tr></thead>
        <tbody>
          ${users
            .map(
              (u) =>
                `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${u.orders || 0}</td><td>${u.wishlist || 0}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("loadUsers error", err);
    content.innerHTML = `<p class="text-danger">Failed to load users.</p>`;
  }
}

// ========== PRODUCTS ==========
async function loadProducts() {
  const content = document.getElementById("tabContent");
  try {
    const res = await fetch(`${API_BASE}/products/`);
    const products = await res.json();

    content.innerHTML = `
      <button class="btn btn-primary mb-3" onclick="openProductModal()">+ Add Product</button>
      <div class="row">
        ${products
          .map((p) => {
            const imgUrl =
              (p.media && p.media[0] && p.media[0].url) ||
              p.image ||
              "";
            const inStock =
              (p.inventory !== undefined)
                ? (p.inventory > 0)
                : (p.stock ? true : false);
            return `
          <div class="col-md-3 mb-3">
            <div class="card p-2 shadow-sm">
              <div class="product-img-holder mb-2 rounded" data-src="${escapeHtml(imgUrl)}" style="height:200px;overflow:hidden;background:#f6f7f8;display:flex;align-items:center;justify-content:center;"></div>
              <h6>${escapeHtml(p.name || "Unnamed")}</h6>
              <p class="text-muted">₹${p.price || 0}</p>
              <span class="badge ${inStock ? "bg-success" : "bg-danger"}">
                ${inStock ? "In Stock" : "Out of Stock"}
              </span>
              ${p.trending ? `<span class="badge bg-warning text-dark ms-1">🔥 Trending</span>` : ""}
              <div class="d-flex gap-2 mt-2">
                <button class="btn btn-sm ${p.trending ? "btn-outline-warning" : "btn-outline-dark"} flex-fill" onclick="toggleProductTrending(${p.id}, ${p.trending ? "false" : "true"})">
                  <i class="fa-solid fa-fire me-1"></i>${p.trending ? "Remove from Trending" : "Add to Trending"}
                </button>
              </div>
              <div class="d-flex gap-2 mt-2">
                <button class="btn btn-sm btn-outline-secondary w-50" onclick="openProductModalById(${p.id})">Edit</button>
                <button class="btn btn-sm btn-outline-danger w-50" onclick="deleteProduct(${p.id})">Delete</button>
              </div>
            </div>
          </div>`;
          })
          .join("")}
      </div>
    `;

    const holders = document.querySelectorAll(".product-img-holder");
    holders.forEach((holder) => {
      const src = holder.dataset.src || "";
      const img = createPreviewImage(src, {
        class: "img-fluid mb-2 rounded",
        style: "height:100%;width:100%;object-fit:cover;display:block;"
      });
      holder.innerHTML = "";
      holder.appendChild(img);
    });
  } catch (err) {
    console.error("loadProducts error", err);
    content.innerHTML = `<p class="text-danger">Failed to load products.</p>`;
  }
}

// ========== TRENDING PRODUCT MANAGEMENT ==========
async function toggleProductTrending(id, enabled) {
  try {
    const res = await fetch(`${API_BASE}/admin/products/${id}/trending`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trending: !!enabled })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.msg || "Unable to update Trending.");
      return;
    }
    await loadProducts();
    await loadTrendingAdmin();
    await loadSummary();
  } catch (e) {
    console.error(e);
    alert("Network error while updating Trending.");
  }
}

async function loadTrendingAdmin() {
  const content = document.getElementById("tabContent");
  if (!content) return;
  content.innerHTML = `
    <div class="admin-trending-panel">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <span class="text-uppercase small fw-semibold text-muted">Homepage control</span>
          <h3 class="mb-1">Trending Products</h3>
          <p class="text-muted mb-0">Choose up to 4 products. The product image itself appears in the Trending section on the homepage.</p>
        </div>
        <span class="badge bg-dark rounded-pill px-3 py-2">Maximum 4</span>
      </div>
      <div id="trendingProductGrid" class="row g-3"></div>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/products/?limit=500`);
    const products = await res.json();
    const selected = (Array.isArray(products) ? products : []).filter(p => p.trending).slice(0, 4);
    const wrap = document.getElementById("trendingProductGrid");
    if (!selected.length) {
      wrap.innerHTML = `<div class="col-12"><div class="alert alert-light border">No trending products selected yet.</div></div>`;
      return;
    }
    wrap.innerHTML = selected.map((p, i) => {
      const img = resolveMediaUrl(p.image || p.media?.[0]?.url);
      return `<div class="col-6 col-md-3">
        <div class="card h-100 border-0 shadow-sm p-2">
          <div style="height:220px;background:#f7f4ef;border-radius:10px;overflow:hidden;">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='/assets/placeholder-local.png'">
          </div>
          <div class="pt-3">
            <div class="small text-muted">Slot ${i + 1}</div>
            <div class="fw-semibold">${escapeHtml(p.name)}</div>
            <button class="btn btn-sm btn-outline-danger w-100 mt-2" onclick="toggleProductTrending(${p.id}, false)"><i class="fa-regular fa-circle-xmark me-1"></i>Remove</button>
          </div>
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    console.error(e);
    content.innerHTML += `<div class="alert alert-danger mt-3">Unable to load Trending products.</div>`;
  }
}

// ========== PRODUCT MODAL (Add/Edit) ==========
function openProductModal(product = null) {
  try {
    if (typeof product === "string") product = JSON.parse(product);
  } catch (e) {}

  const titleEl = document.getElementById("productModalTitle");
  const idEl = document.getElementById("productId");
  const nameEl = document.getElementById("productName");
  const priceEl = document.getElementById("productPrice");
  const descEl = document.getElementById("productDesc");
  const invEl = document.getElementById("productInventory");
  const skuEl = document.getElementById("productSku");
  const catEl = document.getElementById("productCategory");
  const tagsEl = document.getElementById("productTags");
  const attrList = document.getElementById("attributesList");
  const restockEl = document.getElementById("productRestockRequest");
  const trendingEl = document.getElementById("productTrending");
  const shipW = document.getElementById("shipWeight");
  const shipD = document.getElementById("shipDimensions");
  const retP = document.getElementById("returnPolicy");
  const mediaInput = document.getElementById("productMedia");
  const preview = document.getElementById("mediaPreview");

  if (!titleEl || !idEl || !nameEl || !priceEl || !descEl || !invEl || !mediaInput || !preview) {
    return alert("Modal elements not found. Make sure admin.html includes the modal markup with expected IDs.");
  }

  titleEl.textContent = product ? "Edit Product" : "Add Product";
  idEl.value = product ? product.id : "";
  nameEl.value = product ? product.name || "" : "";
  priceEl.value = product ? product.price || 0 : 0;
  descEl.value = product ? product.description || "" : "";
  invEl.value = product ? (product.inventory !== undefined ? product.inventory : (product.stock ? 1 : 0)) : 0;
  skuEl.value = product ? product.sku || "" : "";
  catEl.value = product ? product.category || "" : "";
  tagsEl.value = product ? (product.tags ? product.tags.join(",") : "") : "";
  restockEl.checked = product ? !!product.restock_request : false;
  if (trendingEl) trendingEl.checked = product ? !!product.trending : false;
  shipW.value = product ? (product.shipping ? product.shipping.weight_grams || "" : "") : "";
  shipD.value = product ? (product.shipping ? product.shipping.dimensions || "" : "") : "";
  retP.value = product ? product.return_policy || "" : "";

  const sizeEl = document.getElementById("productSize");
  if (sizeEl) sizeEl.value = product ? (product.size || "") : "";

  attrList.innerHTML = "";
  if (product && product.attributes) {
    Object.entries(product.attributes).forEach(([k, v]) => {
      appendAttributePill(k, v);
    });
  }

  preview.innerHTML = "";
  if (product && product.media && product.media.length) {
    product.media.forEach((m, idx) => {
      addMediaPreviewItem(m.url, m.type || (m.url.match(/\.(mp4|webm)$/i) ? "video" : "image"), m._id || `existing-${idx}`);
    });
  } else if (product && product.image) {
    addMediaPreviewItem(product.image, "image", "existing-legacy");
  }

  mediaInput.value = "";

  const modalEl = document.getElementById("productModal");
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function openProductModalById(id) {
  try {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (!res.ok) {
      alert("Failed to fetch product details for editing");
      return;
    }
    const p = await res.json();
    openProductModal(p);
  } catch (err) {
    console.error("openProductModalById error", err);
    alert("Network error fetching product details");
  }
}

function appendAttributePill(k, v) {
  const attrList = document.getElementById("attributesList");
  const id = `attr-${Math.random().toString(36).slice(2,9)}`;
  const el = document.createElement("span");
  el.className = "badge bg-light border text-dark me-2 mb-2";
  el.id = id;
  el.innerHTML = `<strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)} <a href="#" class="ms-2 text-danger" onclick="removeAttribute('${id}');return false;">&times;</a>`;
  el.dataset.key = k;
  el.dataset.value = v;
  attrList.appendChild(el);
}
function removeAttribute(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function bindAttributeButtons() {
  const addAttrBtn = document.getElementById("addAttrBtn");
  if (!addAttrBtn) return;
  addAttrBtn.onclick = () => {
    const kEl = document.getElementById("attrKey");
    const vEl = document.getElementById("attrValue");
    const k = kEl ? kEl.value.trim() : "";
    const v = vEl ? vEl.value.trim() : "";
    if (!k) return alert("Attribute key required");
    appendAttributePill(k, v);
    if (kEl) kEl.value = "";
    if (vEl) vEl.value = "";
  };
}

// ========== Category -> Size toggle binder ==========
function bindCategorySizeToggle() {
  const catEl = document.getElementById("productCategory");
  const sizeWrap = document.getElementById("categorySizeWrapper");
  if (!catEl || !sizeWrap) return;
  function update() {
    const v = (catEl.value || "").toLowerCase().trim();
    if (v === "ring" || v === "bangles") sizeWrap.style.display = "";
    else sizeWrap.style.display = "none";
  }
  catEl.addEventListener("change", update);
  update();
}
function ensureAdminCategoryOptions() {
  const sel = document.getElementById("productCategory");
  if (!sel) return;
  const canonical = [
    "Ring",
    "Necklace",
    "Bangles",
    "Maang Teeka",
    "Bracelet",
    "Matha Patti",
    "Borla",
    "Western Jewellery",
    "Nose Pin",
    "Watch",
    "Earring"
  ];
  const existing = Array.from(sel.options).map(o => o.value);
  if (existing.length <= 1 || canonical.some(c => !existing.includes(c))) {
    sel.innerHTML = ['<option value="">Select category</option>'].concat(canonical.map(c => `<option value="${c}">${c}</option>`)).join("");
  }
}
ensureAdminCategoryOptions();

function addMediaPreviewItem(url, type, id) {
  const preview = document.getElementById("mediaPreview");
  const wrapper = document.createElement("div");
  wrapper.className = "position-relative d-inline-block me-2 mb-2";
  wrapper.style.width = "120px";
  wrapper.style.height = "90px";
  wrapper.id = `media-${id}`;

  let inner;
  if (type && type.startsWith("video")) {
    inner = document.createElement("video");
    inner.src = url;
    inner.controls = true;
    inner.style.width = "120px";
    inner.style.height = "90px";
    inner.style.objectFit = "cover";
  } else {
    inner = createPreviewImage(url, {
      style: "width:120px;height:90px;object-fit:cover;display:block;border-radius:4px;"
    });
  }

  const del = document.createElement("button");
  del.className = "btn btn-sm btn-danger position-absolute";
  del.style.top = "4px";
  del.style.right = "4px";
  del.style.padding = "2px 6px";
  del.innerText = "×";
  del.onclick = () => wrapper.remove();

  wrapper.appendChild(inner);
  wrapper.appendChild(del);
  preview.appendChild(wrapper);
}

// ========== bindProductForm & upload helpers ==========
function bindProductForm() {
  const productForm = document.getElementById("productForm");
  if (productForm) {
    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleProductSave();
    });
  }

  const mediaInput = document.getElementById("productMedia");
  if (!mediaInput) return;

  mediaInput.onchange = (ev) => {
    const files = Array.from(ev.target.files || []);
    const preview = document.getElementById("mediaPreview");

    const existingCount = preview.querySelectorAll("div[id^='media-']").length;
    if (existingCount + files.length > MAX_MEDIA_FILES) {
      alert(`Max ${MAX_MEDIA_FILES} media files allowed (including existing ones).`);
      mediaInput.value = "";
      return;
    }

    files.forEach((f, idx) => {
      const url = URL.createObjectURL(f);
      addMediaPreviewItem(url, f.type, `new-${Date.now()}-${idx}`);
    });
  };
}

function collectAttributes() {
  const attrList = document.getElementById("attributesList");
  const res = {};
  if (!attrList) return res;
  Array.from(attrList.children).forEach((pill) => {
    const k = pill.dataset.key;
    const v = pill.dataset.value;
    if (k) res[k] = v;
  });
  return res;
}

async function uploadFiles(files) {
  if (!files || !files.length) return [];

  const fd = new FormData();
  files.forEach(f => fd.append("media", f));

  try {
    const upRes = await fetch(`${API_BASE}/admin/uploads`, {
      method: "POST",
      body: fd,
      credentials: "same-origin"
    });

    const raw = await upRes.text();
    let json;
    try { json = JSON.parse(raw); } catch(e) { json = null; }

    console.log("Upload response status:", upRes.status, "body:", raw);

    if (!upRes.ok) {
      alert("Media upload failed: " + (json?.msg || raw || ("HTTP " + upRes.status)));
      return null;
    }

    return (json && json.media) ? json.media : [];
  } catch (err) {
    console.error("Upload network error:", err);
    alert("Network error during media upload: " + (err.message || err));
    return null;
  }
}

async function handleProductSave() {
  const id = document.getElementById("productId").value;
  const name = document.getElementById("productName").value.trim();
  const price = Number(document.getElementById("productPrice").value) || 0;
  const description = document.getElementById("productDesc").value.trim();
  const inventory = parseInt(document.getElementById("productInventory").value || "0", 10);
  const sku = document.getElementById("productSku").value.trim();
  const category = document.getElementById("productCategory").value.trim();
  const tags = (document.getElementById("productTags").value || "").split(",").map(t => t.trim()).filter(Boolean);
  const restock_request = document.getElementById("productRestockRequest").checked;
  const trending = !!document.getElementById("productTrending")?.checked;
  const shipping = {
    weight_grams: Number(document.getElementById("shipWeight").value || 0),
    dimensions: document.getElementById("shipDimensions").value.trim()
  };
  const return_policy = document.getElementById("returnPolicy").value.trim();
  const attributes = collectAttributes();
  const size = (document.getElementById("productSize")?.value || "").trim();

  const mediaInput = document.getElementById("productMedia");
  const files = Array.from(mediaInput.files || []);
  const preview = document.getElementById("mediaPreview");

  const existingMedia = [];
  preview.querySelectorAll("div[id^='media-']").forEach((w) => {
    const imgOrVideo = w.querySelector("img,video");
    if (!imgOrVideo) return;
    const src = imgOrVideo.src || "";
    if (!src.startsWith("blob:")) {
      existingMedia.push(src);
    }
  });

  if (existingMedia.length + files.length > MAX_MEDIA_FILES) {
    alert(`Total media (existing + new) must be ${MAX_MEDIA_FILES} or fewer.`);
    return;
  }

  let uploadedMedia = [];
  if (files.length) {
    const result = await uploadFiles(files);
    if (result === null) {
      return;
    }
    uploadedMedia = result;
    uploadedMedia = uploadedMedia.map((m) => {
      if (typeof m === "string") {
        return { url: m, type: m.match(/\.(mp4|webm)/i) ? "video" : "image" };
      }
      return m;
    });
  }

  const media = [];
  existingMedia.forEach((u) => media.push({ url: u, type: u.match(/\.(mp4|webm)/i) ? "video" : "image" }));
  uploadedMedia.forEach((m) => media.push(m));

  const firstImage = media.find((m) => (m.type || "").startsWith("image")) || media[0] || null;

  const payload = {
    name,
    price,
    description,
    inventory,
    sku,
    category,
    tags,
    restock_request,
    trending,
    shipping,
    return_policy,
    attributes,
    media,
    size
  };
  if (firstImage && firstImage.url) payload.image = firstImage.url;

  const method = id ? "PUT" : "POST";
  const url = id ? `${API_BASE}/admin/products/${id}` : `${API_BASE}/admin/products`;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Save product failed:", res.status, text);
      alert("Failed to save product");
      return;
    }

    // hide modal and refresh
    const modalEl = document.getElementById("productModal");
    bootstrap.Modal.getInstance(modalEl).hide();
    loadProducts();
    loadSummary();
  } catch (err) {
    console.error("handleProductSave error", err);
    alert("Network error saving product");
  }
}

// Delete product
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/products/${id}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }
    loadProducts();
    loadSummary();
  } catch (err) {
    console.error("deleteProduct error", err);
    alert("Network error deleting product");
  }
}

// ========== ORDERS ==========
async function loadOrders() {
  const content = document.getElementById("tabContent");
  content.innerHTML = "<p>Loading orders...</p>";
  try {
    const res = await fetch(`${API_BASE}/admin/orders`);
    const orders = await res.json();

    if (!orders || !orders.length) {
      content.innerHTML = "<p>No orders yet.</p>";
      return;
    }

    content.innerHTML = `
      <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Buyer</th>
            <th>Amount</th>
            <th>Items</th>
            <th>Status</th>
            <th>Placed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o) => `
            <tr>
              <td>${o.id} <br><small class="text-muted">${escapeHtml(o.order_id || "")}</small></td>
              <td>${escapeHtml(o.name || "")}<br><small>${escapeHtml(o.user_email || "")}</small></td>
              <td>₹${o.amount || 0}</td>
              <td>${(o.items || []).length}</td>
              <td>
                <select class="form-select form-select-sm admin-order-status"
                        style="min-width:190px;font-size:14px;font-weight:500"
                        aria-label="Update order status"
                        onchange="adminChangeOrderStatus(${o.id}, this.value)">
                  ${[
                    ["created","Created"],["completed","Payment Completed"],["packed","Packed"],
                    ["shipped","Shipped"],["out_for_delivery","Out for Delivery"],
                    ["delivered","Delivered"],["cancelled","Cancelled"]
                  ].map(pair => `<option value="${pair[0]}" ${String(o.status||"created")===pair[0]?"selected":""}>${pair[1]}</option>`).join("")}
                </select>
              </td>
              <td>${escapeHtml(o.timestamp || "")}</td>
              <td>
                <button class="btn btn-sm btn-outline-primary" onclick="adminViewOrder(${o.id})">View</button>
                <a class="btn btn-sm btn-outline-dark" target="_blank" href="${API_BASE}/orders/${encodeURIComponent(o.order_id || "")}/receipt?shop=1">Receipt</a>
                <small class="text-muted d-block mt-1">Changing to Packed / Shipped / Out for Delivery emails the customer automatically.</small>
                <button class="btn btn-sm btn-danger" onclick="adminDeleteOrderConfirm(${o.id})">Delete</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      </div>
    `;
  } catch (err) {
    console.error("loadOrders error", err);
    content.innerHTML = `<p class="text-danger">Failed to load orders.</p>`;
  }
}

async function adminViewOrder(orderId) {
  try {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}`);
    if (!res.ok) {
      alert("Failed to fetch order details");
      return;
    }
    const o = await res.json();
    const body = document.getElementById("orderModalBody");
    const itemsHtml = (o.items || [])
      .map(
        (it, idx) => `
      <li class="d-flex align-items-center mb-2">
        <div class="order-item-img me-3" data-src="${escapeHtml(it.image || "")}" style="width:60px;height:60px;overflow:hidden;border-radius:6px;display:flex;align-items:center;justify-content:center;"></div>
        <div>
          <div><strong>${escapeHtml(it.name)}</strong></div>
          <div>Qty: ${it.qty || 1} · ₹${it.price || 0}</div>
        </div>
      </li>`
      )
      .join("");

    body.innerHTML = `
      <h5>Order #${o.id}</h5>
      <p><strong>Razorpay Order ID:</strong> ${escapeHtml(o.order_id || "")}</p>
      <p><strong>Buyer:</strong> ${escapeHtml(o.name || "")} — ${escapeHtml(o.user_email || "")} — ${escapeHtml(o.phone || "")}</p>
      <p><strong>Shipping:</strong> ${escapeHtml(o.address || "")} ${escapeHtml(o.city || "")} ${escapeHtml(o.pincode || "")}</p>
      <p><strong>Amount:</strong> ₹${o.amount || 0}</p>
      <p><strong>Status:</strong> ${escapeHtml(o.status || "")}</p>
      <hr/>
      <h6>Items</h6>
      <ul class="list-unstyled">${itemsHtml}</ul>
      <hr/>
      <small class="text-muted">Placed: ${escapeHtml(o.timestamp || "")}</small>
    `;

    const holders = body.querySelectorAll(".order-item-img");
    holders.forEach((holder) => {
      const src = holder.dataset.src || "";
      const img = createPreviewImage(src, { style: "width:60px;height:60px;object-fit:cover;display:block;border-radius:6px;" });
      holder.innerHTML = "";
      holder.appendChild(img);
    });

    const deleteBtn = document.getElementById("adminDeleteOrderBtn");
    if (deleteBtn) deleteBtn.onclick = () => adminDeleteOrderConfirm(o.id);

    const modalEl = document.getElementById("orderModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  } catch (err) {
    console.error("adminViewOrder error", err);
    alert("Failed to open order details");
  }
}

async function adminChangeOrderStatus(id, status) {
  if (!confirm(`Change order ${id} to "${status}"?`)) return;
  try {
    const res = await fetch(`${API_BASE}/admin/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "same-origin"
    });
    if (!res.ok) {
      alert("Failed to update order status");
      return;
    }
    loadOrders();
  } catch (err) {
    console.error("adminChangeOrderStatus error", err);
    alert("Network error");
  }
}

function adminDeleteOrderConfirm(id) {
  if (!confirm("Are you sure you want to delete this order? This cannot be undone.")) return;
  adminDeleteOrder(id);
}

async function adminDeleteOrder(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/orders/${id}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    if (!res.ok) {
      alert("Failed to delete order");
      return;
    }
    loadOrders();
    loadSummary();
  } catch (err) {
    console.error("adminDeleteOrder error", err);
    alert("Network error deleting order");
  }
}

// ----------------------------
// DISCOUNTS (file-backed)
// ----------------------------

let DISCOUNTS_CACHE = null;

// helper: normalize product_ids to numbers and discount fields
function normalizeDiscounts(discounts) {
  if (!Array.isArray(discounts)) return [];
  return discounts.map(d => {
    const copy = Object.assign({}, d);
    // ensure type/value defaults
    copy.type = String(copy.type || "percentage");
    copy.value = Number(copy.value || 0);
    copy.active = !!copy.active;
    // normalize product_ids to numbers (empty -> [])
    if (Array.isArray(copy.product_ids)) {
      copy.product_ids = copy.product_ids.map(x => Number(x)).filter(n => !isNaN(n));
    } else {
      copy.product_ids = [];
    }
    return copy;
  });
}

async function readDiscountsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/admin/discounts`);
    if (!res.ok) {
      DISCOUNTS_CACHE = [];
      return DISCOUNTS_CACHE;
    }
    const d = await res.json();
    DISCOUNTS_CACHE = normalizeDiscounts(Array.isArray(d) ? d : []);
    return DISCOUNTS_CACHE;
  } catch (e) {
    console.warn("readDiscountsFromApi error", e);
    DISCOUNTS_CACHE = [];
    return DISCOUNTS_CACHE;
  }
}

// GET discounts
async function loadDiscounts() {
  const content = document.getElementById("tabContent");
  content.innerHTML = "<p>Loading discounts...</p>";
  try {
    const discs = await readDiscountsFromApi();
    content.innerHTML = `
      <div class="mb-3">
        <button class="btn btn-primary" onclick="openDiscountModal()">+ Add Discount</button>
      </div>
      <table class="table table-striped">
        <thead><tr><th>Title</th><th>Type</th><th>Value</th><th>Applies to</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
        ${discs.map(d => `<tr>
           <td>${escapeHtml(d.title)}</td>
           <td>${escapeHtml(d.type)}</td>
           <td>${escapeHtml(String(d.value))}</td>
           <td>${(d.product_ids && d.product_ids.length) ? d.product_ids.join(",") : "All"}</td>
           <td>${d.active ? "Yes":"No"}</td>
           <td>
              <button class="btn btn-sm btn-outline-secondary" onclick="editDiscount(${d.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteDiscount(${d.id})">Delete</button>
           </td>
        </tr>`).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("loadDiscounts error", err);
    content.innerHTML = '<p class="text-danger">Failed to load discounts.</p>';
  }
}

// POST create discount
async function createDiscountRequest(payload) {
  // ensure product_ids are numbers
  payload.product_ids = Array.isArray(payload.product_ids) ? payload.product_ids.map(n => Number(n)).filter(x => !isNaN(x)) : [];
  const res = await fetch(`${API_BASE}/admin/discounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin"
  });
  // invalidate caches on successful create (handled by caller)
  return res;
}

// PUT update discount
async function updateDiscountRequest(id, payload) {
  payload.product_ids = Array.isArray(payload.product_ids) ? payload.product_ids.map(n => Number(n)).filter(x => !isNaN(x)) : [];
  const res = await fetch(`${API_BASE}/admin/discounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin"
  });
  return res;
}

// Delete
async function deleteDiscount(id) {
  if (!confirm("Delete discount?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/discounts/${id}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    if (!res.ok) {
      const text = await res.text();
      alert("Delete failed: " + text);
      return;
    }
    // invalidate caches used by frontend/site after successful delete
    DISCOUNTS_CACHE = null;
    _ADMIN_DISCOUNTS_CACHE = null;
    SITE_DISCOUNTS = [];
    loadDiscounts();
  } catch (err) {
    console.error("deleteDiscount error", err);
    alert("Network error");
  }
}

// ==============================
// Product search for discount modal
// ==============================
let DISCOUNT_PRODUCTS_CACHE = null; // cached product list for searching
let DISCOUNT_SELECTED_IDS = new Set(); // selected product ids for current modal

async function loadProductsForDiscounts() {
  if (DISCOUNT_PRODUCTS_CACHE) return DISCOUNT_PRODUCTS_CACHE;
  try {
    const res = await fetch(`${API_BASE}/products/`);
    if (!res.ok) return [];
    const data = await res.json();
    DISCOUNT_PRODUCTS_CACHE = Array.isArray(data) ? data : [];
    return DISCOUNT_PRODUCTS_CACHE;
  } catch (e) {
    console.warn("loadProductsForDiscounts error", e);
    DISCOUNT_PRODUCTS_CACHE = [];
    return [];
  }
}

function renderDiscountProductResults(query = "") {
  const container = document.getElementById("discountProductResults");
  if (!container) return;
  const q = String(query || "").toLowerCase().trim();

  const list = (DISCOUNT_PRODUCTS_CACHE || []).filter(p => {
    if (!q) return true;
    const idMatch = String(p.id || "").includes(q);
    const nameMatch = (p.name || "").toLowerCase().includes(q);
    const skuMatch = (p.sku || "").toLowerCase().includes(q);
    return idMatch || nameMatch || skuMatch;
  }).slice(0, 200);

  container.innerHTML = list.map(p => {
    const checked = DISCOUNT_SELECTED_IDS.has(Number(p.id)) ? "checked" : "";
    const label = `${p.id} · ${escapeHtml(p.name || "")}${p.sku ? " · " + escapeHtml(p.sku) : ""}`;
    return `<label class="list-group-item list-group-item-action">
      <input class="form-check-input me-2" type="checkbox" value="${p.id}" ${checked}
             onchange="toggleDiscountProductSelection(${p.id}, ${JSON.stringify(label)})" />
      ${label}
    </label>`;  
  }).join("");
}

function toggleDiscountProductSelection(id, label) {
  const numericId = Number(id);
  if (DISCOUNT_SELECTED_IDS.has(numericId)) DISCOUNT_SELECTED_IDS.delete(numericId);
  else DISCOUNT_SELECTED_IDS.add(numericId);
  renderSelectedProductChips();
}

function renderSelectedProductChips() {
  const container = document.getElementById("discountSelectedProducts");
  if (!container) return;
  if (!DISCOUNT_SELECTED_IDS.size) {
    container.innerHTML = `<small class="text-muted">No products selected — discount will apply to ALL products unless you select specific ones.</small>`;
    return;
  }
  const chips = Array.from(DISCOUNT_SELECTED_IDS).map(id => {
    const p = (DISCOUNT_PRODUCTS_CACHE || []).find(x => Number(x.id) === Number(id));
    const title = p ? `${p.id} · ${p.name}${p.sku ? " · " + p.sku : ""}` : String(id);
    return `<span class="badge bg-light border text-dark me-2 mb-2">
      ${escapeHtml(title)} <a href="#" onclick="removeSelectedDiscountProduct(${id});return false;" class="ms-2 text-danger">&times;</a>
    </span>`;
  }).join("");
  container.innerHTML = chips + ` <button class="btn btn-sm btn-outline-secondary" onclick="clearSelectedDiscountProducts()">Clear</button>`;
}

function removeSelectedDiscountProduct(id) {
  DISCOUNT_SELECTED_IDS.delete(Number(id));
  const cb = document.querySelector(`#discountProductResults input[type="checkbox"][value="${id}"]`);
  if (cb) cb.checked = false;
  renderSelectedProductChips();
}
function clearSelectedDiscountProducts() {
  DISCOUNT_SELECTED_IDS.clear();
  document.querySelectorAll("#discountProductResults input[type='checkbox']").forEach(cb => cb.checked = false);
  renderSelectedProductChips();
}

function bindDiscountModalProductSearch() {
  const search = document.getElementById("discountProductSearch");
  const clearBtn = document.getElementById("clearProductSearch");
  if (!search) return;
  let t;
  search.addEventListener("input", async (e) => {
    clearTimeout(t);
    t = setTimeout(async () => {
      await loadProductsForDiscounts();
      renderDiscountProductResults(search.value);
    }, 200);
  });
  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      search.value = "";
      renderDiscountProductResults("");
    });
  }
}

// Utilities for datetime-local <-> ISO
function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}
function localInputToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ========== DISCOUNTS UI functions ==========
async function openDiscountModal(discount = null) {
  function waitForEl(id, timeout = 1000) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        const el = document.getElementById(id);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return resolve(null);
        setTimeout(check, 50);
      })();
    });
  }

  const modalRoot = await waitForEl("discountModal", 1000);
  const idEl = await waitForEl("discountId", 1000);
  const titleEl = await waitForEl("discountTitle", 1000);
  const typeEl = await waitForEl("discountType", 1000);
  const valueEl = await waitForEl("discountValue", 1000);
  const activeEl = await waitForEl("discountActive", 1000);
  const startsAtEl = await waitForEl("discountStartsAt", 1000);
  const endsAtEl = await waitForEl("discountEndsAt", 1000);
  const searchEl = document.getElementById("discountProductSearch");
  const resultsEl = document.getElementById("discountProductResults");

  if (!modalRoot || !idEl || !titleEl || !typeEl || !valueEl || !activeEl || !startsAtEl || !endsAtEl) {
    console.error("Discount modal markup not found. Make sure the discount modal HTML is present in admin.html with correct IDs (discountId, discountTitle, discountType, discountValue, discountActive, discountStartsAt, discountEndsAt).");
    alert("Discount modal is not available on this page (missing HTML). Please ensure admin.html includes the Discount Modal markup before admin.js is loaded.");
    return;
  }

  // reset selection cache for this modal
  DISCOUNT_SELECTED_IDS = new Set();

  idEl.value = discount ? discount.id : "";
  titleEl.value = discount ? (discount.title || "") : "";
  typeEl.value = discount ? (discount.type || "percentage") : "percentage";
  valueEl.value = discount ? (discount.value || 0) : "";
  const rawIds = document.getElementById("discountProductIds");
  if (rawIds) rawIds.value = "";

  activeEl.value = discount ? (discount.active ? "1" : "0") : "1";
  startsAtEl.value = discount ? (isoToLocalInput(discount.starts_at) || "") : "";
  endsAtEl.value = discount ? (isoToLocalInput(discount.ends_at) || "") : "";

  if (discount && Array.isArray(discount.product_ids) && discount.product_ids.length) {
    discount.product_ids.forEach(id => {
      DISCOUNT_SELECTED_IDS.add(Number(id));
    });
  } else {
    DISCOUNT_SELECTED_IDS.clear();
  }

  if (typeof loadProductsForDiscounts === "function") {
    try {
      await loadProductsForDiscounts();
      if (resultsEl) renderDiscountProductResults((searchEl && searchEl.value) || "");
      if (typeof renderSelectedProductChips === "function") renderSelectedProductChips();
    } catch (e) {
      console.warn("Failed to initialize product search inside discount modal:", e);
    }
  }

  try {
    const modal = new bootstrap.Modal(modalRoot);
    modal.show();
    document.getElementById("discountModalTitle").textContent = discount ? "Edit Discount" : "Create Discount";
  } catch (e) {
    console.error("Failed to show discount modal", e);
  }
}

async function editDiscount(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/discounts`);
    if (!res.ok) throw new Error("Failed to fetch");
    const discs = await res.json();
    const d = discs.find(x => x.id === id);
    if (!d) return alert("Discount not found");
    openDiscountModal(d);
  } catch (err) {
    console.error("editDiscount error", err);
    alert("Failed to load discount");
  }
}

// Bind discount form submit
function bindDiscountForm() {
  const form = document.getElementById("discountForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("discountId").value;
    const title = (document.getElementById("discountTitle").value || "").trim();
    const type = document.getElementById("discountType").value;
    const value = Number(document.getElementById("discountValue").value || 0);

    const product_ids = Array.from(DISCOUNT_SELECTED_IDS).map(n => Number(n));

    const active = document.getElementById("discountActive").value === "1";
    const startsLocal = (document.getElementById("discountStartsAt").value || "").trim();
    const endsLocal = (document.getElementById("discountEndsAt").value || "").trim();
    const starts_at = startsLocal ? localInputToIso(startsLocal) : null;
    const ends_at = endsLocal ? localInputToIso(endsLocal) : null;

    const payload = { title, type, value, product_ids, active, starts_at, ends_at };

    try {
      const url = id ? `${API_BASE}/admin/discounts/${id}` : `${API_BASE}/admin/discounts`;
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin"
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Save failed: " + txt);
        return;
      }
      // Invalidate frontend caches so shop/product pages can pick up changes
      DISCOUNTS_CACHE = null;
      _ADMIN_DISCOUNTS_CACHE = null;
      SITE_DISCOUNTS = [];

      const modalEl = document.getElementById("discountModal");
      bootstrap.Modal.getInstance(modalEl).hide();
      loadDiscounts();
    } catch (err) {
      console.error("bindDiscountForm save error", err);
      alert("Network error saving discount");
    }
  });
}

// Utility: fetch discounts cache (for shop/product pages to apply)
let _ADMIN_DISCOUNTS_CACHE = null;
async function fetchAdminDiscounts() {
  if (_ADMIN_DISCOUNTS_CACHE) return _ADMIN_DISCOUNTS_CACHE;
  try {
    const res = await fetch(`${API_BASE}/admin/discounts`);
    if (res.ok) {
      const d = await res.json();
      _ADMIN_DISCOUNTS_CACHE = normalizeDiscounts(Array.isArray(d) ? d : []);
      return _ADMIN_DISCOUNTS_CACHE;
    }
  } catch(e) { console.warn(e); }
  return [];
}

// applyDiscounts improved: numeric comparisons & sensible rounding
function applyDiscounts(price, productId, discounts) {
  let final = Number(price) || 0;
  const pid = Number(productId);
  (discounts || []).forEach(d => {
    if (!d || !d.active) return;
    // starts_at / ends_at checks
    if (d.starts_at) {
      const s = Date.parse(d.starts_at);
      if (!isNaN(s) && Date.now() < s) return;
    }
    if (d.ends_at) {
      const e = Date.parse(d.ends_at);
      if (!isNaN(e) && Date.now() > e) return;
    }
    // if product_ids specified and numeric, require match
    if (Array.isArray(d.product_ids) && d.product_ids.length) {
      const ids = d.product_ids.map(x => Number(x)).filter(n => !isNaN(n));
      if (!ids.includes(pid)) return;
    }
    if (d.type === "percentage") final = final * (1 - (Number(d.value) || 0) / 100);
    else final = final - (Number(d.value) || 0);
  });
  // round to integer rupees
  return Math.max(0, Math.round(final));
}

// small helper
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"'\/]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;"}[c]));
}

// Expose a global helper to allow other frontend pages to get fresh discounts
// (shop/product pages call fetchAdminDiscounts() or window.getSiteDiscounts())
let SITE_DISCOUNTS = [];
async function getSiteDiscounts(force = false) {
  try {
    if (!force && SITE_DISCOUNTS && SITE_DISCOUNTS.length) return SITE_DISCOUNTS;
    const res = await fetch(`${API_BASE}/admin/discounts`);
    if (!res.ok) {
      SITE_DISCOUNTS = [];
      return SITE_DISCOUNTS;
    }
    const raw = await res.json();
    SITE_DISCOUNTS = normalizeDiscounts(Array.isArray(raw) ? raw : []);
    return SITE_DISCOUNTS;
  } catch (e) {
    console.warn("getSiteDiscounts error", e);
    SITE_DISCOUNTS = [];
    return SITE_DISCOUNTS;
  }
}

// admin.js (continued — PART 2/2)

// ==============================
// End of discounts UI functions
// ==============================

// Helper: force refresh caches (call after admin changes)
function invalidateDiscountCaches() {
  DISCOUNTS_CACHE = null;
  _ADMIN_DISCOUNTS_CACHE = null;
  SITE_DISCOUNTS = [];
  DISCOUNT_PRODUCTS_CACHE = null;
  // if other pages have a global hook, dispatch event to signal update
  try { window.dispatchEvent(new CustomEvent('discounts:updated')); } catch (e) {}
}

// Re-exported helpers for other frontends (window-scoped)
window.getSiteDiscounts = getSiteDiscounts;
window.applyDiscountsToPrice = function(price, productId) {
  // convenience wrapper: use SITE_DISCOUNTS if available, else fetch
  if (SITE_DISCOUNTS && SITE_DISCOUNTS.length) return applyDiscounts(price, productId, SITE_DISCOUNTS);
  // fallback: synchronous-ish by returning price and kicking off refresh (best-effort)
  getSiteDiscounts().then(() => {
    try {
      window.dispatchEvent(new CustomEvent('discounts:updated'));
    } catch (e) {}
  }).catch(()=>{});
  return applyDiscounts(price, productId, []); // no discounts yet
};

// Bind an event so other pages can refresh local SITE_DISCOUNTS when admin updates happen
document.addEventListener('discounts:updated', async () => {
  try {
    SITE_DISCOUNTS = await getSiteDiscounts(true);
  } catch(e) { SITE_DISCOUNTS = []; }
});

// Make create/update/delete wrappers that also invalidate caches locally after success
async function createDiscount(payload) {
  const res = await createDiscountRequest(payload);
  if (res && res.ok) invalidateDiscountCaches();
  return res;
}
async function updateDiscount(id, payload) {
  const res = await updateDiscountRequest(id, payload);
  if (res && res.ok) invalidateDiscountCaches();
  return res;
}

// for deleteDiscount we already invalidate caches inside that function on success

// Lightweight admin-only helper: preview discount effect in modal (optional)
function previewDiscountOnProduct(productId) {
  try {
    const priceEl = document.getElementById("previewPrice");
    const priceRaw = Number(document.getElementById("previewRawPrice")?.value || 0);
    const ds = DISCOUNTS_CACHE || [];
    const discounted = applyDiscounts(priceRaw, productId, ds);
    if (priceEl) {
      if (discounted < priceRaw) {
        priceEl.innerHTML = `<span class="small text-muted text-decoration-line-through">₹${priceRaw}</span> <span class="fw-bold">₹${discounted}</span>`;
      } else {
        priceEl.textContent = `₹${priceRaw}`;
      }
    }
  } catch (e) { console.warn(e); }
}

// Small utility: when admin logs out, clear caches
function adminLogout() {
  localStorage.removeItem("user");
  invalidateDiscountCaches();
  window.location.href = "../login.html";
}

// Export some helpers for console debugging
window._admin_helpers = {
  readDiscountsFromApi,
  normalizeDiscounts,
  invalidateDiscountCaches,
  getSiteDiscounts,
  applyDiscounts
};

// final safety: attempt to warm cache on load so site pages using same origin receive updated discounts quickly
(async function warmDiscountCache() {
  try {
    await getSiteDiscounts();
  } catch (e) { /* ignore */ }
})();

// End of corrected admin.js


// ========== REVIEWS MANAGEMENT ==========
async function loadAdminReviews(){
  const content=document.getElementById("tabContent"); content.innerHTML="<p>Loading reviews...</p>";
  try{
    const res=await fetch(`${API_BASE}/reviews/admin/all`); const reviews=await res.json();
    content.innerHTML=`<div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="mb-1">Customer Reviews</h4><p class="text-muted mb-0">Review text, ratings and optional customer media.</p></div><span class="badge bg-dark">${reviews.length} reviews</span></div>${reviews.length?`<div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Review</th><th>Media</th><th>Action</th></tr></thead><tbody>${reviews.map(r=>`<tr><td>${escapeHtml(r.productId)}</td><td>${escapeHtml(r.name)}<br><small>${escapeHtml(r.email)}</small></td><td>${"★".repeat(Number(r.rating)||0)}${"☆".repeat(5-(Number(r.rating)||0))}</td><td style="max-width:280px">${escapeHtml(r.text)}</td><td>${(r.media||[]).map(m=>m.type==='video'?`<a target="_blank" href="${escapeHtml(resolveMediaUrl(m.url))}">Video</a>`:`<a target="_blank" href="${escapeHtml(resolveMediaUrl(m.url))}">Image</a>`).join(" · ")||"—"}</td><td><button class="btn btn-sm btn-danger" onclick="deleteAdminReview('${escapeHtml(r._id)}')">Delete</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="alert alert-light border">No customer reviews yet.</div>`}`;
  }catch(e){console.error(e);content.innerHTML=`<p class="text-danger">Failed to load reviews.</p>`;}
}
async function deleteAdminReview(id){ if(!confirm("Delete this review permanently?"))return; const res=await fetch(`${API_BASE}/reviews/admin/${encodeURIComponent(id)}`,{method:"DELETE"}); const data=await res.json().catch(()=>({})); if(!res.ok)return alert(data.msg||"Unable to delete review"); loadAdminReviews(); }

// ========== CANCELLATIONS & RETURNS ==========
async function loadAdminReturns(){
  const content=document.getElementById("tabContent"); content.innerHTML="<p>Loading cancellations and returns...</p>";
  try{
    const [cr,rr]=await Promise.all([fetch(`${API_BASE}/admin/cancellations`),fetch(`${API_BASE}/admin/returns`)]);
    const cancellations=await cr.json(), returns=await rr.json();
    content.innerHTML=`<div class="row g-4">
      <div class="col-12"><div class="card border-0 shadow-sm"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2"><div><h4>Cancelled Orders</h4><p class="text-muted mb-0">Customer cancellations and refund management.</p></div>
        <select id="cancelFilter" class="form-select" style="max-width:230px"><option value="all">All cancellations</option><option value="customer">Cancelled by Customer</option><option value="admin">Cancelled by Store/Admin</option></select></div>
        <div class="table-responsive mt-3"><table class="table align-middle"><thead><tr><th>Order</th><th>Customer</th><th>Source</th><th>Reason</th><th>Amount</th><th>Refund Payment</th><th>Date</th></tr></thead><tbody id="cancelRows"></tbody></table></div>
      </div></div></div>
      <div class="col-12"><div class="card border-0 shadow-sm"><div class="card-body"><h4>Return Requests</h4><p class="text-muted">Approve/reject returns and process refunds for paid orders.</p>${returns.length?`<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Order</th><th>Customer</th><th>Reason</th><th>Details</th><th>Status</th><th>Refund</th><th>Action</th></tr></thead><tbody>${returns.map(r=>`<tr><td>${escapeHtml(r.order_id)}</td><td>${escapeHtml(r.user_email||"")}</td><td>${escapeHtml(r.reason||"—")}</td><td style="max-width:240px">${escapeHtml(r.details||"—")}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.refund_status||"pending")}${r.refund_id?`<br><small>${escapeHtml(r.refund_id)}</small>`:""}${r.refund_error?`<br><small class="text-danger">${escapeHtml(r.refund_error)}</small>`:""}</td><td>${r.status==='pending'?`<div class="d-flex gap-1"><button class="btn btn-sm btn-success" onclick="decideReturn('${escapeHtml(r._id)}','approve')">Approve</button><button class="btn btn-sm btn-outline-danger" onclick="decideReturn('${escapeHtml(r._id)}','reject')">Reject</button></div>`:r.refund_status==='failed'?`<button class="btn btn-sm btn-warning" onclick="retryReturnRefund('${escapeHtml(r._id)}')">Retry Refund</button>`:`—`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="alert alert-light border">No return requests.</div>`}</div></div></div></div>`;
    const rows=document.getElementById("cancelRows");
    const renderCancellations=(filter="all")=>{
      const list=(cancellations||[]).filter(o=>filter==="all" || String(o.cancel_source||"admin")===filter);
      rows.innerHTML=list.length?list.map(o=>`<tr><td><strong>${escapeHtml(o.order_id)}</strong></td><td>${escapeHtml(o.name||"")}<br><small>${escapeHtml(o.user_email||"")}</small></td><td><span class="badge ${o.cancel_source==='customer'?'bg-warning text-dark':'bg-secondary'}">${o.cancel_source==='customer'?'Cancelled by Customer':'Cancelled by Store/Admin'}</span></td><td>${escapeHtml(o.cancel_reason||"—")}</td><td>₹${o.amount||0}</td><td><span class="badge ${o.refund_status==='processed'?'bg-success':o.refund_status==='failed'?'bg-danger':'bg-secondary'}">${escapeHtml(o.refund_status||"pending")}</span>${o.refund_id?`<br><small>${escapeHtml(o.refund_id)}</small>`:""}${o.refund_error?`<br><small class="text-danger">${escapeHtml(o.refund_error)}</small>`:""}${o.cancel_source==='customer'&&o.refund_status!=='processed'?`<br><button class="btn btn-sm btn-warning mt-1" onclick="refundCancelledOrder('${escapeHtml(o.order_id)}')">Refund Payment</button>`:""}</td><td>${escapeHtml(o.cancelledAt||o.updatedAt||"")}</td></tr>`).join(""):`<tr><td colspan="7" class="text-muted text-center py-4">No cancelled orders for this filter.</td></tr>`;
    };
    renderCancellations();
    document.getElementById("cancelFilter")?.addEventListener("change",e=>renderCancellations(e.target.value));
  }catch(e){console.error(e);content.innerHTML=`<p class="text-danger">Failed to load cancellations and returns.</p>`;}
}

async function refundCancelledOrder(orderId){
  if(!confirm("Refund this cancelled customer's payment through Razorpay?")) return;
  const res=await fetch(`${API_BASE}/admin/cancellations/${encodeURIComponent(orderId)}/refund`,{method:"POST",headers:{"Content-Type":"application/json"}});
  const data=await res.json().catch(()=>({}));
  alert(data.msg||"Refund updated");
  if(res.ok || data) loadAdminReturns();
}

async function retryReturnRefund(id){ if(!confirm("Retry the Razorpay refund for this return?"))return; const res=await fetch(`${API_BASE}/admin/returns/${encodeURIComponent(id)}/refund`,{method:"POST"}); const data=await res.json().catch(()=>({})); alert(data.msg||"Refund updated"); loadAdminReturns(); }
