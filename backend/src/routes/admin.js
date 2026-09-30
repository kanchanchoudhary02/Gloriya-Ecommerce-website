import express from "express";
import Razorpay from "razorpay";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Discount from "../models/Discount.js";
import { env } from "../config/env.js";
import { nextNumericId } from "../utils/ids.js";
import { sendEmail, sendShippingStatusEmail } from "../services/mail.js";
import { requireAdmin } from "../utils/authToken.js";
import { enrichProducts } from "../utils/enrichProduct.js";
import Trending from "../models/Trending.js";
import ReturnRequest from "../models/ReturnRequest.js";
import Review from "../models/Review.js";

const router = express.Router();

// Public read-only discounts endpoint is kept here for storefront price rendering.
router.get("/discounts", async (_req, res) => res.json(await Discount.find({}).lean()));

router.use(requireAdmin);
const uploadDir = path.resolve(env.UPLOAD_DIR);
const allowed = new Set(["jpg", "jpeg", "png", "webp", "svg", "gif", "mp4", "webm"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 10 } });

router.post("/uploads", upload.array("media", 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ msg: "No files uploaded" });
  await fs.mkdir(uploadDir, { recursive: true }); const saved = [];
  for (const file of req.files) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!allowed.has(ext)) return res.status(400).json({ msg: `File type not allowed: ${file.originalname}` });
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
    await fs.writeFile(path.join(uploadDir, name), file.buffer);
    saved.push({ url: `/uploads/${name}`, type: file.mimetype.startsWith("video/") || ["mp4", "webm"].includes(ext) ? "video" : "image", filename: name });
  }
  res.json({ msg: "Uploaded", media: saved });
});

router.get("/trending", async (_req, res) => {
  const doc = await Trending.findOne({}).lean();
  res.json({ slots: Array.isArray(doc?.slots) ? doc.slots.slice(0, 4) : [] });
});

router.put("/trending", async (req, res) => {
  const incoming = Array.isArray(req.body?.slots) ? req.body.slots : [];
  const slots = incoming.slice(0, 4).map((x, i) => ({
    slot: i + 1,
    url: String(x?.url || "").trim(),
    link: String(x?.link || "").trim(),
    alt: String(x?.alt || `Trending ${i + 1}`).trim()
  })).filter(x => x.url);
  const doc = await Trending.findOneAndUpdate({}, { $set: { slots } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ msg: "Trending images updated", slots: doc.slots.slice(0, 4) });
});

router.delete("/trending/:slot", async (req, res) => {
  const slot = Number(req.params.slot);
  const doc = await Trending.findOne({});
  if (!doc) return res.json({ slots: [] });
  doc.slots = (doc.slots || []).filter(x => Number(x.slot) !== slot).slice(0, 4);
  doc.slots.forEach((x, i) => { x.slot = i + 1; });
  await doc.save();
  res.json({ slots: doc.slots });
});

router.get("/summary", async (_req, res) => {
  const [total_users, total_products, total_orders, pending_orders] = await Promise.all([
    User.countDocuments(), Product.countDocuments(), Order.countDocuments(), Order.countDocuments({ status: "pending" })
  ]);
  res.json({ total_users, total_products, total_orders, pending_orders });
});
router.get("/users", async (_req, res) => {
  const users = await User.find({}).lean();
  res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, orders: (u.orders || []).length, wishlist: (u.wishlist || []).length })));
});
router.get("/products", async (_req, res) => res.json(enrichProducts(await Product.find({}).lean())));

