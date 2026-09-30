import Product from "../models/Product.js";
import { UPLOAD_CATEGORY_BY_FILE } from "../data/uploadCatalog.js";
import { enrichProduct } from "../utils/enrichProduct.js";
import path from "node:path";

function basenameFromUrl(value) {
  if (!value) return "";
  return path.basename(String(value).split("?")[0].split("#")[0]);
}

export async function syncUploadedImageCategories() {
  const products = await Product.find({}).lean();
  let changed = 0;
  for (const raw of products) {
    const urls = [raw.image, ...(Array.isArray(raw.media) ? raw.media.map(m => typeof m === "string" ? m : m?.url) : [])].filter(Boolean);
    const group = urls.map(basenameFromUrl).map(name => UPLOAD_CATEGORY_BY_FILE.get(name)).find(Boolean);
    if (!group) continue;
    const update = {};
    if (raw.category !== group.category) update.category = group.category;
    const enriched = enrichProduct(raw);
    if (JSON.stringify(raw.media || []) !== JSON.stringify(enriched.media || [])) update.media = enriched.media;
    if (!raw.image && enriched.image) update.image = enriched.image;
    if (!Object.keys(update).length) continue;
    await Product.updateOne({ _id: raw._id }, { $set: update });
    changed++;
  }
  if (changed) console.log(`Uploaded-image catalog sync: updated ${changed} product(s).`);
}
