import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  order_id: { type: String, unique: true, index: true },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },
  status: { type: String, default: "created", index: true },
  user_email: { type: String, default: "", index: true },
  name: String,
  phone: String,
  address: String,
  city: String,
  pincode: String,
  payment_id: String,
  items: { type: Array, default: [] },
  raw_client_payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: String, default: () => new Date().toISOString().replace("T", " ").slice(0, 19) }
}, { timestamps: true, strict: false, collection: "orders" });

export default mongoose.model("Order", orderSchema);
