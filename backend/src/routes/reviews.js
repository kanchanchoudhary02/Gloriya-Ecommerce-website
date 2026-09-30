import express from "express";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { requireAdmin } from "../utils/authToken.js";

const router = express.Router();
const reviewUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 2 } });

router.get("/product/:productId", async (req,res,next)=>{
  try {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) return res.status(400).json({msg:"Invalid product id"});
    const reviews = await Review.find({productId}).sort({createdAt:-1}).lean();
    res.json(reviews);
  } catch(e){ next(e); }
});

router.post("/", reviewUpload.fields([{ name:"image", maxCount:1 }, { name:"video", maxCount:1 }]), async (req,res,next)=>{
  try {
    const { productId, name, email, rating, text } = req.body || {};
    const pid=Number(productId), r=Number(rating);
    const cleanEmail = String(email ?? "").trim();
    if(!Number.isFinite(pid) || !name?.trim() || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || r<1 || r>5 || !text?.trim()) {
      return res.status(400).json({msg:"Please provide valid review details"});
    }
    const product=await Product.findOne({id:pid});
    if(!product) return res.status(404).json({msg:"Product not found"});
    const media = [];
    const files = req.files || {};
    await fs.mkdir(path.resolve(env.UPLOAD_DIR), { recursive:true });
    for (const file of [...(files.image || []), ...(files.video || [])]) {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      const allowed = new Set(["jpg","jpeg","png","webp","gif","mp4","webm"]);
      if (!allowed.has(ext)) return res.status(400).json({msg:`Unsupported review media type: ${file.originalname}`});
      const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g,"_");
      const filename = `${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
      await fs.writeFile(path.join(path.resolve(env.UPLOAD_DIR),filename),file.buffer);
      media.push({ url:`/uploads/${filename}`, type:file.mimetype.startsWith("video/") ? "video" : "image" });
    }
    const review=await Review.create({productId:pid,name:name.trim(),email:cleanEmail.toLowerCase(),rating:r,text:text.trim(),media});
    const stats=await Review.aggregate([{ $match:{productId:pid}},{$group:{_id:null,avg:{$avg:"$rating"},count:{$sum:1}}}]);
    if(stats[0]){
      product.rating=Number(stats[0].avg.toFixed(1));
      product.rating_count=stats[0].count;
      await product.save();
    }
    res.status(201).json(review);
  } catch(e){ next(e); }
});

router.get("/admin/all", requireAdmin, async (_req,res,next)=>{
  try {
    const reviews = await Review.find({}).sort({createdAt:-1}).lean();
    res.json(reviews);
  } catch(e){ next(e); }
});

router.delete("/admin/:id", requireAdmin, async (req,res,next)=>{
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({msg:"Review not found"});
    for (const media of (review.media || [])) {
      try { await fs.unlink(path.join(path.resolve(env.UPLOAD_DIR), path.basename(String(media.url || "")))); } catch {}
    }
    const pid = Number(review.productId);
    await review.deleteOne();
    const stats = await Review.aggregate([{ $match:{productId:pid}},{$group:{_id:null,avg:{$avg:"$rating"},count:{$sum:1}}}]);
    await Product.updateOne({id:pid}, {$set:{rating:stats[0] ? Number(stats[0].avg.toFixed(1)) : 0, rating_count:stats[0]?.count || 0}});
    res.json({success:true,msg:"Review deleted"});
  } catch(e){ next(e); }
});

export default router;
