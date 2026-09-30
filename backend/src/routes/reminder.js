import express from "express";
import Product from "../models/Product.js";
const router = express.Router();
router.post("/:product_id", async (req, res) => {
  const id = Number(req.params.product_id), email = req.body?.email;
  const p = await Product.findOne({ id });
  if (!p) return res.status(404).json({ msg: "Product not found" });
  p.reminders = p.reminders || [];
  if (email && !p.reminders.includes(email)) p.reminders.push(email);
  await p.save();
  res.json({ msg: "Reminder added" });
});
export default router;
