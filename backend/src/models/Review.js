import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  productId: { type:Number, required:true, index:true },
  name: { type:String, required:true },
  email: { type:String, required:true },
  rating: { type:Number, min:1, max:5, required:true },
  text: { type:String, required:true },
  media: { type:Array, default:[] }
}, { timestamps:true, collection:"reviews" });

export default mongoose.model("Review", reviewSchema);
