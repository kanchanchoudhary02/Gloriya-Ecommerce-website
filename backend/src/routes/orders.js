import express from "express";
import Razorpay from "razorpay";
import crypto from "node:crypto";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Discount from "../models/Discount.js";
import ReturnRequest from "../models/ReturnRequest.js";
import { env } from "../config/env.js";
import { nextNumericId } from "../utils/ids.js";
import { sendOrderEmail, sendEmail, buildReceiptHtml, buildReceiptPdf, buildReceiptAccessToken } from "../services/mail.js";
import { requireAdmin, requireAuth } from "../utils/authToken.js";

const router = express.Router();

function discountActive(d) {
  if (!d || !d.active) return false;
  const now = Date.now();
  if (d.starts_at && now < new Date(d.starts_at).getTime()) return false;
  if (d.ends_at && now > new Date(d.ends_at).getTime()) return false;
  return true;
}
function applyDiscount(price, pid, discounts) {
  let final = Number(price || 0);
  for (const d of discounts || []) {
    if (!discountActive(d)) continue;
    const pids = Array.isArray(d.product_ids) ? d.product_ids.map(Number) : [];
    if (pids.length && !pids.includes(Number(pid))) continue;
    const value = Number(d.value || 0);
    final = String(d.type || "percentage").toLowerCase() === "percentage" ? final * (1 - value / 100) : final - value;
  }
  return Math.max(0, Math.round(final));
}
function razorClient() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  try { return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET }); } catch { return null; }
}
function receiptEndpoint(orderId) {
  return `${String(env.API_ORIGIN).replace(/\/+$/, "")}/api/orders/${encodeURIComponent(String(orderId))}/receipt`;
}
router.get("/", requireAdmin, async (_req, res) => res.json(await Order.find({}).sort({ timestamp: -1 }).lean()));
router.get("/user", requireAuth, async (req, res) => {
  const user = await User.findOne({ id: Number(req.auth.sub) }).lean();
  if (!user) return res.status(401).json({ msg: "User account not found" });
  const orders = await Order.find({ user_email: String(user.email).toLowerCase(), status: { $ne: "cancelled" } }).sort({ timestamp: -1 }).lean();
  res.json(orders.map(order => {
    const token = buildReceiptAccessToken(order);
    const base = receiptEndpoint(order.order_id);
    return { ...order, receipt_url: `${base}?customer=1&token=${encodeURIComponent(token)}`, receipt_download_url: `${base}?format=pdf&download=1&token=${encodeURIComponent(token)}` };
  }));
});

router.post("/create", async (req, res) => {
  const data = req.body || {}, items = data.items || data.cart || [];
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ msg: "Cart items required" });
  const products = await Product.find({}).lean(), discounts = await Discount.find({}).lean();
  const serverItems = [], problems = []; let total = 0;
  for (const it of items) {
    const pid = Number(it?.id ?? it?.product_id ?? it?.item_id), qty = Math.max(1, Number.parseInt(it?.qty ?? it?.quantity ?? 1, 10) || 1);
    if (!Number.isFinite(pid)) { problems.push({ item: it, reason: "invalid_id" }); continue; }
    const prod = products.find(p => Number(p.id) === pid);
    if (!prod) { problems.push({ id: pid, reason: "not_found" }); continue; }
    const invRaw = prod.inventory, stock = Boolean(prod.stock ?? true);
    if (invRaw !== undefined && invRaw !== null) {
      const inventory = Number.parseInt(invRaw, 10) || 0;
      if (inventory <= 0 || !stock) { problems.push({ id: pid, reason: "out_of_stock" }); continue; }
      if (qty > inventory) { problems.push({ id: pid, reason: "insufficient_stock", available: inventory, requested: qty }); continue; }
    } else if (!stock) { problems.push({ id: pid, reason: "out_of_stock" }); continue; }
    const finalUnit = applyDiscount(Math.round(Number(prod.price || 0)), pid, discounts), lineTotal = Math.round(finalUnit * qty);
    total += lineTotal;
    serverItems.push({ id: pid, name: prod.name, sku: prod.sku, qty, unit_price: finalUnit, line_total: lineTotal, image: prod.image || (prod.media?.[0]?.url || prod.media?.[0]) });
  }
  if (problems.length) return res.status(400).json({ msg: "Some items are out of stock or invalid", problems });
  const amount = Math.round(total), amountPaise = amount * 100;
  let razorOrder;
  try {
    const client = razorClient();
    if (!client) throw new Error("Razorpay client not configured");
    razorOrder = await client.orders.create({ amount: amountPaise, currency: "INR", payment_capture: 1 });
    if (!razorOrder?.id || Number(razorOrder.amount) !== amountPaise) {
      throw new Error("Razorpay returned an invalid order");
    }
  } catch (error) {
    const code = error?.error?.code || error?.code || "RAZORPAY_ORDER_CREATE_FAILED";
    const description = error?.error?.description || error?.description || error?.message || "Unable to create Razorpay order";
    console.error("Razorpay order creation failed:", { code, description, statusCode: error?.statusCode });
    return res.status(503).json({ msg: "Payment service is temporarily unavailable. Please try again later.", code, description });
  }
  const localOrderRecord = await Order.create({ id: await nextNumericId(Order), order_id: razorOrder.id || razorOrder.order_id || `local_${Date.now()}`, amount, currency: "INR", status: "created", user_email: data.email ? String(data.email).toLowerCase() : "", name: data.name, phone: data.phone, address: data.address, city: data.city, pincode: data.pincode, items: serverItems, raw_client_payload: data });
  res.json({ order: { ...razorOrder, key_id: env.RAZORPAY_KEY_ID }, local_order: localOrderRecord });
});

