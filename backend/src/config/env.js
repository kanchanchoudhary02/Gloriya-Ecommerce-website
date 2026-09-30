import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const env = {
  // Server
  PORT: Number(process.env.PORT || 5000),

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || "",

  // Frontend
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  SITE_ORIGIN:
    process.env.SITE_ORIGIN || "https://gloriya.in",
  API_ORIGIN:
    process.env.API_ORIGIN || process.env.RENDER_EXTERNAL_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://gloriya-ecommerce-website.onrender.com"
      : `http://localhost:${Number(process.env.PORT || 5000)}`),

  // Auth
  SESSION_SECRET: process.env.SESSION_SECRET || "",

  // Uploads
  UPLOAD_DIR:
    process.env.UPLOAD_DIR || path.join(PROJECT_ROOT, "frontend", "public", "uploads"),

  // Razorpay
  RAZORPAY_KEY_ID:
    process.env.RAZORPAY_KEY_ID || "",

  RAZORPAY_KEY_SECRET:
    process.env.RAZORPAY_KEY_SECRET || "",

  // =====================================================
  // RESEND EMAIL
  // =====================================================

  RESEND_API_KEY:
    process.env.RESEND_API_KEY || "",

  MAIL_FROM:
    process.env.MAIL_FROM || "onboarding@resend.dev",

  MAIL_CONTACT_RECIPIENT:
    process.env.MAIL_CONTACT_RECIPIENT || "",

  MAIL_SHOP_RECIPIENT:
    process.env.MAIL_SHOP_RECIPIENT || "",

  // =====================================================
  // OLD MAIL SETTINGS
  // Not used by the new Resend mail.js
  // =====================================================

  MAIL_HOST:
    process.env.MAIL_HOST || "",

  MAIL_PORT:
    Number(process.env.MAIL_PORT || 587),

  MAIL_USERNAME:
    process.env.MAIL_USERNAME || "",

  MAIL_PASSWORD:
    process.env.MAIL_PASSWORD || "",

  MAIL_DEFAULT_SENDER:
    process.env.MAIL_DEFAULT_SENDER || "",

  MAIL_TEST_RECIPIENT:
    process.env.MAIL_TEST_RECIPIENT || "",

  // Mailjet - not used
  MAILJET_API_KEY:
    process.env.MAILJET_API_KEY || "",

  MAILJET_API_SECRET:
    process.env.MAILJET_API_SECRET || "",
};

export { env };