import Product from "../models/Product.js";
import { UPLOAD_CATALOG } from "../data/uploadCatalog.js";

const PRICE_BY_CATEGORY = {
  Ring: 999,
  Bracelet: 1299,
  Necklace: 2199,
  Earring: 899,
  Bangles: 1199,
  "Western Jewellery": 1099,
  "Maang Teeka": 2299,
};

function titleFromKey(key) {
  return String(key || "jewellery")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * The uploaded catalogue is a product catalogue, not an image catalogue.
 * Every entry in UPLOAD_CATALOG represents ONE product and all of its files
 * are the gallery for that product.
 */
export function buildUploadedProducts() {
  return UPLOAD_CATALOG.map((group, index) => {
    const baseName = titleFromKey(group.key);
    const basePrice = Number(PRICE_BY_CATEGORY[group.category] || 1199);
    const files = Array.isArray(group.files) ? group.files : [];
    const media = files.map(file => ({ url: `/uploads/${file}`, type: "image" }));
    return {
      id: 1001 + index,
      catalogKey: group.key,
      name: baseName,
      price: basePrice,
      image: media[0]?.url || "",
      description: `Elegant ${String(group.category).toLowerCase()} from the Gloriya Jewellery collection. Designed for festive, party and special-occasion styling.`,
      stock: true,
      inventory: 25,
      category: group.category,
      tags: Array.isArray(group.nameHint) ? group.nameHint : [],
      media,
      reminders: [],
      trending: false,
    };
  });
}

export async function syncUploadedProductCatalog() {
  const products = buildUploadedProducts();

  // Remove the old image-per-product records created by the previous seed.
  // Admin-created products are left untouched because they do not use the
  // generated "Design XX" naming pattern.
  await Product.deleteMany({ name: { $regex: / – Design \d+$/ } });

  let changed = 0;
  for (const product of products) {
    const result = await Product.updateOne(
      { id: product.id },
      { $set: product },
      { upsert: true }
    );
    if (result.modifiedCount || result.upsertedCount) changed++;
  }

  console.log(`Uploaded product catalog sync: ${products.length} grouped products with galleries; ${changed} inserted/updated.`);
  return products.length;
}