function normalize(payload) {
  const media = payload.media || [], first = media.find(m => m?.type === "image") || media[0], inventory = Number.parseInt(payload.inventory ?? 0, 10) || 0;
  return { name: payload.name ?? "Untitled", price: payload.price ?? 0, description: payload.description ?? "", sku: payload.sku ?? "", inventory, stock: inventory > 0, category: payload.category ?? "", attributes: payload.attributes || {}, tags: payload.tags || [], shipping: payload.shipping || {}, return_policy: payload.return_policy || "", restock_request: Boolean(payload.restock_request), media, image: first?.url || payload.image || "", reminders: payload.reminders || [], size: payload.size ?? "", trending: Boolean(payload.trending) };
}
router.post("/products", async (req, res) => {
  const p = normalize(req.body || {}); p.id = await nextNumericId(Product);
  const product = await Product.create(p); res.status(201).json({ msg: "Product added", product });
});
router.patch("/products/:product_id/trending", async (req, res) => {
  const id = Number(req.params.product_id);
  const enabled = Boolean(req.body?.trending);
  const product = await Product.findOne({ id });
  if (!product) return res.status(404).json({ msg: "Product not found" });

  if (enabled) {
    const count = await Product.countDocuments({ trending: true, id: { $ne: id } });
    if (count >= 4) {
      return res.status(400).json({ msg: "Only 4 products can be in Trending at one time." });
    }
  }

  product.trending = enabled;
  await product.save();
  res.json({ msg: enabled ? "Product added to Trending" : "Product removed from Trending", product });
});

router.put("/products/:product_id", async (req, res) => {
  const id = Number(req.params.product_id), product = await Product.findOne({ id });
  if (!product) return res.status(404).json({ msg: "Product not found" });
  if (req.body?.trending === true && !product.trending) {
    const count = await Product.countDocuments({ trending: true, id: { $ne: id } });
    if (count >= 4) return res.status(400).json({ msg: "Only 4 products can be in Trending at one time." });
  }
  const prevStock = product.stock, updated = normalize(req.body || {});
  Object.assign(product, updated); product.id = id;
  if (!("reminders" in (req.body || {}))) product.reminders = product.reminders || [];
  await product.save();
  if (!prevStock && product.stock && product.reminders?.length) {
    for (const email of product.reminders) { try { await sendEmail(`🎉 ${product.name} is back in stock!`, email, { textBody: `Hi! The product '${product.name}' is now available again on Gloriya Jewellery.` }); } catch {} }
    product.reminders = []; await product.save();
  }
  res.json({ msg: "Product updated", product });
});
router.delete("/products/:product_id", async (req, res) => { const r = await Product.deleteOne({ id: Number(req.params.product_id) }); if (!r.deletedCount) return res.status(404).json({ msg: "Product not found" }); res.json({ msg: "Product deleted" }); });


async function adminRefundOrder(order, reason="Gloriya Jewellery refund") {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !order?.payment_id) return { ok:false, error:"Missing Razorpay payment configuration or payment ID." };
  try {
    const client = new Razorpay({ key_id:env.RAZORPAY_KEY_ID, key_secret:env.RAZORPAY_KEY_SECRET });
    const refund = await client.payments.refund(String(order.payment_id), { amount:Math.round(Number(order.amount||0)*100), notes:{reason:String(reason).slice(0,200), order_id:String(order.order_id||"")} });
    return { ok:true, refund_id:refund?.id || "", status:refund?.status || "processed" };
  } catch(error) { return { ok:false, error:error?.error?.description || error?.description || error?.message || String(error) }; }
}

router.get("/cancellations", async (_req,res) => {
  const orders = await Order.find({ status:"cancelled" }).sort({ cancelledAt:-1, updatedAt:-1 }).lean();
  res.json(orders);
});

