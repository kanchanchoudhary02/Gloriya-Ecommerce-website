const API_BASE = window.API_BASE || ((location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "http://localhost:5000/api" : "https://gloriya-ecommerce-website.onrender.com/api");

function getCart() {
  try {
    const buyNow = new URLSearchParams(window.location.search).get("buy_now");
    if (buyNow === "1") {
      const item = JSON.parse(localStorage.getItem("buy_now_item") || "null");
      if (item && item.id) return [{ ...item, qty: Math.max(1, Number(item.qty || 1)) }];
    }
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch { return []; }
}

function clearCart() {
  localStorage.removeItem("cart");
  localStorage.removeItem("buy_now_item");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (user) {
    user.cart = [];
    localStorage.setItem("user", JSON.stringify(user));
  }
  window.dispatchEvent(new Event("cart:updated"));
}

function renderCheckoutCart() {
  const cart = getCart();
  const el = document.getElementById("checkoutCart");
  if (!el) return;
  if (!cart.length) {
    el.innerHTML = "<p>Your cart is empty.</p>";
    const totalEl = document.getElementById("orderTotal");
    if (totalEl) totalEl.textContent = "Total: ₹0";
    return;
  }
  let total = 0;
  el.innerHTML = cart.map((it) => {
    const qty = Math.max(1, Number(it.qty) || 1);
    const price = Number(it.price) || 0;
    total += qty * price;
    return `<div class="d-flex justify-content-between border-bottom py-1"><div>${qty} × ${it.name || "Product"}</div><div>₹${(qty * price).toFixed(2)}</div></div>`;
  }).join("");
  const totalEl = document.getElementById("orderTotal");
  if (totalEl) totalEl.textContent = `Total: ₹${total.toFixed(2)}`;
}

function paymentFailureMessage(error) {
  const code = error?.code || "PAYMENT_FAILED";
  const description = error?.description || error?.reason || "Razorpay could not complete the payment.";
  return `Payment was not completed. ${description} (${code}). Your cart has been kept so you can retry.`;
}

async function refreshLoggedInUser() {
  const token = localStorage.getItem("auth_token") || "";
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
  } catch (error) {
    console.warn("Could not refresh account after payment", error);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function toAbsoluteApiUrl(path){
  const value=String(path||"");
  if(!value) return "";
  try { return new URL(value, `${API_BASE}/`).href; } catch { return value; }
}

function showPaymentSuccessModal(orderId, receiptUrl, receiptDownloadUrl) {
  document.getElementById("paymentSuccessModal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "paymentSuccessModal";
  overlay.className = "payment-success-overlay";
  overlay.innerHTML = `
    <section class="payment-success-dialog" role="dialog" aria-modal="true" aria-labelledby="paymentSuccessTitle">
      <div class="payment-success-mark" aria-hidden="true"><i class="fa-solid fa-check"></i></div>
      <p class="payment-success-eyebrow">GLORIYA JEWELLERY</p>
      <h2 id="paymentSuccessTitle">Payment Successful! 🎉</h2>
      <p class="payment-success-message">Your payment is successful. We will deliver your order within 7-8 working days. Your order receipt will be sent to your registered email address.</p>
      <p class="payment-success-thanks">Thank you for shopping with Gloriya Jewellery.</p>
      <div class="payment-success-order"><span>ORDER ID</span><strong>${escapeHtml(orderId)}</strong></div>
      <div class="payment-success-actions">
        <a class="payment-success-continue" href="/shop.html">Continue Shopping</a>
        <a class="payment-success-receipt" target="_blank" rel="noopener" href="${escapeHtml(toAbsoluteApiUrl(receiptDownloadUrl || receiptUrl).replace(/([?&])download=1(?:&|$)/, "$1"))}">Receipt — Print / Download</a>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".payment-success-continue")?.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  renderCheckoutCart();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (user) {
    const fields = { name:user.name, email:user.email, phone:user.phone, address:user.address, city:user.city, pincode:user.pincode };
    Object.entries(fields).forEach(([id,value]) => { const el=document.getElementById(id); if(el && value) el.value=value; });
  }
});

document.getElementById("checkoutForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cart = getCart();
  if (!cart.length) return alert("Your cart is empty");

  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim().toLowerCase(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim(),
    pincode: document.getElementById("pincode").value.trim(),
    items: cart
  };

  const submitButton = e.currentTarget.querySelector('button[type="submit"]');
  if (submitButton) { submitButton.disabled = true; submitButton.dataset.originalText = submitButton.innerHTML; submitButton.innerHTML = "Creating secure payment…"; }

  try {
    const res = await fetch(`${API_BASE}/orders/create`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.description || data.msg || "Unable to start payment");

    const rorder = data.order;
    if (!rorder?.id || !rorder?.key_id || !Number(rorder?.amount)) throw new Error("The server returned an invalid Razorpay order.");

    const options = {
      key: rorder.key_id,
      amount: Number(rorder.amount),
      currency: rorder.currency || "INR",
      name: "Gloriya Jewellery",
      description: "Gloriya Jewellery Order Payment",
      order_id: rorder.id,
      prefill: { name:payload.name, email:payload.email, contact:payload.phone },
      notes: { local_order_id:String(data?.local_order?.id || "") },
      theme: { color:"#d48b76" },
      modal: { ondismiss: () => { if (submitButton) { submitButton.disabled=false; submitButton.innerHTML=submitButton.dataset.originalText || "Pay"; } } },
      handler: async function(response) {
        try {
          const verifyRes = await fetch(`${API_BASE}/orders/verify`, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ order_id:response.razorpay_order_id, payment_id:response.razorpay_payment_id, signature:response.razorpay_signature })
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok || !verifyData.success) {
            const detail = verifyData.description || verifyData.msg || "Payment verification failed.";
            throw new Error(`${detail}${verifyData.code ? ` (${verifyData.code})` : ""}`);
          }
          await refreshLoggedInUser();
          clearCart();
          const orderId = verifyData.order_id || response.razorpay_order_id;
          const receiptUrl = verifyData.receipt_url || `${API_BASE}/orders/${encodeURIComponent(orderId)}/receipt?customer=1`;
          const receiptDownloadUrl = verifyData.receipt_download_url || `${API_BASE}/orders/${encodeURIComponent(orderId)}/receipt?format=pdf&download=1`;
          showPaymentSuccessModal(orderId, receiptUrl, receiptDownloadUrl);
        } catch (error) {
          console.error("Payment verification failed", error);
          alert(`Payment was received by Razorpay but our server could not confirm it yet. Please do not pay again. Payment ID: ${response.razorpay_payment_id}. ${error.message || "Contact support."}`);
          if (submitButton) { submitButton.disabled=false; submitButton.innerHTML=submitButton.dataset.originalText || "Pay"; }
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", function(response) {
      console.error("Razorpay payment.failed", response?.error || response);
      alert(paymentFailureMessage(response?.error || {}));
      if (submitButton) { submitButton.disabled=false; submitButton.innerHTML=submitButton.dataset.originalText || "Pay"; }
    });
    rzp.open();
  } catch (err) {
    console.error("Payment start error", err);
    alert("Payment could not be started: " + (err.message || err));
    if (submitButton) { submitButton.disabled=false; submitButton.innerHTML=submitButton.dataset.originalText || "Pay"; }
  }
});
