// summary-tab.js
// Renders the Order Summary tab in the Gloriya Admin Panel

const SUMMARY_API = window.API_BASE || "https://gloriya.in/api";

async function loadOrderSummary() {
  const content = document.getElementById("tabContent");
  content.innerHTML = `<div class="sum-loading">Loading summary…</div>`;

  let orders = [];
  let products = [];

  try {
    const [oRes, pRes] = await Promise.all([
      fetch(`${SUMMARY_API}/admin/orders`),
      fetch(`${SUMMARY_API}/products/`)
    ]);
    orders   = oRes.ok   ? await oRes.json()   : [];
    products = pRes.ok   ? await pRes.json()   : [];
  } catch (e) {
    content.innerHTML = `<p class="text-danger">Failed to load summary data.</p>`;
    return;
  }

  if (!Array.isArray(orders))   orders   = [];
  if (!Array.isArray(products)) products = [];

  /* ── Derived metrics ─────────────────────────── */
  const totalRevenue    = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const totalOrders     = orders.length;
  const statusGroups    = groupBy(orders, o => (o.status || "pending").toLowerCase());
  const completed       = (statusGroups["completed"] || []).length;
  const pending         = (statusGroups["pending"]   || []).length;
  const cancelled       = (statusGroups["cancelled"] || []).length;
  const avgOrderValue   = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;

  const completedRevenue = (statusGroups["completed"] || [])
    .reduce((s, o) => s + (Number(o.amount) || 0), 0);

  // Revenue by day (last 30 days)
  const last30 = revenueByDay(orders, 30);

  // Top products by revenue
  const topProducts = topProductsByRevenue(orders, products, 5);

  // Orders by status for doughnut
  const statusData = [
    { label: "Completed", count: completed,  color: "#2d6a4f" },
    { label: "Pending",   count: pending,    color: "#b8860b" },
    { label: "Cancelled", count: cancelled,  color: "#9b2226" },
  ];
  const otherCount = totalOrders - completed - pending - cancelled;
  if (otherCount > 0) statusData.push({ label: "Other", count: otherCount, color: "#6c757d" });

  // Recent orders (last 10)
  const recent = [...orders]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 10);

  /* ── Render ──────────────────────────────────── */
  content.innerHTML = `
    <style>
      .sum-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:28px; }
      .sum-card {
        background:#fff;
        border:1px solid #e8dcc8;
        border-radius:6px;
        padding:20px 22px;
        position:relative;
        overflow:hidden;
        animation: fadeUp .35s ease both;
      }
      .sum-card::before {
        content:'';
        position:absolute;
        top:0;left:0;right:0;
        height:3px;
        background:var(--sum-accent,#b8860b);
      }
      .sum-card .sum-label {
        font-size:11px;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:#6b5e4e;
        margin-bottom:6px;
      }
      .sum-card .sum-value {
        font-family:'Cormorant Garamond',Georgia,serif;
        font-size:2rem;
        font-weight:600;
        color:#1a1612;
        line-height:1;
      }
      .sum-card .sum-sub {
        font-size:12px;
        color:#888;
        margin-top:4px;
      }
      .sum-card .sum-icon {
        position:absolute;
        right:18px; top:50%;
        transform:translateY(-50%);
        font-size:2.2rem;
        opacity:.08;
        color:#1a1612;
      }

      .sum-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px; }
      @media(max-width:767px){ .sum-row { grid-template-columns:1fr; } }

      .sum-panel {
        background:#fff;
        border:1px solid #e8dcc8;
        border-radius:6px;
        padding:20px 22px;
        animation: fadeUp .45s ease both;
      }
      .sum-panel-title {
        font-size:12px;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:#6b5e4e;
        margin-bottom:16px;
        padding-bottom:10px;
        border-bottom:1px solid #f0e8d8;
      }

      /* Bar chart */
      .sum-bar-chart { display:flex; align-items:flex-end; gap:4px; height:100px; }
      .sum-bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; }
      .sum-bar {
        width:100%;
        background: linear-gradient(to top, #b8860b, #d4a017);
        border-radius:3px 3px 0 0;
        min-height:2px;
        transition:height .4s ease;
        position:relative;
      }
      .sum-bar:hover::after {
        content: attr(data-tip);
        position:absolute;
        bottom:calc(100% + 4px);
        left:50%;
        transform:translateX(-50%);
        background:#1a1612;
        color:#fff;
        font-size:10px;
        padding:2px 6px;
        border-radius:3px;
        white-space:nowrap;
        pointer-events:none;
        z-index:10;
      }
      .sum-bar-label { font-size:9px; color:#aaa; text-align:center; }

      /* Doughnut */
      .sum-donut-wrap { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
      .sum-donut-legend { display:flex; flex-direction:column; gap:8px; }
      .sum-legend-item { display:flex; align-items:center; gap:8px; font-size:13px; }
      .sum-legend-dot { width:10px;height:10px;border-radius:50%;flex-shrink:0; }

      /* Top products table */
      .sum-top-table { width:100%; border-collapse:collapse; }
      .sum-top-table td { padding:8px 6px; font-size:13px; border-bottom:1px solid #f5f0e8; }
      .sum-top-table tr:last-child td { border-bottom:none; }
      .sum-top-table .rank { color:#b8860b; font-weight:600; font-size:15px; width:28px; }
      .sum-top-table .prod-name { color:#1a1612; }
      .sum-top-table .prod-rev { color:#2d6a4f; font-weight:600; text-align:right; }
      .sum-top-table .prod-count { color:#6b5e4e; text-align:right; }

      /* Recent orders */
      .sum-recent-table { width:100%; border-collapse:collapse; }
      .sum-recent-table th { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#888; padding:6px 8px; border-bottom:2px solid #f0e8d8; text-align:left; }
      .sum-recent-table td { padding:9px 8px; font-size:13px; border-bottom:1px solid #f5f0e8; }
      .sum-recent-table tr:last-child td { border-bottom:none; }
      .sum-status-badge {
        display:inline-block;
        padding:2px 10px;
        border-radius:20px;
        font-size:11px;
        font-weight:500;
        letter-spacing:.04em;
      }
      .sum-status-completed { background:#e8f5ee; color:#2d6a4f; }
      .sum-status-pending   { background:#fdf3e0; color:#b8860b; }
      .sum-status-cancelled { background:#fde8e8; color:#9b2226; }
      .sum-status-other     { background:#f0f0f0; color:#555; }

      @keyframes fadeUp {
        from { opacity:0; transform:translateY(14px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .sum-loading { padding:40px; text-align:center; color:#888; }

      .sum-empty { color:#aaa; font-size:13px; text-align:center; padding:20px 0; }
    </style>

    <!-- KPI Cards -->
    <div class="sum-grid">
      <div class="sum-card" style="--sum-accent:#b8860b; animation-delay:.05s">
        <div class="sum-label">Total Revenue</div>
        <div class="sum-value">${fmtINR(totalRevenue)}</div>
        <div class="sum-sub">All orders combined</div>
        <i class="fa fa-indian-rupee-sign sum-icon"></i>
      </div>
      <div class="sum-card" style="--sum-accent:#2d6a4f; animation-delay:.1s">
        <div class="sum-label">Confirmed Revenue</div>
        <div class="sum-value">${fmtINR(completedRevenue)}</div>
        <div class="sum-sub">Completed orders only</div>
        <i class="fa fa-circle-check sum-icon"></i>
      </div>
      <div class="sum-card" style="--sum-accent:#1a1612; animation-delay:.15s">
        <div class="sum-label">Total Orders</div>
        <div class="sum-value">${totalOrders}</div>
        <div class="sum-sub">${completed} completed · ${pending} pending</div>
        <i class="fa fa-bag-shopping sum-icon"></i>
      </div>
      <div class="sum-card" style="--sum-accent:#6b5e4e; animation-delay:.2s">
        <div class="sum-label">Avg Order Value</div>
        <div class="sum-value">${fmtINR(avgOrderValue)}</div>
        <div class="sum-sub">Per order average</div>
        <i class="fa fa-chart-line sum-icon"></i>
      </div>
      <div class="sum-card" style="--sum-accent:#9b2226; animation-delay:.25s">
        <div class="sum-label">Cancelled Orders</div>
        <div class="sum-value">${cancelled}</div>
        <div class="sum-sub">${totalOrders ? Math.round(cancelled/totalOrders*100) : 0}% cancellation rate</div>
        <i class="fa fa-ban sum-icon"></i>
      </div>
      <div class="sum-card" style="--sum-accent:#3a6186; animation-delay:.3s">
        <div class="sum-label">Products Listed</div>
        <div class="sum-value">${products.length}</div>
        <div class="sum-sub">${products.filter(p => p.inventory > 0 || p.stock).length} in stock</div>
        <i class="fa fa-gem sum-icon"></i>
      </div>
    </div>

    <!-- Charts row -->
    <div class="sum-row">
      <!-- Revenue bar chart -->
      <div class="sum-panel" style="animation-delay:.35s">
        <div class="sum-panel-title"><i class="fa fa-chart-bar me-2"></i>Revenue — Last 30 Days</div>
        ${renderBarChart(last30)}
      </div>
      <!-- Status doughnut -->
      <div class="sum-panel" style="animation-delay:.4s">
        <div class="sum-panel-title"><i class="fa fa-chart-pie me-2"></i>Orders by Status</div>
        ${renderDonut(statusData, totalOrders)}
      </div>
    </div>

    <!-- Bottom row -->
    <div class="sum-row">
      <!-- Top products -->
      <div class="sum-panel" style="animation-delay:.45s">
        <div class="sum-panel-title"><i class="fa fa-star me-2"></i>Top Products by Revenue</div>
        ${renderTopProducts(topProducts)}
      </div>
      <!-- Recent orders -->
      <div class="sum-panel" style="animation-delay:.5s">
        <div class="sum-panel-title"><i class="fa fa-clock-rotate-left me-2"></i>Recent Orders</div>
        ${renderRecentOrders(recent)}
      </div>
    </div>
  `;

  // Animate bars after render
  requestAnimationFrame(() => {
    const bars = content.querySelectorAll(".sum-bar[data-h]");
    bars.forEach(bar => {
      const h = bar.dataset.h;
      bar.style.height = h + "%";
    });
  });
}

