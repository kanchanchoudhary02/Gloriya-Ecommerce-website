import mongoose from "mongoose";

const discountSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  title: { type: String, default: "" },
  type: { type: String, default: "percentage" },
  value: { type: Number, default: 0 },
  product_ids: { type: Array, default: [] },
  active: { type: Boolean, default: true },
  starts_at: Date,
  ends_at: Date
}, { timestamps: true, strict: false, collection: "discounts" });

export default mongoose.model("Discount", discountSchema);
