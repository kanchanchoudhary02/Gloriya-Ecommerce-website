import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  name: { type: String, default: "" },
  price: { type: Number, default: 0 },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  stock: { type: Boolean, default: true },
  inventory: { type: Number, default: 0 },
  sku: { type: String, default: "" },
  category: { type: String, default: "" },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: { type: Array, default: [] },
  shipping: { type: mongoose.Schema.Types.Mixed, default: {} },
  return_policy: { type: String, default: "" },
  restock_request: { type: Boolean, default: false },
  media: { type: Array, default: [] },
  reminders: { type: Array, default: [] },
  size: { type: String, default: "" },
  trending: { type: Boolean, default: false }
}, { timestamps: true, strict: false, collection: "products" });

export default mongoose.model("Product", productSchema);
