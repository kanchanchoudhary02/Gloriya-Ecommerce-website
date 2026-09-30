import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const inputs = {
  index: path.resolve(process.cwd(), "index.html"),
  shop: path.resolve(process.cwd(), "shop.html"),
  product: path.resolve(process.cwd(), "product.html"),
  cart: path.resolve(process.cwd(), "cart.html"),
  checkout: path.resolve(process.cwd(), "checkout.html"),
  about: path.resolve(process.cwd(), "about.html"),
  contact: path.resolve(process.cwd(), "contact.html"),
  login: path.resolve(process.cwd(), "login.html"),
  register: path.resolve(process.cwd(), "register.html"),
  forgot: path.resolve(process.cwd(), "forgot.html"),
  reset: path.resolve(process.cwd(), "reset.html"),
  wishlist: path.resolve(process.cwd(), "wishlist.html"),
  "blog/art-of-gifting": path.resolve(process.cwd(), "blog/art-of-gifting.html"),
  "blog/top-jewellery-trends-2025": path.resolve(process.cwd(), "blog/top-jewellery-trends-2025.html"),
  "blog/caring-for-your-jewellery": path.resolve(process.cwd(), "blog/caring-for-your-jewellery.html"),
  "admin/admin": path.resolve(process.cwd(), "admin/admin.html"),
  "user/dashboard": path.resolve(process.cwd(), "user/dashboard.html"),
  "user/contact": path.resolve(process.cwd(), "user/contact.html"),
  "user/wishlist": path.resolve(process.cwd(), "user/wishlist.html"),
  "user/profile": path.resolve(process.cwd(), "user/profile.html")
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { input: inputs },
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000"
    }
  }
});