async function refundOrderPayment(order, reason="Gloriya Jewellery refund") {
  const client = razorClient();
  if (!client || !order?.payment_id) return { ok:false, error:"Payment refund is not available because Razorpay payment details are missing." };
  try {
    const refund = await client.payments.refund(String(order.payment_id), {
      amount: Math.max(0, Math.round(Number(order.amount || 0) * 100)),
      notes: { reason: String(reason).slice(0, 200), order_id: String(order.order_id || "") }
    });
    return { ok:true, refund_id: refund?.id || "", status: refund?.status || "processed" };
  } catch (error) {
    return { ok:false, error: error?.error?.description || error?.description || error?.message || String(error) };
  }
}

router.post("/:orderId/cancel", requireAuth, async (req,res,next)=>{
  try {
    const user = await User.findOne({ id:Number(req.auth.sub) }).lean();
    if (!user) return res.status(401).json({ msg:"User account not found" });
    const order = await Order.findOne({ order_id:String(req.params.orderId), user_email:String(user.email).toLowerCase() });
    if (!order) return res.status(404).json({ msg:"Order not found" });
    if (["cancelled","delivered"].includes(String(order.status))) return res.status(400).json({ msg:"This order can no longer be cancelled." });
    const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : new Date(order.timestamp || 0).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 24*60*60*1000) return res.status(400).json({ msg:"Order cancellation is available only within 24 hours of placing the order." });
    const reason = String(req.body?.reason || "Customer requested cancellation").trim().slice(0,300);
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancel_reason = reason;
    order.cancel_source = "customer";
    let refund = { ok:true, refund_id:"", status:"not_required" };
    if (order.payment_id) {
      order.refund_status = "pending";
      await order.save();
      refund = await refundOrderPayment(order, `Order cancellation: ${reason}`);
      order.refund_status = refund.ok ? "processed" : "failed";
      order.refund_id = refund.refund_id || "";
      order.refund_error = refund.error || "";
    } else { order.refund_status = "not_required"; }
    await order.save();
    const refundMessage = refund.ok && refund.refund_id
      ? "Your payment refund has been initiated and should be received within 24 hours."
      : refund.error
        ? "Your order was cancelled, but the online refund could not be initiated automatically. Our team will process it within 24 hours."
        : "No online payment refund was required for this order.";
    try { if (order.user_email) await sendEmail("Order cancelled & refund update — Gloriya Jewellery", order.user_email, { textBody:`Your order ${order.order_id} has been cancelled.\n\n${refundMessage}\n${refund.refund_id ? `Refund ID: ${refund.refund_id}` : ""}\n\nThank you for shopping with Gloriya Jewellery.` }); } catch(e) { console.error("Cancellation email failed",e); }
    res.json({ success:true, status:order.status, refund_status:order.refund_status, refund_id:order.refund_id, msg: `Order cancelled successfully. ${refundMessage}` });
  } catch(e){ next(e); }
});

