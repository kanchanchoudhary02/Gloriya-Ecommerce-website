import Product from "../models/Product.js";

export async function ensureFourTrendingProducts() {
  const current = await Product.find({ trending: true }).sort({ updatedAt: -1, id: 1 }).limit(10).lean();
  let selectedIds = current.map(p => Number(p.id)).filter(Number.isFinite).slice(0, 4);

  // On a fresh catalogue, seed exactly four products. After an admin has
  // manually changed Trending, preserve that choice even if fewer than four remain.
  if (current.length === 0) {
    const fill = await Product.find({ image: { $exists: true, $ne: "" } }).sort({ id: 1 }).limit(4).lean();
    selectedIds = fill.map(p => Number(p.id)).filter(Number.isFinite).slice(0, 4);
  }

  if (current.length === 0 || current.length > 4) {
    await Product.updateMany({}, { $set: { trending: false } });
    if (selectedIds.length) {
      await Product.updateMany({ id: { $in: selectedIds } }, { $set: { trending: true } });
    }
  }

  return selectedIds;
}
