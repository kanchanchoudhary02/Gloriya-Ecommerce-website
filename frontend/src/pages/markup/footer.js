export const markup = `<footer class="gl-footer mt-5">
  <div class="container py-5">
    <div class="row g-4">
      <div class="col-12 col-lg-4">
        <a href="/index.html" class="gl-footer-brand">Gloriya Jewellery</a>
        <p class="gl-footer-text mt-3 mb-0">Elegant jewellery crafted to celebrate everyday moments, special occasions and timeless style.</p>
      </div>
      <div class="col-6 col-lg-2">
        <h5>Navigate</h5>
        <ul class="gl-footer-links">
          <li><a href="/index.html">Home</a></li><li><a href="/shop.html">Shop</a></li><li><a href="/about.html">About</a></li><li><a href="/contact.html">Contact</a></li><li><a href="/wishlist.html">Wishlist</a></li>
        </ul>
      </div>
      <div class="col-6 col-lg-3">
        <h5>Shop Categories</h5>
        <ul class="gl-footer-links">
          <li><a href="/shop.html?cat=ring">Ring</a></li><li><a href="/shop.html?cat=necklace">Necklace</a></li><li><a href="/shop.html?cat=bangles">Bangles</a></li><li><a href="/shop.html?cat=maang-teeka">Maang Teeka</a></li><li><a href="/shop.html?cat=bracelet">Bracelet</a></li><li><a href="/shop.html?cat=matha-patti">Matha Patti</a></li><li><a href="/shop.html?cat=borla">Borla</a></li><li><a href="/shop.html?cat=western-jewellery">Western Jewellery</a></li><li><a href="/shop.html?cat=nose-pin">Nose Pin</a></li><li><a href="/shop.html?cat=watch">Watch</a></li><li><a href="/shop.html?cat=earring">Earring</a></li>
        </ul>
      </div>
      <div class="col-12 col-lg-3">
        <h5>Contact</h5>
        <ul class="gl-footer-contact">
          <li><i class="fa-solid fa-location-dot"></i><span>Jaipur, Rajasthan, India</span></li>
          <li><i class="fa-solid fa-envelope"></i><a href="mailto:gloriyafashionjewel@gmail.com">gloriyafashionjewel@gmail.com</a></li>
          <li><i class="fa-solid fa-phone"></i><a href="tel:+919414042089">+91 94140 42089</a></li>
          <li><i class="fa-brands fa-whatsapp"></i><a href="https://wa.me/919414042089" target="_blank" rel="noopener">WhatsApp</a></li>
        </ul>
      </div>
    </div>
  </div>
  <div class="gl-footer-bottom"><div class="container d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
    <span>© <span id="year"></span> Gloriya Jewellery. All rights reserved.</span>
    <div class="d-flex gap-3"><a href="/shop.html">Shop Collection</a><a href="/contact.html">Contact Us</a></div>
  </div></div>
</footer>
<style>
.gl-footer{background:#fbf5f2;border-top:3px solid var(--accent);color:#5f5551}.gl-footer h5{color:#2b1e1c;font-size:1rem;font-weight:700;margin-bottom:1rem}.gl-footer-brand{color:#2b1e1c;font-family:"Playfair Display",serif;font-size:1.55rem;font-weight:600;text-decoration:none}.gl-footer-brand:hover{color:var(--accent)}.gl-footer-text{max-width:360px;line-height:1.7;font-size:.92rem}.gl-footer-links,.gl-footer-contact{list-style:none;padding:0;margin:0}.gl-footer-links li{margin-bottom:.55rem}.gl-footer-links a,.gl-footer-contact a{color:#5f5551;text-decoration:none;transition:.2s ease}.gl-footer-links a:hover,.gl-footer-contact a:hover{color:#a86f64}.gl-footer-contact li{display:flex;gap:10px;align-items:flex-start;margin-bottom:.7rem;font-size:.9rem}.gl-footer-contact i{width:18px;margin-top:3px;color:#a86f64}.gl-footer-bottom{border-top:1px solid #eaded8;padding:16px 0;font-size:.82rem}.gl-footer-bottom a{color:#5f5551;text-decoration:none}.gl-footer-bottom a:hover{color:#a86f64}
</style>`;
export const script = `document.getElementById("year").textContent = new Date().getFullYear();`;
