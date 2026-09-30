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

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = String(env.CORS_ORIGIN || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser/server-to-server requests with no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return callback(null, true);
    // Local Vite development frontend.
    if (/^https?:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

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

function absImageUrl(img) {
  if (!img) return "";
  if (/^https?:\/\//i.test(img)) return img;
  return `${env.SITE_ORIGIN.replace(/\/$/, "")}/${String(img).replace(/^\//, "")}`;
}
function esc(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

app.get("/meta/product/:product_id", async (req, res, next) => {
  try {
    const p = await Product.findOne({ id: Number(req.params.product_id) }).lean();
    if (!p) return res.status(404).send("Product not found");
    const title = String(p.name || "Gloriya Jewellery"), image = absImageUrl(p.image) || `${env.SITE_ORIGIN}/images/og-placeholder.png`;
    const canonical = `${env.SITE_ORIGIN.replace(/\/$/, "")}/product.html?id=${p.id}`;
    const desc = String(p.description || "").slice(0, 200);
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(image)}"><meta property="og:type" content="product"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}"><link rel="canonical" href="${esc(canonical)}"><title>${esc(title)}</title><meta http-equiv="refresh" content="0;url=${esc(canonical)}"><script>setTimeout(()=>location.href=${JSON.stringify(canonical)},500)</script></head><body><p>Redirecting to product page… <a href="${esc(canonical)}">click here</a>.</p></body></html>`);
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
