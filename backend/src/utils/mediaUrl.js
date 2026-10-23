import { env } from "../config/env.js";

function hostOf(origin) {
  try { return new URL(origin).host.toLowerCase(); } catch { return ""; }
}

function apiOrigin() {
  return String(env.API_ORIGIN || "").replace(/\/+$/, "");
}

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * URL stored in MongoDB: a path like "/uploads/abc.jpg" when the file belongs to
 * this project (so it keeps working if the domain changes), otherwise unchanged.
 */
export function toStoredUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/placeholder-local/i.test(raw)) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const own = [hostOf(apiOrigin()), hostOf(env.SITE_ORIGIN)].filter(Boolean);
      if (u.pathname.startsWith("/uploads/") && (own.includes(u.host.toLowerCase()) || LOCAL_HOSTS.test(u.host))) {
        return decodeURI(u.pathname);
      }
    } catch { /* keep raw */ }
    return raw;
  }
  return raw.startsWith("uploads/") ? `/${raw}` : raw;
}

/**
 * URL sent to browsers. Uploaded files live on the API server, so they are made
 * absolute to the API origin. This is what makes images show up on gloriya.in.
 */
export function publicMediaUrl(value) {
  const stored = toStoredUrl(value);
  if (!stored) return "";
  if (/^(https?:)?\/\//i.test(stored) || stored.startsWith("data:")) return stored;
  const path = `/${stored.replace(/^\/+/, "")}`;
  const origin = apiOrigin();
  if (path.startsWith("/uploads/") && origin) return `${origin}${encodeURI(decodeURI(path))}`;
  return path;
}
