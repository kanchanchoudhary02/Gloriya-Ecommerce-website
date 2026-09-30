import mongoose from "mongoose";

const subscriberSchema = new mongoose.Schema({
  email: { type: String, unique: true, index: true, required: true, trim: true, lowercase: true },
  subscribed_at: { type: Date, default: Date.now }
}, { collection: "newsletter_subscribers", timestamps: true });

export default mongoose.model("Subscriber", subscriberSchema);
