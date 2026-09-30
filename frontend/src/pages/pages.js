import manifest from './manifest.json';
import { markup as markup_0 } from './markup/index.js';
const index = {name:"index", markup:markup_0, scripts:manifest["index"].scripts.concat(manifest["index"].inline), hasNotifier:false};
import { markup as markup_1 } from './markup/shop.js';
const shop = {name:"shop", markup:markup_1, scripts:manifest["shop"].scripts.concat(manifest["shop"].inline), hasNotifier:true};
import { markup as markup_2 } from './markup/product.js';
const product = {name:"product", markup:markup_2, scripts:manifest["product"].scripts.concat(manifest["product"].inline), hasNotifier:true};
import { markup as markup_3 } from './markup/cart.js';
const cart = {name:"cart", markup:markup_3, scripts:manifest["cart"].scripts.concat(manifest["cart"].inline), hasNotifier:false};
import { markup as markup_4 } from './markup/checkout.js';
const checkout = {name:"checkout", markup:markup_4, scripts:manifest["checkout"].scripts.concat(manifest["checkout"].inline), hasNotifier:false};
import { markup as markup_5 } from './markup/about.js';
const about = {name:"about", markup:markup_5, scripts:manifest["about"].scripts.concat(manifest["about"].inline), hasNotifier:false};
import { markup as markup_6 } from './markup/contact.js';
const contact = {name:"contact", markup:markup_6, scripts:manifest["contact"].scripts.concat(manifest["contact"].inline), hasNotifier:true};
import { markup as markup_7 } from './markup/login.js';
const login = {name:"login", markup:markup_7, scripts:manifest["login"].scripts.concat(manifest["login"].inline), hasNotifier:false};
import { markup as markup_8 } from './markup/register.js';
const register = {name:"register", markup:markup_8, scripts:manifest["register"].scripts.concat(manifest["register"].inline), hasNotifier:false};
import { markup as markup_9 } from './markup/wishlist.js';
const wishlist = {name:"wishlist", markup:markup_9, scripts:manifest["wishlist"].scripts.concat(manifest["wishlist"].inline), hasNotifier:false};
import { markup as markup_10 } from './markup/blog__art-of-gifting.js';
const blog__art_of_gifting = {name:"blog__art-of-gifting", markup:markup_10, scripts:manifest["blog__art-of-gifting"].scripts.concat(manifest["blog__art-of-gifting"].inline), hasNotifier:false};
import { markup as markup_11 } from './markup/blog__top-jewellery-trends-2025.js';
const blog__top_jewellery_trends_2025 = {name:"blog__top-jewellery-trends-2025", markup:markup_11, scripts:manifest["blog__top-jewellery-trends-2025"].scripts.concat(manifest["blog__top-jewellery-trends-2025"].inline), hasNotifier:false};
import { markup as markup_12 } from './markup/blog__caring-for-your-jewellery.js';
const blog__caring_for_your_jewellery = {name:"blog__caring-for-your-jewellery", markup:markup_12, scripts:manifest["blog__caring-for-your-jewellery"].scripts.concat(manifest["blog__caring-for-your-jewellery"].inline), hasNotifier:false};
import { markup as markup_13 } from './markup/admin__admin.js';
const admin__admin = {name:"admin__admin", markup:markup_13, scripts:manifest["admin__admin"].scripts.concat(manifest["admin__admin"].inline), hasNotifier:false};
import { markup as markup_14 } from './markup/user__dashboard.js';
const user__dashboard = {name:"user__dashboard", markup:markup_14, scripts:manifest["user__dashboard"].scripts.concat(manifest["user__dashboard"].inline), hasNotifier:false};
import { markup as markup_15 } from './markup/user__contact.js';
const user__contact = {name:"user__contact", markup:markup_15, scripts:manifest["user__contact"].scripts.concat(manifest["user__contact"].inline), hasNotifier:false};
import { markup as markup_16 } from './markup/user__wishlist.js';
const user__wishlist = {name:"user__wishlist", markup:markup_16, scripts:manifest["user__wishlist"].scripts.concat(manifest["user__wishlist"].inline), hasNotifier:false};
import { markup as markup_17 } from './markup/user__profile.js';
const user__profile = {name:"user__profile", markup:markup_17, scripts:manifest["user__profile"].scripts.concat(manifest["user__profile"].inline), hasNotifier:false};
export default {
  "index": index,
  "shop": shop,
  "product": product,
  "cart": cart,
  "checkout": checkout,
  "about": about,
  "contact": contact,
  "login": login,
  "register": register,
  "wishlist": wishlist,
  "blog__art-of-gifting": blog__art_of_gifting,
  "blog__top-jewellery-trends-2025": blog__top_jewellery_trends_2025,
  "blog__caring-for-your-jewellery": blog__caring_for_your_jewellery,
  "admin__admin": admin__admin,
  "user__dashboard": user__dashboard,
  "user__contact": user__contact,
  "user__wishlist": user__wishlist,
  "user__profile": user__profile,
};