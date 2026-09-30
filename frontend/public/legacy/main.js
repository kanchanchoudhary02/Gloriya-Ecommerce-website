const API_BASE = window.API_BASE || "https://gloriya.in/api";

// Load products on homepage
async function loadProducts() {
  const res = await fetch(`${API_BASE}/products/`);
  const products = await res.json();
  const container = document.querySelector(".row.g-4");
  container.innerHTML = "";

  products.forEach((p, i) => {
    container.innerHTML += `
      <div class="col-md-3" data-aos="fade-up" data-aos-delay="${i * 100}">
        <div class="product-card new-arrival-card">
          <div class="product-img-wrapper">
            <img src="${p.image}" alt="${p.name}">
            <div class="overlay">
              <button class="btn-add" onclick="addToCart(${
                p.id
              })">Add to Cart</button>
              <button class="btn-wishlist">❤️</button>
            </div>
          </div>
          <div class="p-3 text-center">
            <h5>${p.name}</h5>
            <p class="price">₹${p.price}</p>
          </div>
        </div>
      </div>`;
  });
}

// CART logic using localStorage
function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

async function addToCart(id) {
  const res = await fetch(`${API_BASE}/products/${id}`);
  const product = await res.json();
  const cart = getCart();
  const existing = cart.find((item) => item.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  saveCart(cart);
  showToast("Added to cart 🛒");
}

function showToast(msg) {
  const toast = document.getElementById("cart-toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// document.addEventListener("DOMContentLoaded", loadProducts);