/* ── Helpers ──────────────────────────────────── */

function fmtINR(n) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch { return "₹" + n; }
}

function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function revenueByDay(orders, days) {
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    const rev = orders
      .filter(o => (o.timestamp || "").startsWith(key))
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    result.push({ key, label, rev });
  }
  return result;
}

function topProductsByRevenue(orders, products, n) {
  const map = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      const id = String(it.id || it.product_id || "");
      if (!id) return;
      if (!map[id]) map[id] = { id, name: it.name || "", rev: 0, count: 0 };
      map[id].rev   += (Number(it.price) || 0) * (Number(it.qty) || 1);
      map[id].count += (Number(it.qty) || 1);
    });
  });
  return Object.values(map)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, n)
    .map(x => {
      const p = products.find(p => String(p.id) === String(x.id));
      return { ...x, name: (p && p.name) || x.name || `Product #${x.id}` };
    });
}

function renderBarChart(days) {
  if (!days.length) return `<div class="sum-empty">No data</div>`;
  const max = Math.max(...days.map(d => d.rev), 1);
  // Show every 5th label to avoid clutter
  const bars = days.map((d, i) => {
    const pct = Math.round((d.rev / max) * 100);
    const showLabel = (i % 5 === 0) || i === days.length - 1;
    return `<div class="sum-bar-wrap">
      <div class="sum-bar" data-h="${pct}" style="height:0%" data-tip="${d.label}: ${fmtINR(d.rev)}"></div>
      <div class="sum-bar-label">${showLabel ? d.label : ""}</div>
    </div>`;
  }).join("");
  return `<div class="sum-bar-chart">${bars}</div>`;
}

