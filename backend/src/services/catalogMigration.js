import Product from "../models/Product.js";
import { UPLOAD_CATEGORY_BY_FILE } from "../data/uploadCatalog.js";
import path from "node:path";

function basenameFromUrl(value) {
  if (!value) return "";
  return path.basename(String(value).split("?")[0].split("#")[0]);
}

// Only fills in a missing category for seeded products. It never overrides the admin's choices.
export async function syncUploadedImageCategories() {
  const products = await Product.find({ $or: [{ category: "" }, { category: { $exists: false } }] }).lean();
  let changed = 0;
  for (const raw of products) {
    const urls = [raw.image, ...(Array.isArray(raw.media) ? raw.media.map(m => typeof m === "string" ? m : m?.url) : [])].filter(Boolean);
    const group = urls.map(basenameFromUrl).map(name => UPLOAD_CATEGORY_BY_FILE.get(name)).find(Boolean);
    if (!group) continue;
    await Product.updateOne({ _id: raw._id }, { $set: { category: group.category } });
    changed++;
  }
  if (changed) console.log(`Uploaded-image catalog sync: filled category for ${changed} product(s).`);
}
