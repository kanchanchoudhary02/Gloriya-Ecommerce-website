import express from "express";
import User from "../models/User.js";
import { createWerkzeugScryptHash, verifyWerkzeugPassword } from "../utils/password.js";
import { nextNumericId } from "../utils/ids.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/mail.js";
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, authCookieOptions, createAuthToken, requireAuth } from "../utils/authToken.js";
import crypto from "node:crypto";
import { env } from "../config/env.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const data = req.body || {};
  const email = String(data.email ?? "").trim().toLowerCase();

  if (!email || !data.password || !data.name) return res.status(400).json({ msg: "Missing fields: name, email, password are required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: "Please enter a valid email." });
  if (await User.exists({ email })) return res.status(400).json({ msg: "Email already registered" });
  const user = await User.create({ id: await nextNumericId(User), name: data.name, email, password: createWerkzeugScryptHash(data.password), role: "user", phone: data.phone || "", address: data.address || "", city: data.city || "", pincode: data.pincode || "", wishlist: [], cart: [], orders: [] });
  try { await sendWelcomeEmail(user.toObject()); } catch {}
  res.status(201).json({ msg: "User registered successfully" });
});

router.post("/login", async (req, res) => {
  const data = req.body || {};
  const email = String(data.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: "Please enter a valid email." });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (!verifyWerkzeugPassword(String(user.password || ""), String(data.password || ""))) return res.status(401).json({ msg: "Invalid password" });
  const redirect = user.role === "admin" ? "/admin/admin.html" : "/user/dashboard.html";
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone || "", address: user.address || "", city: user.city || "", pincode: user.pincode || "", wishlist: user.wishlist || [], cart: user.cart || [], orders: user.orders || [] };
  let token;
  try { token = createAuthToken(user); } catch (error) { return res.status(503).json({ msg: "Authentication service is not configured on the server" }); }
  res.cookie(AUTH_COOKIE_NAME, token, { ...authCookieOptions(req.get("origin")), maxAge: AUTH_TOKEN_TTL_SECONDS * 1000 });
  res.json({ msg: "Login successful", token, user: safeUser, redirect });
});

router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions(req.get("origin")));
  res.json({ msg: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findOne({ id: Number(req.auth.sub) }).lean();
  if (!user) return res.status(404).json({ msg: "User not found" });
  res.json({ user: { id:user.id,name:user.name,email:user.email,role:user.role,phone:user.phone||"",address:user.address||"",city:user.city||"",pincode:user.pincode||"",wishlist:user.wishlist||[],cart:user.cart||[],orders:user.orders||[] } });
});

router.put("/me", requireAuth, async (req, res) => {
  const user = await User.findOne({ id: Number(req.auth.sub) });
  if (!user) return res.status(404).json({ msg: "User not found" });
  for (const key of ["name","phone","address","city","pincode"]) {
    if (key in (req.body || {})) user[key] = String(req.body[key] || "").trim();
  }
  await user.save();
  res.json({ msg:"Profile updated", user:{ id:user.id,name:user.name,email:user.email,role:user.role,phone:user.phone||"",address:user.address||"",city:user.city||"",pincode:user.pincode||"",wishlist:user.wishlist||[],cart:user.cart||[],orders:user.orders||[] } });
});

router.put("/wishlist", requireAuth, async (req, res) => {
  const user = await User.findOne({ id: Number(req.auth.sub) });
  if (!user) return res.status(404).json({ msg: "User not found" });
  const ids = Array.isArray(req.body?.wishlist) ? req.body.wishlist.map(x => String(x)).filter(Boolean) : [];
  user.wishlist = [...new Set(ids)];
  await user.save();
  res.json({ wishlist: user.wishlist });
});

router.put("/cart", requireAuth, async (req, res) => {
  const user = await User.findOne({ id: Number(req.auth.sub) });
  if (!user) return res.status(404).json({ msg: "User not found" });
  user.cart = Array.isArray(req.body?.cart) ? req.body.cart.slice(0, 100) : [];
  await user.save();
  res.json({ cart: user.cart });
});

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ msg:"Email is required" });
  const user = await User.findOne({ email });
  // Do not reveal whether an account exists.
  if (!user) return res.json({ msg:"If an account exists for this email, a reset link has been sent." });
  const raw = crypto.randomBytes(32).toString("hex");
  user.resetTokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  const base = String(env.SITE_ORIGIN || "https://gloriya.in").replace(/\/$/, "");
  const result = await sendPasswordResetEmail(user.toObject(), `${base}/reset.html?token=${encodeURIComponent(raw)}`);
  if (!result.ok) return res.status(503).json({ msg:"Unable to send reset email right now." });
  res.json({ msg:"If an account exists for this email, a reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!token || password.length < 6) return res.status(400).json({ msg:"A valid reset token and password of at least 6 characters are required." });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({ resetTokenHash:hash, resetTokenExpires:{ $gt:new Date() } });
  if (!user) return res.status(400).json({ msg:"Reset link is invalid or expired. Please request a new one." });
  user.password = createWerkzeugScryptHash(password);
  user.resetTokenHash = "";
  user.resetTokenExpires = null;
  await user.save();
  res.json({ msg:"Password reset successful. You can now log in." });
});

export default router;
