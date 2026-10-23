import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { env } from "./config/env.js";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";
import ordersRouter from "./routes/orders.js";
import adminRouter from "./routes/admin.js";
import reminderRouter from "./routes/reminder.js";
import reviewsRouter from "./routes/reviews.js";
import contactRouter from "./routes/contact.js";
import Product from "./models/Product.js";
import Trending from "./models/Trending.js";
import { errorHandler } from "./middleware/error.js";
import { findMedia, openMediaStream, MIME_BY_EXT } from "./services/mediaStore.js";
import { publicMediaUrl } from "./utils/mediaUrl.js";

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [...new Set([
  ...String(env.CORS_ORIGIN || "https://gloriya.in,https://www.gloriya.in")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && value !== "*"),
  String(env.SITE_ORIGIN || "https://gloriya.in").trim().replace(/\/$/, "")
])];

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser/server-to-server requests with no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Local Vite development frontend.
    if (/^https?:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

// 1) Files uploaded from the admin panel live in MongoDB (GridFS) - served with Range support for video.
app.get("/uploads/:name", async (req, res, next) => {
  try {
    const name = path.basename(req.params.name);
    const file = await findMedia(name);
    if (!file) return next();
    const ext = path.extname(name).slice(1).toLowerCase();
    const type = file.contentType || file.metadata?.contentType || MIME_BY_EXT[ext] || "application/octet-stream";
    const size = file.length;
    res.set({
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    if (ext === "svg") res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      let end = m[1] && m[2] ? Number(m[2]) : size - 1;
      end = Math.min(end, size - 1);
      if (start > end || start >= size) return res.status(416).set("Content-Range", `bytes */${size}`).end();
      res.status(206).set({ "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      return openMediaStream(name, { start, end }).on("error", next).pipe(res);
    }
    res.set("Content-Length", size);
    if (req.method === "HEAD") return res.end();
    openMediaStream(name).on("error", next).pipe(res);
  } catch (e) { next(e); }
});

// 2) Older images shipped with the project (frontend/public/uploads).
app.use("/uploads", express.static(uploadDir, { maxAge: "7d" }));

// 3) Last resort: the storefront also ships those images, so send the browser there instead of a 404.
app.use("/uploads", (req, res) => {
  const site = String(env.SITE_ORIGIN || "").replace(/\/$/, "");
  const api = String(env.API_ORIGIN || "").replace(/\/$/, "");
  if (!site || site === api) return res.status(404).end();
  res.redirect(302, `${site}/uploads${req.path}`);
});

app.use("/api/products", productsRouter);
app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/reminder", reminderRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/contact", contactRouter);

app.get("/api/trending", async (_req, res, next) => {
  try {
    const doc = await Trending.findOne({}).lean();
    res.json({ slots: Array.isArray(doc?.slots) ? doc.slots.slice(0, 4) : [] });
  } catch (e) { next(e); }
});

app.get("/api", (_req, res) => res.json({ status: "ok", message: "Gloriya Jewellery API running ✅", database: "mongodb" }));

function esc(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const BOT_UA = /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|linkedinbot|pinterest|discordbot|skypeuripreview|googlebot|bingbot|applebot|instagram|embedly|vkshare|redditbot|iframely|snapchat/i;

// Share link for a product. Chat/social apps read the title, description and image from this page;
// real visitors are sent straight to the product page (no "one moment please" page).
app.get("/meta/product/:product_id", async (req, res, next) => {
  try {
    const p = await Product.findOne({ id: Number(req.params.product_id) }).lean();
    if (!p) return res.status(404).send("Product not found");
    const site = String(env.SITE_ORIGIN || "https://gloriya.in").replace(/\/$/, "");
    const canonical = `${site}/product.html?id=${p.id}`;
    if (!BOT_UA.test(String(req.headers["user-agent"] || ""))) return res.redirect(302, canonical);
    const title = String(p.name || "Gloriya Jewellery");
    const firstImage = p.image || (p.media || []).map(m => typeof m === "string" ? m : m?.url).find(Boolean) || "";
    const image = publicMediaUrl(firstImage) || `${site}/images/logo.png`;
    const price = Number(p.price) > 0 ? `₹${Math.round(p.price)} · ` : "";
    const desc = (price + String(p.description || "Handcrafted jewellery from Gloriya Jewellery").replace(/\s+/g, " ")).slice(0, 200);
    res.set("Cache-Control", "public, max-age=300").type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta property="og:site_name" content="Gloriya Jewellery"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}"><link rel="canonical" href="${esc(canonical)}"></head><body><a href="${esc(canonical)}">${esc(title)}</a></body></html>`);
  } catch (e) { next(e); }
});

app.get("/test-mail", async (_req, res) => {
  const recipient = env.MAIL_TEST_RECIPIENT || env.MAIL_SHOP_RECIPIENT || env.MAIL_CONTACT_RECIPIENT || env.MAIL_DEFAULT_SENDER || env.MAIL_USERNAME;
  if (!recipient) return res.status(400).json({ error: "No mail recipient is configured" });
  const { sendEmail } = await import("./services/mail.js");
  try {
    const result = await sendEmail("Test Mail from Gloriya", recipient, { htmlBody: "<p>This is a test email from the Gloriya server.</p>", textBody: "This is a test email from the Gloriya server." });
    if (result.ok) return res.json({ status: "ok", message: `Mail sent to ${recipient}` });
    return res.status(502).json({ error: "Mail sending failed", details: result.error, provider: result.details || null });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
});

app.use(errorHandler);
export default app;
