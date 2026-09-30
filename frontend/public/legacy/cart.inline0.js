
      const API_BASE = window.API_BASE || "https://gloriya.in/api";


      function getCart() {
        try {
          return JSON.parse(localStorage.getItem("cart") || "[]");
        } catch {
          return [];
        }
      }

      function saveCart(cart) {
        localStorage.setItem("cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("cart:updated"));
        // also sync to logged-in user object if present
        const userJson = localStorage.getItem("user");
        if (userJson) {
          try {
            const user = JSON.parse(userJson);
            user.cart = cart;
            localStorage.setItem("user", JSON.stringify(user));
          } catch {}
        }
      }

      function formatCurrency(v) {
        return Number(v).toFixed(2);
      }

      function renderCart() {
        const cart = getCart();
        const container = document.getElementById("cart-items");
        if (!container) return;
        container.innerHTML = "";

        if (!cart.length) {
          container.innerHTML = `<p>Your cart is empty.</p>`;
          document.getElementById("total-amount").textContent = "Total: ₹0";
          return;
        }

        cart.forEach((item, idx) => {
          const itemTotal = Number(item.price) * Number(item.qty || 1);
          const div = document.createElement("div");
          div.className =
            "cart-item d-flex justify-content-between align-items-center border-bottom py-3";
          div.innerHTML = `
            <div class="d-flex align-items-center gap-3">
              <img src="${
                item.image || "https://via.placeholder.com/80"
              }" width="80" height="80" style="object-fit:cover;border-radius:8px;">
              <div>
                <h6 class="mb-1">${item.name || "Unnamed"}</h6>
                <div class="small text-muted">₹${formatCurrency(
                  item.price
                )}</div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <div class="input-group input-group-sm" style="width:120px;">
                <button class="btn btn-outline-secondary btn-decrease" data-idx="${idx}">−</button>
                <input type="number" min="1" class="form-control qty-input" data-idx="${idx}" value="${
            item.qty || 1
          }">
                <button class="btn btn-outline-secondary btn-increase" data-idx="${idx}">+</button>
              </div>
              <div class="text-end">
                <div><strong>₹${formatCurrency(itemTotal)}</strong></div>
                <button class="btn btn-link text-danger btn-sm btn-remove" data-idx="${idx}">Remove</button>
              </div>
            </div>
          `;
          container.appendChild(div);
        });

        // attach events
        container.querySelectorAll(".btn-decrease").forEach((b) =>
          b.addEventListener("click", (e) => {
            const i = Number(e.currentTarget.dataset.idx);
            changeQty(i, -1);
          })
        );
        container.querySelectorAll(".btn-increase").forEach((b) =>
          b.addEventListener("click", (e) => {
            const i = Number(e.currentTarget.dataset.idx);
            changeQty(i, +1);
          })
        );
        container.querySelectorAll(".qty-input").forEach((inp) =>
          inp.addEventListener("change", (e) => {
            const i = Number(e.currentTarget.dataset.idx);
            const v = Math.max(1, Number(e.currentTarget.value || 1));
            setQty(i, v);
          })
        );
        container.querySelectorAll(".btn-remove").forEach((b) =>
          b.addEventListener("click", (e) => {
            const i = Number(e.currentTarget.dataset.idx);
            removeItem(i);
          })
        );

        // update total
        const total = cart.reduce(
          (s, it) => s + Number(it.price) * Number(it.qty || 1),
          0
        );
        document.getElementById(
          "total-amount"
        ).textContent = `Total: ₹${formatCurrency(total)}`;
      }

      function changeQty(index, delta) {
        const cart = getCart();
        if (!cart[index]) return;
        const qty = Math.max(1, Number(cart[index].qty || 1) + delta);
        cart[index].qty = qty;
        saveCart(cart);
        renderCart();
      }
      function setQty(index, qty) {
        const cart = getCart();
        if (!cart[index]) return;
        cart[index].qty = Math.max(1, Number(qty));
        saveCart(cart);
        renderCart();
      }
      function removeItem(index) {
        const cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
        renderCart();
      }

      document.getElementById("clearCartBtn").addEventListener("click", () => {
        if (!confirm("Clear your cart?")) return;
        saveCart([]);
        renderCart();
      });

      // ensure checkout button works: if empty, disable link
      function updateCheckoutLink() {
        const total = getCart().reduce(
          (s, it) => s + Number(it.price) * Number(it.qty || 1),
          0
        );
        const btn = document.getElementById("checkoutBtn");
        if (!btn) return;
        if (total <= 0) {
          btn.classList.add("disabled");
          btn.setAttribute("aria-disabled", "true");
        } else {
          btn.classList.remove("disabled");
          btn.removeAttribute("aria-disabled");
        }
      }

      // initial render
      document.addEventListener("DOMContentLoaded", () => {
        renderCart();
        updateCheckoutLink();
      });
    