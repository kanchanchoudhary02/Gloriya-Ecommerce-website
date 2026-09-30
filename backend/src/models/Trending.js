import mongoose from "mongoose";

const trendingSchema = new mongoose.Schema({
  slots: { type: Array, default: [] }
}, { timestamps: true, strict: false, collection: "trending" });

export default mongoose.model("Trending", trendingSchema);
