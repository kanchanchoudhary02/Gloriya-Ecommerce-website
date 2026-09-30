import crypto from "node:crypto";
import { env } from "../config/env.js";

const secret = String(env.SESSION_SECRET || "").trim();
if (!secret) console.warn("SESSION_SECRET is not configured; login tokens are disabled until it is set.");

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload) {
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAuthToken(user, ttlSeconds = 60 * 60 * 12) {
  const payload = JSON.stringify({
    sub: Number(user.id),
    role: String(user.role || "user"),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  });
  const encoded = b64url(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAuthToken(token) {
  if (!secret || !token || typeof token !== "string") return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ msg: "Authentication required" });
  req.auth = payload;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "admin") return res.status(403).json({ msg: "Admin access required" });
    next();
  });
}