router.post("/:orderId/return", requireAuth, async (req,res,next)=>{
  try {
    const user = await User.findOne({ id:Number(req.auth.sub) }).lean();
    if (!user) return res.status(401).json({ msg:"User account not found" });
    const order = await Order.findOne({ order_id:String(req.params.orderId), user_email:String(user.email).toLowerCase() }).lean();
    if (!order) return res.status(404).json({ msg:"Order not found" });
    if (String(order.status) !== "delivered") return res.status(400).json({ msg:"Return requests can be submitted after the order is delivered." });
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : new Date(order.updatedAt || order.createdAt || order.timestamp).getTime();
    if (!Number.isFinite(deliveredAt) || Date.now() - deliveredAt > 7*24*60*60*1000) return res.status(400).json({ msg:"Return requests are available within 7 days of delivery." });
    const existing = await ReturnRequest.findOne({ order_id:order.order_id, status:"pending" }).lean();
    if (existing) return res.status(400).json({ msg:"A return request is already pending for this order." });
    const reason = String(req.body?.reason || "Other").trim().slice(0,200);
    const details = String(req.body?.details || "").trim().slice(0,1000);
    const rr = await ReturnRequest.create({ order_id:order.order_id, order_numeric_id:order.id, user_email:String(user.email).toLowerCase(), reason, details, refund_amount:Number(order.amount||0) });
    try { if (order.user_email) await sendEmail("Return request received - Gloriya Jewellery", order.user_email, { textBody:`We received your return request for order ${order.order_id}. Our team will review it and update you.` }); } catch(e) { console.error("Return request email failed",e); }
    res.status(201).json({ success:true, request:rr, msg:"Return request submitted successfully." });
  } catch(e){ next(e); }
});

