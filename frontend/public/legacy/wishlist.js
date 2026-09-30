/* =========================================================
   GLORIYA JEWELLERY - WISHLIST
   Uses localStorage key: "wishlist"
   ========================================================= */

(function () {
  "use strict";

  const WISHLIST_KEY = "wishlist";

  const API_BASE =
    window.API_BASE ||
    "https://gloriya.in/api";


  /* =========================================================
     HELPERS
     ========================================================= */

  function getWishlistIds() {
    try {
      const data = JSON.parse(
        localStorage.getItem(WISHLIST_KEY) || "[]"
      );

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map(id => String(id));

    } catch (error) {
      console.error("Wishlist read error:", error);
      return [];
    }
  }


  function saveWishlistIds(ids) {

    const cleanIds = [
      ...new Set(
        ids.map(id => String(id))
      )
    ];

    localStorage.setItem(
      WISHLIST_KEY,
      JSON.stringify(cleanIds)
    );
    window.dispatchEvent(new Event("wishlist:updated"));

    updateWishlistCount();
    syncWishlistButtons();
  }


  function formatPrice(price) {

    const number = Number(price || 0);

    try {

      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
      }).format(number);

    } catch (error) {

      return "₹" + number;

    }
  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function getProductUrl(id) {

    return "/product.html?id=" +
      encodeURIComponent(String(id));

  }


  /* =========================================================
     TOAST
     ========================================================= */

  function showToast(message) {

    let toast =
      document.getElementById("wishlistToast");

    if (!toast) {

      toast = document.createElement("div");

      toast.id = "wishlistToast";

      toast.style.position = "fixed";
      toast.style.right = "20px";
      toast.style.bottom = "20px";
      toast.style.zIndex = "99999";
      toast.style.background = "#2b1e1c";
      toast.style.color = "#fff";
      toast.style.padding = "13px 20px";
      toast.style.borderRadius = "10px";
      toast.style.fontSize = "14px";
      toast.style.fontWeight = "600";

      toast.style.boxShadow =
        "0 8px 25px rgba(0,0,0,.18)";

      toast.style.opacity = "0";

      toast.style.transform =
        "translateY(10px)";

      toast.style.transition =
        "opacity .25s ease, transform .25s ease";

      document.body.appendChild(toast);
    }


    toast.textContent = message;


    requestAnimationFrame(() => {

      toast.style.opacity = "1";

      toast.style.transform =
        "translateY(0)";

    });


    clearTimeout(toast._timer);


    toast._timer = setTimeout(() => {

      toast.style.opacity = "0";

      toast.style.transform =
        "translateY(10px)";

    }, 2200);

  }


  /* =========================================================
     WISHLIST COUNT
     ========================================================= */

  function updateWishlistCount() {

    const count =
      getWishlistIds().length;


    const pageCount =
      document.getElementById(
        "wishlistPageCount"
      );


    if (pageCount) {

      pageCount.textContent =
        count === 1
          ? "1 item"
          : `${count} items`;

    }


    /*
      Update existing navbar counters only.
      DO NOT CREATE A NEW NAVBAR WISHLIST.
    */

    document
      .querySelectorAll(
        ".wishlist-nav-badge, .gl-wishlist-badge"
      )
      .forEach(badge => {

        badge.textContent = count;

        badge.style.display =
          count > 0
            ? "inline-flex"
            : "none";

      });

  }


  /* =========================================================
     SYNC HEART BUTTONS
     ========================================================= */

  function syncWishlistButtons() {

    const ids =
      getWishlistIds();


    document
      .querySelectorAll(
        ".wishlist-btn, .gl-wishlist-btn"
      )
      .forEach(button => {

        const id =
          button.dataset.id ||
          button.dataset.wishlistId;


        if (!id) {
          return;
        }


        const active =
          ids.includes(String(id));


        button.classList.toggle(
          "wishlist-active",
          active
        );


        const icon =
          button.querySelector("i");


        if (icon) {

          icon.classList.toggle(
            "fa-regular",
            !active
          );

          icon.classList.toggle(
            "fa-solid",
            active
          );

          icon.classList.toggle(
            "fa-heart",
            true
          );

        }


        button.setAttribute(
          "aria-label",
          active
            ? "Remove from Wishlist"
            : "Add to Wishlist"
        );


        button.setAttribute(
          "title",
          active
            ? "Remove from Wishlist"
            : "Add to Wishlist"
        );

      });

  }


  /* =========================================================
     ADD / REMOVE WISHLIST
     ========================================================= */

  function toggleWishlist(id) {

    const productId =
      String(id);


    if (!productId) {
      return;
    }


    const ids =
      getWishlistIds();


    const index =
      ids.indexOf(productId);


    if (index === -1) {

      ids.push(productId);

      saveWishlistIds(ids);

      showToast(
        "Product added to Wishlist ❤️"
      );

    } else {

      ids.splice(index, 1);

      saveWishlistIds(ids);

      showToast(
        "Product removed from Wishlist"
      );

    }


    renderWishlist();

  }


  /* =========================================================
     FETCH PRODUCTS
     ========================================================= */

  async function fetchProducts() {

    const response =
      await fetch(
        `${API_BASE}/products/`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        `Products API error: ${response.status}`
      );

    }


    const data =
      await response.json();


    return Array.isArray(data)
      ? data
      : [];

  }


  /* =========================================================
     RENDER EMPTY STATE
     ========================================================= */

  function showEmptyWishlist() {

    const container =
      document.getElementById(
        "wishlistContainer"
      );


    const empty =
      document.getElementById(
        "wishlistEmpty"
      );


    if (container) {

      container.innerHTML = "";

    }


    if (empty) {

      empty.style.display = "block";

    }


    updateWishlistCount();

  }


  /* =========================================================
     RENDER WISHLIST
     ========================================================= */

  async function renderWishlist() {

    const container =
      document.getElementById(
        "wishlistContainer"
      );


    const empty =
      document.getElementById(
        "wishlistEmpty"
      );


    /*
      If this JS is loaded on another page,
      don't do anything.
    */

    if (!container) {

      updateWishlistCount();
      syncWishlistButtons();

      return;

    }


    const ids =
      getWishlistIds();


    if (!ids.length) {

      showEmptyWishlist();

      return;

    }


    if (empty) {

      empty.style.display = "none";

    }


    container.innerHTML = `
      <div class="col-12 text-center py-5">

        <div
          class="spinner-border"
          style="color:#c78e82;"
          role="status">
        </div>

        <p class="mt-3 text-muted">
          Loading your wishlist...
        </p>

      </div>
    `;


    try {

      const products =
        await fetchProducts();


      /*
        Match saved IDs with API products.
      */

      const wishlistProducts =
        ids
          .map(id =>
            products.find(
              product =>
                String(product.id) ===
                String(id)
            )
          )
          .filter(Boolean);


      /*
        Remove old/deleted product IDs.
      */

      const validIds =
        wishlistProducts.map(product =>
          String(product.id)
        );


      if (
        validIds.length !==
        ids.length
      ) {

        saveWishlistIds(validIds);

      }


      if (!wishlistProducts.length) {

        showEmptyWishlist();

        return;

      }


      container.innerHTML =
        wishlistProducts
          .map(product =>
            createWishlistCard(product)
          )
          .join("");


      updateWishlistCount();

    } catch (error) {

      console.error(
        "Wishlist loading error:",
        error
      );


      container.innerHTML = `
        <div class="col-12">

          <div
            class="alert alert-danger text-center">

            Unable to load your wishlist.
            Please refresh the page and try again.

          </div>

        </div>
      `;


      updateWishlistCount();

    }

  }


  /* =========================================================
     PRODUCT CARD
     ========================================================= */

  function createWishlistCard(product) {

    const id =
      String(product.id ?? "");


    const name =
      escapeHTML(
        product.name ||
        "Jewellery Product"
      );


    const price =
      formatPrice(product.price);


    const image =
      escapeHTML(
        product.image ||
        "/static/img/placeholder-16x9.jpg"
      );


    const url =
      getProductUrl(id);


    const stock =
      Number(product.stock ?? 1);


    const outOfStock =
      stock <= 0;


    return `
      <div
        class="col-lg-4 col-md-6 mb-4"
        data-wishlist-product="${id}"
      >

        <div class="wishlist-card">


          <!-- IMAGE -->

          <div class="wishlist-image-wrapper">

            <a href="${url}">

              <img
                src="${image}"
                alt="${name}"
                class="wishlist-image"
                loading="lazy"
                onerror="this.src='/static/img/placeholder-16x9.jpg';"
              >

            </a>


            <!-- REMOVE HEART -->

            <button
              type="button"
              class="wishlist-remove-btn"
              data-remove-wishlist="${id}"
              aria-label="Remove ${name} from Wishlist"
              title="Remove from Wishlist"
            >

              <i class="fa-solid fa-heart"></i>

            </button>

          </div>


          <!-- INFO -->

          <div class="wishlist-info">

            <h5>
              ${name}
            </h5>


            <div class="wishlist-price">
              ${price}
            </div>


            <!-- ACTIONS -->

            <div class="wishlist-actions">

              ${
                outOfStock

                  ? `

                    <button
                      type="button"
                      class="wishlist-cart-btn"
                      disabled
                      style="opacity:.6;cursor:not-allowed;"
                    >

                      Out of Stock

                    </button>

                  `

                  : `

                    <button
                      type="button"
                      class="wishlist-cart-btn"
                      data-wishlist-cart
                      data-id="${escapeHTML(id)}"
                      data-name="${name}"
                      data-price="${Number(product.price || 0)}"
                      data-image="${image}"
                    >

                      <i class="fa-solid fa-cart-shopping me-2"></i>

                      Add to Cart

                    </button>

                  `
              }


              <button
                type="button"
                class="wishlist-delete-btn"
                data-remove-wishlist="${escapeHTML(id)}"
                aria-label="Delete ${name} from Wishlist"
                title="Remove"
              >

                <i class="fa-solid fa-trash"></i>

              </button>

            </div>

          </div>

        </div>

      </div>
    `;

  }


  /* =========================================================
     REMOVE PRODUCT
     ========================================================= */

  function removeFromWishlist(id) {

    const productId =
      String(id);


    const ids =
      getWishlistIds();


    const newIds =
      ids.filter(
        itemId =>
          String(itemId) !==
          productId
      );


    saveWishlistIds(newIds);


    showToast(
      "Product removed from Wishlist"
    );


    renderWishlist();

  }


  /* =========================================================
     ADD TO CART
     ========================================================= */

  function addToCart(product) {

    /*
      First try existing cart-utils.js
    */

    try {

      if (
        typeof window.addToCart ===
        "function"
      ) {

        window.addToCart(product);

        showToast(
          "Item added to cart 🛒"
        );

        return;

      }

    } catch (error) {

      console.warn(
        "Existing addToCart failed:",
        error
      );

    }


    /*
      Fallback cart storage.
    */

    const possibleKeys = [
      "cart",
      "gloriya_cart"
    ];


    let cartKey = "cart";
    let cart = [];


    for (const key of possibleKeys) {

      try {

        const saved =
          JSON.parse(
            localStorage.getItem(key) ||
            "[]"
          );


        if (Array.isArray(saved)) {

          if (saved.length > 0) {

            cartKey = key;
            cart = saved;

            break;

          }


          if (
            localStorage.getItem(key) !==
            null
          ) {

            cartKey = key;
            cart = saved;

          }

        }

      } catch (error) {}

    }


    const existingIndex =
      cart.findIndex(
        item =>
          String(
            item.id ??
            item.productId
          ) ===
          String(product.id)
      );


    if (existingIndex !== -1) {

      cart[existingIndex].quantity =
        Number(
          cart[existingIndex].quantity || 1
        ) + 1;

    } else {

      cart.push({

        id: String(product.id),

        name: product.name,

        price:
          Number(product.price || 0),

        image: product.image,

        quantity: 1

      });

    }


    localStorage.setItem(
      cartKey,
      JSON.stringify(cart)
    );


    showToast(
      "Item added to cart 🛒"
    );

  }


  /* =========================================================
     CLICK HANDLER
     ========================================================= */

  document.addEventListener(
    "click",
    function (event) {


      /*
        Wishlist buttons from Home / Shop
      */

      const wishlistButton =
        event.target.closest(
          ".wishlist-btn, .gl-wishlist-btn"
        );


      if (wishlistButton) {

        event.preventDefault();
        event.stopPropagation();


        const id =
          wishlistButton.dataset.id ||
          wishlistButton.dataset.wishlistId;


        if (id) {

          toggleWishlist(id);

        }


        return;

      }


      /*
        Remove buttons from Wishlist page
      */

      const removeButton =
        event.target.closest(
          "[data-remove-wishlist]"
        );


      if (removeButton) {

        event.preventDefault();


        const id =
          removeButton.dataset.removeWishlist;


        if (id) {

          removeFromWishlist(id);

        }


        return;

      }


      /*
        Add to cart from Wishlist
      */

      const cartButton =
        event.target.closest(
          "[data-wishlist-cart]"
        );


      if (cartButton) {

        event.preventDefault();


        const product = {

          id:
            cartButton.dataset.id,

          name:
            cartButton.dataset.name,

          price:
            Number(
              cartButton.dataset.price || 0
            ),

          image:
            cartButton.dataset.image

        };


        addToCart(product);

        return;

      }

    },
    true
  );


  /* =========================================================
     NAVBAR WISHLIST
     ========================================================= */

  function updateNavbarWishlist() {

    const navbar =
      document.getElementById("navbar");


    if (!navbar) {
      return;
    }


    /*
      IMPORTANT:
      Do NOT create a new Wishlist link.

      The Wishlist link/icon already exists
      in the main navbar.

      We only update its existing badge/count.
    */


    const count =
      getWishlistIds().length;


    navbar
      .querySelectorAll(
        ".wishlist-nav-badge, .gl-wishlist-badge"
      )
      .forEach(badge => {

        badge.textContent = count;

        badge.style.display =
          count > 0
            ? "inline-flex"
            : "none";

      });

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  function initWishlist() {

    updateWishlistCount();

    syncWishlistButtons();

    renderWishlist();


    /*
      Navbar is loaded dynamically by
      partials-loader.js.

      We ONLY update the existing
      Wishlist badge.
    */

    updateNavbarWishlist();


    let attempts = 0;


    const navbarTimer =
      setInterval(() => {

        updateNavbarWishlist();

        updateWishlistCount();


        attempts++;


        if (attempts >= 20) {

          clearInterval(navbarTimer);

        }

      }, 300);

  }


  /* =========================================================
     STORAGE EVENT
     ========================================================= */

  window.addEventListener(
    "storage",
    function (event) {

      if (
        event.key ===
        WISHLIST_KEY
      ) {

        updateWishlistCount();

        syncWishlistButtons();

        renderWishlist();

      }

    }
  );


  /* =========================================================
     DOM READY
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initWishlist
    );

  } else {

    initWishlist();

  }


  /* =========================================================
     OPTIONAL GLOBAL FUNCTIONS
     ========================================================= */

  window.GloriyaWishlist = {

    get:
      getWishlistIds,


    add: function (id) {

      const ids =
        getWishlistIds();


      const productId =
        String(id);


      if (
        !ids.includes(productId)
      ) {

        ids.push(productId);

        saveWishlistIds(ids);

      }


      renderWishlist();

    },


    remove:
      removeFromWishlist,


    toggle:
      toggleWishlist,


    refresh:
      renderWishlist

  };


})();