function renderDonut(statusData, total) {
  if (!total) return `<div class="sum-empty">No orders yet</div>`;

  // SVG doughnut
  const size = 110;
  const r = 42;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segments = statusData
    .filter(s => s.count > 0)
    .map(s => {
      const frac = s.count / total;
      const dash = frac * circ;
      const gap  = circ - dash;
      const seg = `<circle
        cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="${s.color}"
        stroke-width="22"
        stroke-dasharray="${dash} ${gap}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cy})"
      />`;
      offset += dash;
      return seg;
    }).join("");

  const legend = statusData.map(s => `
    <div class="sum-legend-item">
      <span class="sum-legend-dot" style="background:${s.color}"></span>
      <span>${s.label}</span>
      <strong style="margin-left:auto;padding-left:12px">${s.count}</strong>
    </div>`).join("");

  return `<div class="sum-donut-wrap">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
      ${segments}
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
            style="font-size:14px;font-weight:700;fill:#1a1612">${total}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" dominant-baseline="middle"
            style="font-size:8px;fill:#888;letter-spacing:.05em">ORDERS</text>
    </svg>
    <div class="sum-donut-legend">${legend}</div>
  </div>`;
}

function renderTopProducts(top) {
  if (!top.length) return `<div class="sum-empty">No product data in orders yet</div>`;
  const rows = top.map((p, i) => `
    <tr>
      <td class="rank">#${i + 1}</td>
      <td class="prod-name">${escapeHtml(p.name)}</td>
      <td class="prod-count">${p.count} sold</td>
      <td class="prod-rev">${fmtINR(p.rev)}</td>
    </tr>`).join("");
  return `<table class="sum-top-table"><tbody>${rows}</tbody></table>`;
}

function renderRecentOrders(orders) {
  if (!orders.length) return `<div class="sum-empty">No orders yet</div>`;
  const rows = orders.map(o => {
    const st = (o.status || "pending").toLowerCase();
    const cls = ["completed","pending","cancelled"].includes(st)
      ? `sum-status-${st}` : "sum-status-other";
    const date = o.timestamp ? o.timestamp.slice(0, 10) : "—";
    return `<tr>
      <td style="color:#888;font-size:12px">#${o.id}</td>
      <td>${escapeHtml(o.name || o.user_email || "—")}</td>
      <td style="font-weight:600;color:#2d6a4f">${fmtINR(o.amount || 0)}</td>
      <td><span class="sum-status-badge ${cls}">${st}</span></td>
      <td style="color:#aaa;font-size:12px">${date}</td>
    </tr>`;
  }).join("");
  return `<div style="overflow-x:auto"><table class="sum-recent-table">
    <thead><tr><th>ID</th><th>Buyer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"'\/]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;"}[c]));
}
