import { publicMediaUrl } from "./mediaUrl.js";

const isVideo = (url) => /\.(mp4|webm|mov)(\?|#|$)/i.test(String(url || ""));

function normalizeMedia(list) {
  const out = [];
  const seen = new Set();
  for (const m of Array.isArray(list) ? list : []) {
    const url = typeof m === "string" ? m : m?.url;
    if (!url) continue;
    const abs = publicMediaUrl(url);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    const type = (typeof m === "object" && m?.type) || (isVideo(url) ? "video" : "image");
    out.push({ url: abs, type });
  }
  return out;
}

/**
 * The admin panel is the single source of truth for a product. Nothing here
 * changes category/gallery any more; it only makes URLs usable by browsers and
 * guarantees the optional fields always exist.
 */
export function enrichProduct(product) {
  if (!product) return product;
  const p = { ...product };
  const media = normalizeMedia(p.media);
  const firstImage = media.find((m) => m.type !== "video")?.url || media[0]?.url || "";
  p.media = media;
  p.image = publicMediaUrl(p.image) || firstImage;
  p.attributes = p.attributes && typeof p.attributes === "object" && !Array.isArray(p.attributes) ? p.attributes : {};
  p.tags = Array.isArray(p.tags) ? p.tags : [];
  p.shipping = p.shipping && typeof p.shipping === "object" ? p.shipping : {};
  p.variants = (Array.isArray(p.variants) ? p.variants : [])
    .map((v) => ({
      stone_color: String(v?.stone_color || ""),
      metal_color: String(v?.metal_color || ""),
      image: publicMediaUrl(v?.image)
    }))
    .filter((v) => v.image && (v.stone_color || v.metal_color));
  p.related_ids = (Array.isArray(p.related_ids) ? p.related_ids : []).map(Number).filter(Number.isFinite);
  return p;
}

export function enrichProducts(products) {
  return (products || []).map(enrichProduct);
}
