import mongoose from "mongoose";

const returnRequestSchema = new mongoose.Schema({
  order_id: { type: String, required: true, index: true },
  order_numeric_id: { type: Number, index: true },
  user_email: { type: String, index: true },
  reason: { type: String, default: "" },
  details: { type: String, default: "" },
  status: { type: String, enum: ["pending","approved","rejected"], default: "pending", index: true },
  refund_status: { type: String, enum: ["not_required","pending","initiated","processed","failed"], default: "pending" },
  refund_id: { type: String, default: "" },
  refund_amount: { type: Number, default: 0 },
  refund_error: { type: String, default: "" },
  requestedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true, collection: "return_requests" });

export default mongoose.model("ReturnRequest", returnRequestSchema);