router.post("/cancellations/:order_id/refund", async (req,res) => {
  try {
    const order = await Order.findOne({ order_id:String(req.params.order_id), status:"cancelled" });
    if (!order) return res.status(404).json({msg:"Cancelled order not found"});
    if (!order.payment_id) return res.status(400).json({msg:"No Razorpay payment ID is stored for this order, so an online refund cannot be initiated."});
    if (String(order.refund_status||"").toLowerCase() === "processed") return res.json({success:true,refund_status:"processed",refund_id:order.refund_id,msg:"Refund is already processed."});
    const refund = await adminRefundOrder(order, `Customer cancellation refund: ${order.cancel_reason || "Customer cancelled the order"}`);
    order.refund_status = refund.ok ? "processed" : "failed";
    order.refund_id = refund.refund_id || order.refund_id || "";
    order.refund_error = refund.error || "";
    await order.save();
    if (refund.ok && order.user_email) {
      try { await sendEmail("Refund processed — Gloriya Jewellery", order.user_email, { textBody:`Your refund for cancelled order ${order.order_id} has been processed. Refund ID: ${order.refund_id}.` }); } catch {}
    }
    res.json({success:refund.ok,refund_status:order.refund_status,refund_id:order.refund_id,error:order.refund_error,msg:refund.ok?"Refund processed successfully.":"Refund could not be processed. Check the error and retry."});
  } catch(e) { res.status(500).json({msg:e?.message || "Refund failed"}); }
});
router.get("/returns", async (_req,res) => {
  const requests = await ReturnRequest.find({}).sort({ requestedAt:-1 }).lean();
  res.json(requests);
});
router.put("/returns/:request_id", async (req,res) => {
  const request = await ReturnRequest.findById(req.params.request_id);
  if (!request) return res.status(404).json({msg:"Return request not found"});
  const action = String(req.body?.action || "").toLowerCase();
  if (!["approve","reject"].includes(action)) return res.status(400).json({msg:"Invalid return action"});
  const order = await Order.findOne({order_id:request.order_id});
  if (!order) return res.status(404).json({msg:"Order not found"});
  request.status = action === "approve" ? "approved" : "rejected";
  request.resolvedAt = new Date();
  if (action === "reject") {
    request.refund_status = "not_required";
    await request.save();
    res.json({success:true,status:request.status,msg:"Return request rejected."});
    return;
  }
  if (String(order.payment_status||"").toLowerCase() === "captured" && order.payment_id) {
    const refund = await adminRefundOrder(order, `Return approved: ${request.reason}`);
    request.refund_status = refund.ok ? "processed" : "failed";
    request.refund_id = refund.refund_id || "";
    request.refund_error = refund.error || "";
    request.refund_amount = Number(order.amount||0);
    order.refund_status = request.refund_status; order.refund_id = request.refund_id; order.refund_error = request.refund_error;
  } else request.refund_status = "not_required";
  order.return_status = "approved"; order.return_request_id = String(request._id);
  await order.save(); await request.save();
  try { if (order.user_email) await sendEmail(`Return request ${request.status} - Gloriya Jewellery`, order.user_email, { textBody:`Your return request for order ${order.order_id} was approved. ${request.refund_id ? `Refund ID: ${request.refund_id}.` : request.refund_error ? `Refund requires attention: ${request.refund_error}` : "No online refund was required."}` }); } catch(e) { console.error("Return decision email failed",e); }
  res.json({success:true,status:request.status,refund_status:request.refund_status,refund_id:request.refund_id,msg:request.refund_status === "failed" ? "Return approved but refund needs attention." : "Return approved successfully."});
});
router.post("/returns/:request_id/refund", async (req,res) => {
  const request = await ReturnRequest.findById(req.params.request_id); if (!request) return res.status(404).json({msg:"Return request not found"});
  const order = await Order.findOne({order_id:request.order_id}); if (!order) return res.status(404).json({msg:"Order not found"});
  const refund = await adminRefundOrder(order, `Manual refund for return: ${request.reason}`);
  request.refund_status = refund.ok ? "processed" : "failed"; request.refund_id = refund.refund_id || request.refund_id || ""; request.refund_error = refund.error || ""; request.refund_amount = Number(order.amount||0);
  order.refund_status=request.refund_status; order.refund_id=request.refund_id; order.refund_error=request.refund_error;
  await request.save(); await order.save();
  res.json({success:refund.ok,refund_status:request.refund_status,refund_id:request.refund_id,error:request.refund_error,msg:refund.ok?"Refund processed.":"Refund failed."});
});

