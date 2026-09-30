
      const API_BASE = window.API_BASE || "https://gloriya.in/api";

      const user = JSON.parse(localStorage.getItem("user") || "null");

      if (!user) window.location.href = "../login.html";

      async function loadWishlist() {
        const container = document.getElementById("wishlistContainer");
        const res = await fetch(`${API_BASE}/products/`);
        const products = await res.json();
        const wishlist = user.wishlist || [];

        const items = products.filter((p) => wishlist.includes(p.id));

        if (!items.length) {
          container.innerHTML = `<p class="text-muted text-center">Your wishlist is empty 💔</p>`;
          return;
        }

        container.innerHTML = items
          .map(
            (p) => `
        <div class="col-md-4">
          <div class="card shadow border-0">
            <img src="${p.image}" class="card-img-top" alt="${p.name}">
            <div class="card-body text-center">
              <h5>${p.name}</h5>
              <p class="price">₹${p.price}</p>
            </div>
          </div>
        </div>
      `
          )
          .join("");
      }

      document.addEventListener("DOMContentLoaded", loadWishlist);
    