router.get("/:orderId/receipt", async (req,res,next)=>{
  try{
    const order=await Order.findOne({order_id:String(req.params.orderId)}).lean();
    if(!order) return res.status(404).send("Order not found");
    const customerView=String(req.query.customer||"") === "1";
    if(customerView){
      if(order.status !== "completed") return res.status(403).send("Receipt is available after payment confirmation.");
      const accessToken = String(req.query.token || "");
      const validEmailToken = accessToken && accessToken === buildReceiptAccessToken(order);
      if (!validEmailToken) {
        const tokenHeader = String(req.headers.authorization || "");
        if(!tokenHeader.startsWith("Bearer ")) return res.status(401).send("Please sign in to view your receipt.");
        try {
          const { verifyAuthToken } = await import("../utils/authToken.js");
          const payload = verifyAuthToken(tokenHeader.slice(7));
          const user = await User.findOne({ id:Number(payload.sub) }).lean();
          if(!user || String(user.email).toLowerCase() !== String(order.user_email || "").toLowerCase()) return res.status(403).send("This receipt does not belong to this account.");
        } catch { return res.status(401).send("Please sign in to view your receipt."); }
      }
    }
    const download = String(req.query.download || "") === "1";
    const pdf = String(req.query.format || "").toLowerCase() === "pdf" || download;
    if (pdf) {
      const pdfBuffer = buildReceiptPdf(order);
      const safeId = String(order.order_id || "order").replace(/[^a-zA-Z0-9_-]/g, "_");
      res.set({
        "Content-Type":"application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Gloriya-Order-Receipt-${safeId}.pdf"`,
        "Content-Length": String(pdfBuffer.length)
      });
      return res.send(pdfBuffer);
    }
    const receiptPath = `${req.baseUrl}/${encodeURIComponent(order.order_id)}/receipt`;
    const localDownloadUrl = `${receiptPath}?format=pdf&download=1&token=${encodeURIComponent(buildReceiptAccessToken(order))}`;
    res.type("html").send(buildReceiptHtml(order,{shopCopy:!customerView,downloadUrl:localDownloadUrl}));
  }catch(e){next(e);}
});

router.post("/verify", async (req, res) => {
  const data = req.body || {};
  const orderId = String(data.order_id || data.razorpay_order_id || "").trim();
  const paymentId = String(data.payment_id || data.razorpay_payment_id || "").trim();
  const signature = String(data.signature || data.razorpay_signature || "").trim();

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ success:false, msg: "Missing Razorpay verification fields", code:"MISSING_VERIFICATION_FIELDS" });
  }

  const order = await Order.findOne({ order_id: orderId });
  if (!order) return res.status(404).json({ success:false, msg: "Order not found", code:"LOCAL_ORDER_NOT_FOUND" });

  // Idempotency: never finalize the same successful payment twice.
  if (order.status === "completed" && String(order.payment_id || "") === paymentId) {
    const token = buildReceiptAccessToken(order);
    const receiptUrl = `${receiptEndpoint(order.order_id)}?customer=1`;
    const receiptDownloadUrl = `${receiptEndpoint(order.order_id)}?format=pdf&download=1&token=${encodeURIComponent(token)}`;
    return res.json({ success:true, msg: "Payment already verified", order_id: order.order_id, receipt_url: receiptUrl, receipt_download_url: receiptDownloadUrl });
  }

  try {
    if (!env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay secret is not configured on the server");
    const expected = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      return res.status(400).json({ success:false, msg:"Payment verification failed", code:"INVALID_SIGNATURE" });
    }

    const client = razorClient();
    if (!client) throw new Error("Razorpay client is not configured");

    const payment = await client.payments.fetch(paymentId);
    const paymentOrderId = String(payment?.order_id || "");
    if (paymentOrderId && paymentOrderId !== orderId) {
      return res.status(400).json({ success:false, msg:"Payment/order mismatch", code:"PAYMENT_ORDER_MISMATCH" });
    }

    let paymentStatus = String(payment?.status || "").toLowerCase();
    if (paymentStatus === "authorized") {
      const captured = await client.payments.capture(paymentId, Number(order.amount) * 100, "INR");
      paymentStatus = String(captured?.status || "captured").toLowerCase();
    }
    if (paymentStatus !== "captured") {
      return res.status(400).json({ success:false, msg:"Payment has not been captured by Razorpay", code:"PAYMENT_NOT_CAPTURED", payment_status:paymentStatus });
    }

    // Finalize only after signature + Razorpay payment status are verified.
    order.status = "completed";
    order.payment_id = paymentId;
    order.payment_status = paymentStatus;
    order.paid_at = new Date();

    for (const item of order.items || []) {
      const p = await Product.findOne({ id: Number(item.id ?? item.product_id ?? item.item_id) });
      if (!p) continue;
      if (p.inventory !== undefined && p.inventory !== null) {
        p.inventory = Math.max(0, (Number.parseInt(p.inventory, 10) || 0) - (Number(item.qty || item.quantity || 1) || 1));
        p.stock = p.inventory > 0;
      } else {
        p.stock = false;
      }
      await p.save();
    }

    const user = order.user_email ? await User.findOne({ email: String(order.user_email).toLowerCase() }) : null;
    if (user) {
      if (order.name) user.name = order.name;
      if (order.phone) user.phone = order.phone;
      if (order.address) user.address = order.address;
      if (order.city) user.city = order.city;
      if (order.pincode) user.pincode = order.pincode;
      user.orders = Array.isArray(user.orders) ? user.orders : [];
      const existing = user.orders.find(x => String(x?.order_id) === String(order.order_id));
      const orderSnapshot = { order_id: order.order_id, amount: order.amount, status: "completed", payment_id: paymentId, payment_status: paymentStatus, items: order.items || [], timestamp: order.timestamp, receipt_url: `${receiptEndpoint(order.order_id)}?customer=1` };
      if (existing) Object.assign(existing, orderSnapshot);
      else user.orders.push(orderSnapshot);
      await user.save();
    }

    await order.save();

    // Email/bill delivery is deliberately separate from payment status.
    try {
      const emailResult = await sendOrderEmail(order.toObject(), user?.toObject() || { name: order.name || "", email: order.user_email });
      if (!emailResult.ok) console.error("Order receipt email failed after successful payment:", emailResult.results);
    } catch (error) {
      console.error("Order receipt email request failed after successful payment:", error);
    }

    const receiptToken = buildReceiptAccessToken(order);
    const receiptUrl = `${receiptEndpoint(order.order_id)}?customer=1`;
    const receiptDownloadUrl = `${receiptEndpoint(order.order_id)}?format=pdf&download=1&token=${encodeURIComponent(receiptToken)}`;
    return res.json({ success:true, msg:"Payment verified and order completed", order_id:order.order_id, payment_id:paymentId, receipt_url:receiptUrl, receipt_download_url:receiptDownloadUrl });
  } catch (error) {
    const code = error?.error?.code || error?.code || "PAYMENT_VERIFICATION_ERROR";
    const description = error?.error?.description || error?.description || error?.message || "Payment verification failed";
    console.error("Razorpay verification error:", { code, description, statusCode:error?.statusCode, orderId, paymentId });
    return res.status(502).json({ success:false, msg:"Payment could not be verified. Please do not retry if your bank has already debited the amount; contact support with your payment ID.", code, description });
  }
});

export default router;