router.get("/orders", async (_req, res) => res.json(await Order.find({ status: { $ne: "cancelled" } }).sort({ timestamp: -1 }).lean()));
router.get("/orders/:order_id", async (req, res) => { const o = await Order.findOne({ id: Number(req.params.order_id) }).lean(); if (!o) return res.status(404).json({ msg: "Order not found" }); res.json(o); });
router.put("/orders/:order_id", async (req, res) => {
  const o = await Order.findOne({ id: Number(req.params.order_id) });
  if (!o) return res.status(404).json({ msg: "Order not found" });

  const previousStatus = String(o.status || "");
  const nextStatus = String(req.body?.status ?? previousStatus ?? "pending");
  const allowedStatuses = new Set(["created","completed","packed","shipped","out_for_delivery","delivered","cancelled"]);
  if (!allowedStatuses.has(nextStatus)) {
    return res.status(400).json({ msg: "Invalid order status" });
  }

  o.status = nextStatus;
  if (nextStatus === "delivered" && previousStatus !== "delivered") o.deliveredAt = new Date();
  if (nextStatus === "cancelled" && previousStatus !== "cancelled") o.cancelledAt = new Date();
  await o.save();

  let email = null;
  if (nextStatus === "cancelled" && previousStatus !== "cancelled") {
    o.cancel_reason = String(req.body?.reason || "Order cancelled by store").slice(0,300);
    if (String(o.payment_status||"").toLowerCase() === "captured" && o.payment_id) {
      const refund = await adminRefundOrder(o, `Admin cancellation: ${o.cancel_reason}`);
      o.refund_status = refund.ok ? "processed" : "failed"; o.refund_id = refund.refund_id || ""; o.refund_error = refund.error || "";
    } else o.refund_status = "not_required";
    await o.save();
    try { if (o.user_email) email = await sendEmail("Your Gloriya Jewellery order has been cancelled", o.user_email, { textBody:`Your order ${o.order_id} was cancelled by the store. ${o.refund_id ? `Refund ID: ${o.refund_id}.` : o.refund_error ? `Refund needs attention: ${o.refund_error}` : ""}` }); } catch(error) { console.error("Admin cancellation email failed",error); }
  }
  if (nextStatus !== previousStatus && ["packed","shipped","out_for_delivery","delivered"].includes(nextStatus)) {
    try {
      email = await sendShippingStatusEmail(o.toObject(), nextStatus);
    } catch (error) {
      console.error("Shipping status email failed:", error);
      email = { ok:false, error:String(error?.message || error) };
    }
  }

  res.json({ msg: "Order updated", status: nextStatus, email_sent: Boolean(email?.ok), email });
});
router.delete("/orders/:order_id", async (req, res) => { const r = await Order.deleteOne({ id: Number(req.params.order_id) }); if (!r.deletedCount) return res.status(404).json({ msg: "Order not found" }); res.json({ msg: "Order deleted" }); });

router.post("/discounts", async (req, res) => { const b = req.body || {}, disc = await Discount.create({ id: await nextNumericId(Discount), title: b.title || "", type: b.type || "percentage", value: b.value || 0, product_ids: b.product_ids || [], active: Boolean(b.active ?? true), starts_at: b.starts_at ?? null, ends_at: b.ends_at ?? null }); res.status(201).json({ msg: "Discount created", discount: disc }); });
router.put("/discounts/:discount_id", async (req, res) => { const d = await Discount.findOne({ id: Number(req.params.discount_id) }); if (!d) return res.status(404).json({ msg: "Not found" }); Object.assign(d, req.body || {}); await d.save(); res.json({ msg: "Updated", discount: d }); });
router.delete("/discounts/:discount_id", async (req, res) => { const r = await Discount.deleteOne({ id: Number(req.params.discount_id) }); if (!r.deletedCount) return res.status(404).json({ msg: "Not found" }); res.json({ msg: "Deleted" }); });

export default router;
