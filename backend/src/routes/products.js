import express from "express";
import Product from "../models/Product.js";
import { nextNumericId } from "../utils/ids.js";
import { requireAdmin } from "../utils/authToken.js";
import { enrichProduct, enrichProducts } from "../utils/enrichProduct.js";

const router = express.Router();
const SAMPLE_PRODUCTS = [
  { id: 1, name: "Diamond Ring", price: 25000, image: "https://wpolive.com/html/jowenly/assets/images/arrival/1.jpg", description: "Beautiful handcrafted ring", stock: true, reminders: [] },
  { id: 2, name: "Gold Necklace", price: 45000, image: "https://wpolive.com/html/jowenly/assets/images/arrival/3.jpg", description: "Elegant gold necklace", stock: true, reminders: [] },
  { id: 3, name: "Pearl Earrings", price: 15000, image: "https://i.pinimg.com/1200x/72/1c/fb/721cfba2ab130a6495a895d07b0fcabc.jpg", description: "Classy pearl earrings", stock: true, reminders: [] },
  { id: 4, name: "Bridal Set", price: 95000, image: "https://images.unsplash.com/photo-1600180758895-44e68e87b98d?auto=format&fit=crop&w=800&q=80", description: "Complete bridal jewellery set", stock: true, reminders: [] }
];

router.get("/", async (req, res) => {
  const query = req.query?.trending ? { trending: true } : {};
  const requestedLimit = Number.parseInt(req.query?.limit || (req.query?.trending ? "4" : "500"), 10) || (req.query?.trending ? 4 : 500);
  const limit = req.query?.trending ? 4 : Math.min(1000, Math.max(1, requestedLimit));
  const products = await Product.find(query).sort({ updatedAt: -1, id: 1 }).limit(limit).lean();
  if (!products.length && !req.query?.trending) return res.json(SAMPLE_PRODUCTS);
  res.json(enrichProducts(products).map(p => ({ ...p, price: Math.round(Number(p.price || 0)) })));
});

router.get("/random", async (req, res) => {
  let products = await Product.find({}).lean();
  const limit = Number.parseInt(req.query.limit ?? "4", 10) || 4;
  if (req.query.exclude) {
    const ex = new Set(String(req.query.exclude).split(",").filter(Boolean).map(Number));
    products = products.filter(p => !ex.has(Number(p.id)));
  }
  products.sort(() => Math.random() - 0.5);
  res.json(enrichProducts(products.slice(0, limit)));
});

router.get("/:product_id", async (req, res) => {
  const id = Number(req.params.product_id);
  const product = enrichProduct(await Product.findOne({ id }).lean()) || SAMPLE_PRODUCTS.find(p => p.id === id);
  if (!product) return res.status(404).json({ msg: "Product not found" });
  product.price = Math.round(Number(product.price || 0));
  res.json(product);
});

router.use(requireAdmin);

router.post("/", async (req, res) => {
  const data = req.body || {}, name = String(data.name || "").trim(), image = String(data.image || "").trim();
  if (!name || !image) return res.status(400).json({ msg: "Missing required fields: name or image" });
  const product = await Product.create({ id: await nextNumericId(Product), name, price: Math.round(Number(data.price || 0)), image, description: String(data.description || "").trim(), stock: Boolean(data.stock ?? true), reminders: data.reminders || [] });
  res.status(201).json({ msg: "Product added", product });
});

router.put("/:product_id", async (req, res) => {
  const id = Number(req.params.product_id), data = req.body || {};
  const p = await Product.findOne({ id });
  if (!p) return res.status(404).json({ msg: "Product not found" });
  p.name = data.name ?? p.name; p.price = Math.round(Number(data.price ?? p.price ?? 0)); p.image = data.image ?? p.image; p.description = data.description ?? p.description ?? "";
  p.stock = Boolean(data.stock ?? p.stock ?? true); if ("reminders" in data) p.reminders = data.reminders || [];
  await p.save();
  res.json({ msg: "Product updated", product: p });
});

router.delete("/:product_id", async (req, res) => {
  const id = Number(req.params.product_id);
  const result = await Product.deleteOne({ id });
  if (!result.deletedCount) return res.status(404).json({ msg: "Product not found" });
  res.json({ msg: "Product deleted" });
});

export default router;
