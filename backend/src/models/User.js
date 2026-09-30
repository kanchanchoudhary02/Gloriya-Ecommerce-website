import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  name: { type: String, default: "" },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  pincode: { type: String, default: "" },
  resetTokenHash: { type: String, default: "" },
  resetTokenExpires: { type: Date, default: null },
  wishlist: { type: Array, default: [] },
  cart: { type: Array, default: [] },
  orders: { type: Array, default: [] }
}, { timestamps: true, strict: false, collection: "users" });

export default mongoose.model("User", userSchema);
